//! Recent vaults persistence module.
//!
//! Tracks recently opened vaults for quick access.

use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tracing::info;

/// A single recent vault entry.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RecentVault {
    /// Path to the vault directory.
    pub path: String,
    /// Display name of the vault (directory name).
    pub name: String,
    /// Unix timestamp when the vault was last opened.
    pub opened_at: i64,
}

/// Manages the list of recently opened vaults.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentVaults {
    /// List of recent vault entries.
    vaults: Vec<RecentVault>,
    /// Path to the persistence file.
    #[serde(skip)]
    file_path: PathBuf,
}

/// Maximum number of recent vaults to keep.
const MAX_RECENT_VAULTS: usize = 5;

impl Default for RecentVaults {
    fn default() -> Self {
        Self {
            vaults: Vec::new(),
            file_path: PathBuf::new(),
        }
    }
}

impl RecentVaults {
    /// Load recent vaults from the config file.
    ///
    /// Creates an empty list if the file doesn't exist.
    /// Returns an error if the file exists but can't be read/parsed.
    pub fn load(config_dir: &PathBuf) -> crate::Result<Self> {
        let file_path = config_dir.join("recent_vaults.json");
        
        if !file_path.exists() {
            info!(path = ?file_path, "recent vaults file doesn't exist, creating empty");
            return Ok(Self {
                vaults: Vec::new(),
                file_path,
            });
        }

        let contents = std::fs::read_to_string(&file_path)?;
        
        let mut recent: RecentVaults = serde_json::from_str(&contents)
            .map_err(|e| crate::KnotError::Other(format!("Failed to parse recent vaults: {}", e)))?;
        
        recent.file_path = file_path;
        
        info!(count = recent.vaults.len(), "loaded recent vaults");
        Ok(recent)
    }

    /// Save recent vaults to the config file.
    pub fn save(&self) -> crate::Result<()> {
        if self.file_path.as_os_str().is_empty() {
            return Err(crate::KnotError::Other(
                "Recent vaults file path not set".to_string()
            ));
        }

        // Ensure parent directory exists
        if let Some(parent) = self.file_path.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let contents = serde_json::to_string_pretty(&self)
            .map_err(|e| crate::KnotError::Json(e.to_string()))?;
        
        std::fs::write(&self.file_path, contents)?;
        
        info!(path = ?self.file_path, count = self.vaults.len(), "saved recent vaults");
        Ok(())
    }

    /// Add a new vault to the recent list.
    ///
    /// - Removes any existing entry with the same path
    /// - Adds the new entry with current timestamp
    /// - Sorts by opened_at descending
    /// - Keeps only the most recent 5 entries
    pub fn add(&mut self, path: String, name: String) {
        let now = chrono::Utc::now().timestamp();
        
        // Remove any existing entry with the same path
        self.vaults.retain(|v| v.path != path);
        
        // Add new entry
        self.vaults.push(RecentVault {
            path,
            name,
            opened_at: now,
        });
        
        // Sort by opened_at descending (most recent first)
        self.vaults.sort_by(|a, b| b.opened_at.cmp(&a.opened_at));
        
        // Keep only MAX_RECENT_VAULTS
        if self.vaults.len() > MAX_RECENT_VAULTS {
            self.vaults.truncate(MAX_RECENT_VAULTS);
        }
        
        info!(count = self.vaults.len(), "added vault to recent list");
    }

    /// Get the list of recent vaults.
    ///
    /// Returns a clone of the vaults vector, sorted by opened_at descending.
    pub fn list(&self) -> Vec<RecentVault> {
        self.vaults.clone()
    }

    /// Get the file path used for persistence.
    pub fn file_path(&self) -> &PathBuf {
        &self.file_path
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_add_and_list() {
        let temp_dir = TempDir::new().unwrap();
        let mut recent = RecentVaults::load(&temp_dir.path().to_path_buf()).unwrap();
        
        // Add some vaults with delays to ensure different timestamps
        // (timestamp resolution is 1 second)
        recent.add("/path/to/vault1".to_string(), "vault1".to_string());
        std::thread::sleep(std::time::Duration::from_millis(1100));
        recent.add("/path/to/vault2".to_string(), "vault2".to_string());
        std::thread::sleep(std::time::Duration::from_millis(1100));
        recent.add("/path/to/vault3".to_string(), "vault3".to_string());
        
        let list = recent.list();
        assert_eq!(list.len(), 3);
        // Most recent should be first
        assert_eq!(list[0].name, "vault3");
        assert_eq!(list[1].name, "vault2");
        assert_eq!(list[2].name, "vault1");
    }

    #[test]
    fn test_duplicate_path_updates_timestamp() {
        let temp_dir = TempDir::new().unwrap();
        let mut recent = RecentVaults::load(&temp_dir.path().to_path_buf()).unwrap();
        
        recent.add("/path/to/vault1".to_string(), "vault1".to_string());
        let list1 = recent.list();
        let first_timestamp = list1[0].opened_at;
        
        // Delay to ensure different timestamp (timestamp resolution is 1 second)
        std::thread::sleep(std::time::Duration::from_millis(1100));
        
        // Add same path again - should update timestamp and not duplicate
        recent.add("/path/to/vault1".to_string(), "vault1".to_string());
        let list2 = recent.list();
        
        assert_eq!(list2.len(), 1);
        assert!(list2[0].opened_at > first_timestamp, 
            "expected {} > {}", list2[0].opened_at, first_timestamp);
    }

    #[test]
    fn test_max_entries_limit() {
        let temp_dir = TempDir::new().unwrap();
        let mut recent = RecentVaults::load(&temp_dir.path().to_path_buf()).unwrap();
        
        // Add more than MAX_RECENT_VAULTS with delays
        // (timestamp resolution is 1 second, so need >1s between each)
        for i in 0..10 {
            recent.add(
                format!("/path/to/vault{}", i),
                format!("vault{}", i)
            );
            std::thread::sleep(std::time::Duration::from_millis(1100));
        }
        
        let list = recent.list();
        assert_eq!(list.len(), MAX_RECENT_VAULTS);
        // Most recent should be preserved (vault9 was added last)
        assert_eq!(list[0].name, "vault9");
    }

    #[test]
    fn test_persistence() {
        let temp_dir = TempDir::new().unwrap();
        let config_path = temp_dir.path().to_path_buf();
        
        // Create and save
        {
            let mut recent = RecentVaults::load(&config_path).unwrap();
            recent.add("/path/to/vault1".to_string(), "vault1".to_string());
            recent.add("/path/to/vault2".to_string(), "vault2".to_string());
            recent.save().unwrap();
        }
        
        // Load and verify
        {
            let recent = RecentVaults::load(&config_path).unwrap();
            let list = recent.list();
            assert_eq!(list.len(), 2);
            assert!(list.iter().any(|v| v.name == "vault1"));
            assert!(list.iter().any(|v| v.name == "vault2"));
        }
    }

    #[test]
    fn test_empty_file_created_when_missing() {
        let temp_dir = TempDir::new().unwrap();
        let recent = RecentVaults::load(&temp_dir.path().to_path_buf()).unwrap();
        
        assert!(recent.list().is_empty());
    }
}
