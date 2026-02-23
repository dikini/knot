//! Shared runtime host abstractions for desktop and Android-compatible embedding.
//!
//! SPEC: COMP-KNOTD-RUNTIME-001 FR-1, FR-2, FR-4, FR-6, FR-8
//! TRACE: DESIGN-knotd-runtime-platform-compatibility

use crate::core::VaultManager;
use crate::error::{KnotError, Result};
use std::path::Path;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::sync::Mutex;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RuntimeMode {
    DesktopDaemonCapable,
    DesktopEmbedded,
    AndroidEmbeddedCompat,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VaultLockStatus {
    Available,
    Contended,
    Unknown,
}

#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct RuntimeLifecycle {
    pub last_foregrounded_at: Option<i64>,
    pub last_backgrounded_at: Option<i64>,
}

#[derive(Clone)]
pub struct RuntimeHost {
    mode: RuntimeMode,
    vault: Arc<Mutex<Option<VaultManager>>>,
    unsaved_changes: Arc<Mutex<bool>>,
    lifecycle: Arc<Mutex<RuntimeLifecycle>>,
}

impl Default for RuntimeHost {
    fn default() -> Self {
        Self::new(RuntimeMode::DesktopEmbedded)
    }
}

impl RuntimeHost {
    pub fn new(mode: RuntimeMode) -> Self {
        Self {
            mode,
            vault: Arc::new(Mutex::new(None)),
            unsaved_changes: Arc::new(Mutex::new(false)),
            lifecycle: Arc::new(Mutex::new(RuntimeLifecycle::default())),
        }
    }

    pub fn mode(&self) -> RuntimeMode {
        self.mode
    }

    pub fn vault(&self) -> &Arc<Mutex<Option<VaultManager>>> {
        &self.vault
    }

    pub async fn is_open(&self) -> bool {
        self.vault.lock().await.is_some()
    }

    pub async fn current_vault_path(&self) -> Option<String> {
        self.vault
            .lock()
            .await
            .as_ref()
            .map(|v| v.root_path().to_string_lossy().to_string())
    }

    pub async fn with_manager<T, F>(&self, f: F) -> Result<T>
    where
        F: FnOnce(&VaultManager) -> Result<T>,
    {
        let guard = self.vault.lock().await;
        let vault = guard.as_ref().ok_or(KnotError::VaultNotOpen)?;
        f(vault)
    }

    pub async fn with_manager_mut<T, F>(&self, f: F) -> Result<T>
    where
        F: FnOnce(&mut VaultManager) -> Result<T>,
    {
        let mut guard = self.vault.lock().await;
        let vault = guard.as_mut().ok_or(KnotError::VaultNotOpen)?;
        f(vault)
    }

    pub async fn set_unsaved_changes(&self, has_unsaved_changes: bool) {
        *self.unsaved_changes.lock().await = has_unsaved_changes;
    }

    pub async fn has_unsaved_changes(&self) -> bool {
        *self.unsaved_changes.lock().await
    }

    pub async fn mark_foregrounded(&self) {
        self.lifecycle.lock().await.last_foregrounded_at = Some(now_unix_ts());
    }

    pub async fn mark_backgrounded(&self) {
        self.lifecycle.lock().await.last_backgrounded_at = Some(now_unix_ts());
    }

    pub async fn lifecycle_snapshot(&self) -> RuntimeLifecycle {
        self.lifecycle.lock().await.clone()
    }

    pub async fn open_existing(&self, _path: &Path) -> Result<()> {
        let mut guard = self.vault.lock().await;
        if guard.is_some() {
            return Err(KnotError::Other("vault already open".to_string()));
        }

        let vault = VaultManager::open(_path).map_err(|err| {
            let status = Self::classify_open_error(&err);
            match status {
                VaultLockStatus::Contended => KnotError::Other(
                    "vault open failed due to active lock contention; attach to active owner or close competing process".to_string(),
                ),
                _ => err,
            }
        })?;

        *guard = Some(vault);
        drop(guard);
        self.set_unsaved_changes(false).await;
        Ok(())
    }

    pub async fn create_new(&self, _path: &Path) -> Result<()> {
        let mut guard = self.vault.lock().await;
        if guard.is_some() {
            return Err(KnotError::Other("vault already open".to_string()));
        }

        let vault = VaultManager::create(_path)?;
        *guard = Some(vault);
        drop(guard);
        self.set_unsaved_changes(false).await;
        Ok(())
    }

    pub async fn close(&self) -> Result<()> {
        let mut guard = self.vault.lock().await;
        if let Some(mut vault) = guard.take() {
            vault.close()?;
        }
        Ok(())
    }

    pub fn classify_open_error(error: &KnotError) -> VaultLockStatus {
        match error {
            KnotError::Search(msg) if is_lock_contention_message(msg) => VaultLockStatus::Contended,
            KnotError::Other(msg) if is_lock_contention_message(msg) => VaultLockStatus::Contended,
            KnotError::VaultNotOpen => VaultLockStatus::Available,
            _ => VaultLockStatus::Unknown,
        }
    }
}

fn now_unix_ts() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

fn is_lock_contention_message(message: &str) -> bool {
    let normalized = message.to_ascii_lowercase();
    normalized.contains("lockbusy")
        || normalized.contains("failed to acquire index lock")
        || normalized.contains("failed to acquire lockfile")
}

#[cfg(test)]
mod tests {
    use super::{RuntimeHost, RuntimeMode, VaultLockStatus};
    use crate::error::KnotError;
    use tempfile::tempdir;

    #[tokio::test]
    async fn runtime_with_manager_fails_when_closed() {
        let runtime = RuntimeHost::default();
        let result = runtime.with_manager(|_| Ok(())).await;
        assert!(matches!(result, Err(KnotError::VaultNotOpen)));
    }

    #[tokio::test]
    async fn runtime_open_close_roundtrip() {
        let dir = tempdir().expect("tempdir");
        let runtime = RuntimeHost::new(RuntimeMode::DesktopDaemonCapable);
        runtime.create_new(dir.path()).await.expect("create vault");
        runtime.close().await.expect("close after create");
        runtime.open_existing(dir.path()).await.expect("open vault");
        assert!(runtime.is_open().await, "runtime should be open");

        runtime.close().await.expect("close vault");
        assert!(!runtime.is_open().await, "runtime should be closed");
    }

    #[tokio::test]
    async fn runtime_unsaved_changes_roundtrip() {
        let runtime = RuntimeHost::default();
        assert!(!runtime.has_unsaved_changes().await);
        runtime.set_unsaved_changes(true).await;
        assert!(runtime.has_unsaved_changes().await);
        runtime.set_unsaved_changes(false).await;
        assert!(!runtime.has_unsaved_changes().await);
    }

    #[test]
    fn runtime_classifies_lock_contention() {
        let error = KnotError::Search(
            "Failed to acquire Lockfile: LockBusy. Failed to acquire index lock".to_string(),
        );
        let status = RuntimeHost::classify_open_error(&error);
        assert_eq!(status, VaultLockStatus::Contended);
    }
}
