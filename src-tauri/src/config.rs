use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::Path;

use crate::error::Result;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultConfig {
    #[serde(default = "default_name")]
    pub name: String,

    #[serde(default)]
    pub sync: SyncConfig,

    #[serde(default)]
    pub editor: EditorConfig,

    #[serde(default)]
    pub plugins_enabled: bool,

    #[serde(default)]
    pub plugin_overrides: BTreeMap<String, bool>,

    #[serde(default)]
    pub file_visibility: FileVisibilityPolicy,

    #[serde(default)]
    pub explorer: ExplorerConfig,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum FileVisibilityPolicy {
    #[default]
    AllFiles,
    KnownOnly,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct SyncConfig {
    #[serde(default)]
    pub enabled: bool,

    #[serde(default)]
    pub peers: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EditorConfig {
    #[serde(default = "default_font_size")]
    pub font_size: u32,

    #[serde(default = "default_tab_size")]
    pub tab_size: u32,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ExplorerConfig {
    #[serde(default)]
    pub expanded_folders: Vec<String>,

    #[serde(default)]
    pub expansion_state_initialized: bool,
}

fn default_name() -> String {
    "My Vault".to_string()
}

fn default_font_size() -> u32 {
    14
}

fn default_tab_size() -> u32 {
    4
}

impl Default for VaultConfig {
    fn default() -> Self {
        Self {
            name: default_name(),
            sync: SyncConfig::default(),
            editor: EditorConfig::default(),
            plugins_enabled: false, // Disabled by default for security
            plugin_overrides: BTreeMap::new(),
            file_visibility: FileVisibilityPolicy::AllFiles,
            explorer: ExplorerConfig::default(),
        }
    }
}

impl Default for EditorConfig {
    fn default() -> Self {
        Self {
            font_size: default_font_size(),
            tab_size: default_tab_size(),
        }
    }
}

impl VaultConfig {
    pub fn load(path: &Path) -> Result<Self> {
        let content = std::fs::read_to_string(path)?;
        let config: VaultConfig = toml::from_str(&content)?;
        Ok(config)
    }

    pub fn save(&self, path: &Path) -> Result<()> {
        let content =
            toml::to_string_pretty(self).expect("VaultConfig should always serialize to TOML");
        std::fs::write(path, content)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_config_roundtrips() {
        let config = VaultConfig::default();
        let toml_str =
            toml::to_string_pretty(&config).expect("VaultConfig should serialize to TOML");
        let parsed: VaultConfig =
            toml::from_str(&toml_str).expect("VaultConfig should deserialize from TOML");
        assert_eq!(parsed.name, config.name);
        assert_eq!(parsed.editor.font_size, config.editor.font_size);
        assert_eq!(
            parsed.explorer.expanded_folders,
            config.explorer.expanded_folders
        );
        assert_eq!(parsed.file_visibility, config.file_visibility);
        assert_eq!(parsed.plugin_overrides, config.plugin_overrides);
    }

    #[test]
    fn partial_config_uses_defaults() {
        let toml_str = r#"name = "Test Vault""#;
        let config: VaultConfig = toml::from_str(toml_str).unwrap();
        assert_eq!(config.name, "Test Vault");
        assert!(!config.sync.enabled);
        assert_eq!(config.editor.font_size, 14);
        assert!(config.plugin_overrides.is_empty());
        assert_eq!(config.file_visibility, FileVisibilityPolicy::AllFiles);
        assert!(config.explorer.expanded_folders.is_empty());
        assert!(!config.explorer.expansion_state_initialized);
    }
}
