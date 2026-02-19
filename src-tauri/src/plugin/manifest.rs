//! Plugin manifest parsing for WASM plugins.

use crate::error::VaultError;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::Path;

/// Plugin permissions that control what a plugin can access.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PluginPermission {
    /// Access to filesystem operations
    FsRead,
    FsWrite,
    /// Access to network operations
    Network,
    /// Access to vault data
    VaultRead,
    VaultWrite,
    /// Access to UI components
    Ui,
}

/// Plugin manifest that defines plugin metadata and capabilities.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginManifest {
    /// Plugin name (unique identifier)
    pub name: String,
    /// Human-readable display name
    pub display_name: String,
    /// Plugin version (semver)
    pub version: String,
    /// Plugin description
    pub description: Option<String>,
    /// Plugin author
    pub author: Option<String>,
    /// Entry point WASM file name
    pub entry_point: String,
    /// Required permissions
    #[serde(default)]
    pub permissions: HashSet<PluginPermission>,
    /// API version compatibility
    pub api_version: String,
}

impl PluginManifest {
    /// Load and parse a plugin manifest from a TOML file.
    pub fn from_file<P: AsRef<Path>>(path: P) -> crate::Result<Self> {
        let content = std::fs::read_to_string(path)?;
        let manifest: PluginManifest = toml::from_str(&content).map_err(VaultError::Config)?;
        Ok(manifest)
    }

    /// Check if the plugin has a specific permission.
    pub fn has_permission(&self, permission: PluginPermission) -> bool {
        self.permissions.contains(&permission)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;

    fn create_test_manifest_toml() -> &'static str {
        r#"
name = "test-plugin"
display_name = "Test Plugin"
version = "1.0.0"
description = "A test plugin"
author = "Test Author"
entry_point = "test.wasm"
api_version = "1.0"
permissions = ["fs_read", "vault_read"]
"#
    }

    #[test]
    fn test_manifest_from_file() {
        let mut temp_file = NamedTempFile::new().unwrap();
        temp_file
            .write_all(create_test_manifest_toml().as_bytes())
            .unwrap();

        let manifest = PluginManifest::from_file(temp_file.path()).unwrap();

        assert_eq!(manifest.name, "test-plugin");
        assert_eq!(manifest.display_name, "Test Plugin");
        assert_eq!(manifest.version, "1.0.0");
        assert_eq!(manifest.description, Some("A test plugin".to_string()));
        assert_eq!(manifest.author, Some("Test Author".to_string()));
        assert_eq!(manifest.entry_point, "test.wasm");
        assert_eq!(manifest.api_version, "1.0");
        assert!(manifest.has_permission(PluginPermission::FsRead));
        assert!(manifest.has_permission(PluginPermission::VaultRead));
        assert!(!manifest.has_permission(PluginPermission::FsWrite));
        assert!(!manifest.has_permission(PluginPermission::Network));
    }

    #[test]
    fn test_manifest_default_permissions() {
        let toml = r#"
name = "minimal-plugin"
display_name = "Minimal Plugin"
version = "0.1.0"
entry_point = "minimal.wasm"
api_version = "1.0"
"#;
        let mut temp_file = NamedTempFile::new().unwrap();
        temp_file.write_all(toml.as_bytes()).unwrap();

        let manifest = PluginManifest::from_file(temp_file.path()).unwrap();

        assert!(manifest.permissions.is_empty());
        assert!(!manifest.has_permission(PluginPermission::FsRead));
    }

    #[test]
    fn test_manifest_deserialize_all_permissions() {
        let toml = r#"
name = "full-perm-plugin"
display_name = "Full Permissions Plugin"
version = "1.0.0"
entry_point = "full.wasm"
api_version = "1.0"
permissions = ["fs_read", "fs_write", "network", "vault_read", "vault_write", "ui"]
"#;
        let mut temp_file = NamedTempFile::new().unwrap();
        temp_file.write_all(toml.as_bytes()).unwrap();

        let manifest = PluginManifest::from_file(temp_file.path()).unwrap();

        assert!(manifest.has_permission(PluginPermission::FsRead));
        assert!(manifest.has_permission(PluginPermission::FsWrite));
        assert!(manifest.has_permission(PluginPermission::Network));
        assert!(manifest.has_permission(PluginPermission::VaultRead));
        assert!(manifest.has_permission(PluginPermission::VaultWrite));
        assert!(manifest.has_permission(PluginPermission::Ui));
    }

    #[test]
    fn test_manifest_invalid_toml() {
        let toml = "not valid toml [[[";
        let mut temp_file = NamedTempFile::new().unwrap();
        temp_file.write_all(toml.as_bytes()).unwrap();

        let result = PluginManifest::from_file(temp_file.path());
        assert!(result.is_err());
    }

    #[test]
    fn test_manifest_missing_required_field() {
        let toml = r#"
display_name = "Missing Name"
version = "1.0.0"
entry_point = "test.wasm"
api_version = "1.0"
"#;
        let mut temp_file = NamedTempFile::new().unwrap();
        temp_file.write_all(toml.as_bytes()).unwrap();

        let result = PluginManifest::from_file(temp_file.path());
        assert!(result.is_err());
    }
}
