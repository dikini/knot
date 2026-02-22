//! Vault-related Tauri commands.
//!
//! SPEC: COMP-VAULT-001 FR-1, FR-2, FR-3, FR-4, FR-5, FR-6

use serde::Serialize;
use tauri::{State, Window};
use tauri_plugin_dialog::{DialogExt, MessageDialogButtons};
use tracing::{info, instrument};

use crate::commands::emit_event;
use crate::core::VaultManager;
use crate::error::KnotError;
use crate::recent_vaults::{RecentVault, RecentVaults};
use crate::state::response::{NoteSummary, VaultInfo};
use crate::state::AppState;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize)]
struct TreeChangedEventPayload {
    reason: &'static str,
    changed_count: usize,
}

/// Greet command - simple test command.
#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// SPEC: COMP-VAULT-001 FR-1
/// Create a new vault at the specified path.
#[tauri::command]
#[instrument(skip(state))]
pub async fn create_vault(path: String, state: State<'_, AppState>) -> Result<VaultInfo, String> {
    info!(path, "creating vault");

    let mut vault_guard = state.vault().lock().await;

    // Close any existing vault
    if vault_guard.is_some() {
        return Err("A vault is already open".to_string());
    }

    let path_buf = std::path::PathBuf::from(&path);

    // Create the vault
    let vault = VaultManager::create(&path_buf).map_err(|e| e.to_response_string())?;

    let info = vault_info_from_manager(&vault).map_err(|e| e.to_response_string())?;
    *vault_guard = Some(vault);

    info!(path, "vault created");
    Ok(info)
}

/// SPEC: COMP-VAULT-001 FR-2
/// Open an existing vault at the specified path.
#[tauri::command]
#[instrument(skip(state))]
pub async fn open_vault(path: String, state: State<'_, AppState>) -> Result<VaultInfo, String> {
    info!(path, "opening vault");

    ensure_can_replace_open_vault(state.is_vault_open().await, state.has_unsaved_changes().await)?;

    let mut vault_guard = state.vault().lock().await;

    // Close any existing vault
    if vault_guard.is_some() {
        *vault_guard = None;
    }

    let path_buf = std::path::PathBuf::from(&path);

    // Open the vault
    let vault = VaultManager::open(&path_buf).map_err(|e| e.to_response_string())?;

    let info = vault_info_from_manager(&vault).map_err(|e| e.to_response_string())?;
    *vault_guard = Some(vault);
    drop(vault_guard);
    state.set_unsaved_changes(false).await;

    info!(path, "vault opened");
    Ok(info)
}

/// Create a new vault by showing a directory picker dialog.
#[tauri::command]
#[instrument(skip(state, window))]
pub async fn create_vault_dialog(
    window: tauri::Window,
    state: State<'_, AppState>,
) -> Result<VaultInfo, String> {
    info!("creating vault dialog");

    // Open directory picker dialog
    let selected_path = window
        .dialog()
        .file()
        .set_title("Select Directory for New Vault")
        .set_directory("~")
        .blocking_pick_folder();

    let path = match selected_path {
        Some(path) => path,
        None => return Err("No directory selected".to_string()),
    };

    // Convert FilePath to PathBuf
    let path_buf = path
        .into_path()
        .map_err(|_| "Invalid path selected".to_string())?;
    let path_str = path_buf.to_string_lossy().to_string();
    info!(path = path_str, "directory selected for vault creation");

    // Check if directory is empty
    let is_empty = std::fs::read_dir(&path_buf)
        .map_err(|e| format!("Failed to read directory: {}", e))?
        .next()
        .is_none();

    // If not empty, show confirmation dialog
    if !is_empty {
        let confirmed = window
            .dialog()
            .message("Directory not empty. Create vault here anyway?")
            .title("Directory Not Empty")
            .buttons(MessageDialogButtons::YesNo)
            .blocking_show();

        if !confirmed {
            return Err("User cancelled vault creation".to_string());
        }
    }

    // Close any existing vault
    let mut vault_guard = state.vault().lock().await;
    if vault_guard.is_some() {
        return Err("A vault is already open".to_string());
    }

    // Create the vault
    let vault = VaultManager::create(&path_buf).map_err(|e| e.to_response_string())?;

    let info = vault_info_from_manager(&vault).map_err(|e| e.to_response_string())?;
    *vault_guard = Some(vault);

    info!(path = path_str, "vault created from dialog");
    Ok(info)
}

/// Open a vault by showing a directory picker dialog.
#[tauri::command]
#[instrument(skip(state, window))]
pub async fn open_vault_dialog(
    window: tauri::Window,
    state: State<'_, AppState>,
) -> Result<VaultInfo, String> {
    info!("opening vault dialog");

    // Open directory picker dialog
    let selected_path = window
        .dialog()
        .file()
        .set_title("Select Vault Directory")
        .set_directory("~")
        .blocking_pick_folder();

    let path = match selected_path {
        Some(path) => path,
        None => return Err("No directory selected".to_string()),
    };

    // Convert FilePath to PathBuf
    let path_buf = path
        .into_path()
        .map_err(|_| "Invalid path selected".to_string())?;
    let path_str = path_buf.to_string_lossy().to_string();
    info!(path = path_str, "directory selected");

    // Validate that the directory contains a .vault/ subdirectory
    let vault_metadata_path = path_buf.join(".vault");
    if !vault_metadata_path.exists() {
        return Err(format!(
            "Selected directory is not a vault: '{}' does not contain a .vault/ subdirectory",
            path_str
        ));
    }

    ensure_can_replace_open_vault(state.is_vault_open().await, state.has_unsaved_changes().await)?;

    // Close any existing vault
    let mut vault_guard = state.vault().lock().await;
    if vault_guard.is_some() {
        *vault_guard = None;
    }

    // Open the vault
    let vault = VaultManager::open(&path_buf).map_err(|e| e.to_response_string())?;

    let info = vault_info_from_manager(&vault).map_err(|e| e.to_response_string())?;
    *vault_guard = Some(vault);
    drop(vault_guard);
    state.set_unsaved_changes(false).await;

    info!(path = path_str, "vault opened from dialog");
    Ok(info)
}

/// SPEC: COMP-VAULT-001 FR-3
/// Close the currently open vault.
#[tauri::command]
#[instrument(skip(state))]
pub async fn close_vault(state: State<'_, AppState>) -> Result<(), String> {
    info!("closing vault");

    let mut vault_guard = state.vault().lock().await;

    if let Some(mut vault) = vault_guard.take() {
        vault.close().map_err(|e| e.to_response_string())?;
    }
    drop(vault_guard);
    state.set_unsaved_changes(false).await;

    info!("vault closed");
    Ok(())
}

/// SPEC: COMP-VAULT-UNSAVED-001 FR-4
/// Update backend unsaved-changes guard state from frontend editor lifecycle.
#[tauri::command]
#[instrument(skip(state))]
pub async fn set_unsaved_changes(dirty: bool, state: State<'_, AppState>) -> Result<(), String> {
    state.set_unsaved_changes(dirty).await;
    Ok(())
}

/// SPEC: COMP-VAULT-001 FR-4
/// Get information about the currently open vault.
#[tauri::command]
#[instrument(skip(state))]
pub async fn get_vault_info(state: State<'_, AppState>) -> Result<VaultInfo, String> {
    let vault_guard = state.vault().lock().await;

    match vault_guard.as_ref() {
        Some(vault) => vault_info_from_manager(vault).map_err(|e| e.to_response_string()),
        None => Err("No vault is open".to_string()),
    }
}

/// SPEC: COMP-VAULT-001 FR-5
/// Check if a vault is currently open.
#[tauri::command]
pub async fn is_vault_open(state: State<'_, AppState>) -> Result<bool, String> {
    Ok(state.is_vault_open().await)
}

/// Helper function to build VaultInfo from VaultManager.
fn vault_info_from_manager(vault: &VaultManager) -> Result<VaultInfo, KnotError> {
    let path = vault.root_path().to_string_lossy().to_string();
    let name = vault
        .root_path()
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "Vault".to_string());

    let note_count = vault.note_count()?;

    // Get last modified time of the vault directory
    let last_modified = std::fs::metadata(vault.root_path())
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64)
        .unwrap_or_else(|| chrono::Utc::now().timestamp());

    Ok(VaultInfo {
        path,
        name,
        note_count,
        last_modified,
    })
}

/// SPEC: COMP-VAULT-001 FR-6
/// List recently modified notes.
#[tauri::command]
#[instrument(skip(state))]
pub async fn get_recent_notes(
    limit: usize,
    state: State<'_, AppState>,
) -> Result<Vec<NoteSummary>, String> {
    let vault_guard = state.vault().lock().await;

    match vault_guard.as_ref() {
        Some(vault) => {
            let notes = vault.list_notes().map_err(|e| e.to_response_string())?;

            // Sort by modified date, take limit
            let mut notes: Vec<_> = notes.into_iter().map(note_meta_to_summary).collect();
            notes.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));
            notes.truncate(limit);

            Ok(notes)
        }
        None => Err("No vault is open".to_string()),
    }
}

/// Helper to convert NoteMeta to NoteSummary.
fn note_meta_to_summary(meta: crate::note::NoteMeta) -> NoteSummary {
    NoteSummary {
        id: meta.id,
        path: meta.path,
        title: meta.title,
        created_at: meta.created_at,
        modified_at: meta.modified_at,
        word_count: meta.word_count,
    }
}

/// SPEC: COMP-VAULT-UNSAVED-001 FR-1, FR-2, FR-3, FR-4
fn ensure_can_replace_open_vault(has_open_vault: bool, has_unsaved_changes: bool) -> Result<(), String> {
    if has_open_vault && has_unsaved_changes {
        return Err("Cannot switch vault: unsaved changes detected. Save or discard your note edits first.".to_string());
    }
    Ok(())
}

/// Get the list of recently opened vaults.
#[tauri::command]
#[instrument]
pub async fn get_recent_vaults() -> Result<Vec<RecentVault>, String> {
    let config_dir = dirs::config_dir()
        .ok_or_else(|| "Could not determine config directory".to_string())?
        .join("knot");

    let recent = RecentVaults::load(&config_dir)
        .map_err(|e| format!("Failed to load recent vaults: {}", e))?;

    Ok(recent.list())
}

/// Sync external file changes into the vault.
///
/// Polls the file watcher for changes made outside the application
/// and syncs them into the vault state.
#[tauri::command]
#[instrument(skip(state))]
pub async fn sync_external_changes(
    window: Window,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut vault_guard = state.vault().lock().await;

    if let Some(ref mut vault) = vault_guard.as_mut() {
        let changed_count = vault
            .sync_external_changes()
            .map_err(|e| e.to_response_string())?;
        if changed_count > 0 {
            emit_event(
                &window,
                "vault://tree-changed",
                TreeChangedEventPayload {
                    reason: "watcher-sync",
                    changed_count,
                },
            );
        }
    }

    Ok(())
}

/// Add a vault to the recent vaults list.
///
/// Gets the vault name from the currently open vault in state.
#[tauri::command]
#[instrument(skip(state))]
pub async fn add_recent_vault(path: String, state: State<'_, AppState>) -> Result<(), String> {
    let vault_guard = state.vault().lock().await;

    // Get vault name from the open vault, or extract from path
    let name = match vault_guard.as_ref() {
        Some(vault) => vault
            .root_path()
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_else(|| "Vault".to_string()),
        None => {
            // If no vault is open, extract name from the provided path
            PathBuf::from(&path)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| "Vault".to_string())
        }
    };

    drop(vault_guard);

    let config_dir = dirs::config_dir()
        .ok_or_else(|| "Could not determine config directory".to_string())?
        .join("knot");

    let mut recent = RecentVaults::load(&config_dir)
        .map_err(|e| format!("Failed to load recent vaults: {}", e))?;

    recent.add(path, name);

    recent
        .save()
        .map_err(|e| format!("Failed to save recent vaults: {}", e))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::ensure_can_replace_open_vault;

    #[test]
    fn bug_vault_unsaved_001_allows_replace_when_clean() {
        let result = ensure_can_replace_open_vault(true, false);
        assert!(result.is_ok());
    }

    #[test]
    fn bug_vault_unsaved_001_blocks_replace_when_dirty() {
        let result = ensure_can_replace_open_vault(true, true);
        assert!(result.is_err());
        assert!(
            result
                .err()
                .unwrap_or_default()
                .contains("unsaved changes")
        );
    }
}
