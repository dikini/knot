use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

use crate::error::{KnotError, Result};

const APP_CONFIG_FILE: &str = "app-config.toml";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AppKeymapSettings {
    #[serde(default)]
    pub keymaps: ManagedKeymapSections,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ManagedKeymapSections {
    #[serde(default)]
    pub general: GeneralKeymapSettings,

    #[serde(default)]
    pub editor: EditorKeymapSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct GeneralKeymapSettings {
    #[serde(default = "default_save_note_shortcut")]
    pub save_note: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct EditorKeymapSettings {
    #[serde(default = "default_undo_shortcut")]
    pub undo: String,

    #[serde(default = "default_redo_shortcut")]
    pub redo: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ShortcutValidationError {
    pub field: String,
    pub message: String,
}

impl Default for AppKeymapSettings {
    fn default() -> Self {
        default_app_keymap_settings()
    }
}

impl Default for ManagedKeymapSections {
    fn default() -> Self {
        Self {
            general: GeneralKeymapSettings::default(),
            editor: EditorKeymapSettings::default(),
        }
    }
}

impl Default for GeneralKeymapSettings {
    fn default() -> Self {
        Self {
            save_note: default_save_note_shortcut(),
        }
    }
}

impl Default for EditorKeymapSettings {
    fn default() -> Self {
        Self {
            undo: default_undo_shortcut(),
            redo: default_redo_shortcut(),
        }
    }
}

pub fn default_app_keymap_settings() -> AppKeymapSettings {
    AppKeymapSettings {
        keymaps: ManagedKeymapSections::default(),
    }
}

pub fn load_app_keymap_settings(config_root: &Path) -> Result<AppKeymapSettings> {
    let path = app_config_path(config_root);
    if !path.exists() {
        return Ok(default_app_keymap_settings());
    }

    let content = std::fs::read_to_string(path)?;
    let settings = toml::from_str::<AppKeymapSettings>(&content)?;
    validate_app_keymap_settings(&settings)?;
    Ok(settings)
}

pub fn save_app_keymap_settings(config_root: &Path, settings: &AppKeymapSettings) -> Result<()> {
    validate_app_keymap_settings(settings)?;
    std::fs::create_dir_all(config_root)?;
    let content = toml::to_string_pretty(settings)?;
    std::fs::write(app_config_path(config_root), content)?;
    Ok(())
}

pub fn validate_app_keymap_settings(settings: &AppKeymapSettings) -> Result<()> {
    let mut seen: HashMap<String, &str> = HashMap::new();
    let managed_values = [
        ("general.save_note", settings.keymaps.general.save_note.as_str()),
        ("editor.undo", settings.keymaps.editor.undo.as_str()),
        ("editor.redo", settings.keymaps.editor.redo.as_str()),
    ];

    let mut errors: Vec<ShortcutValidationError> = Vec::new();

    for (field, value) in managed_values {
        match normalize_shortcut_list(value) {
            Ok(normalized) => {
                for chord in normalized {
                    if let Some(previous) = seen.insert(chord.clone(), field) {
                        errors.push(ShortcutValidationError {
                            field: field.to_string(),
                            message: format!("Duplicate shortcut with {previous}: {chord}"),
                        });
                    }
                }
            }
            Err(message) => errors.push(ShortcutValidationError {
                field: field.to_string(),
                message,
            }),
        }
    }

    if errors.is_empty() {
        Ok(())
    } else {
        let detail = errors
            .iter()
            .map(|error| format!("{}: {}", error.field, error.message))
            .collect::<Vec<_>>()
            .join("; ");
        Err(KnotError::Config(detail))
    }
}

pub fn app_config_path(config_root: &Path) -> PathBuf {
    config_root.join(APP_CONFIG_FILE)
}

fn default_save_note_shortcut() -> String {
    "Mod-s".to_string()
}

fn default_undo_shortcut() -> String {
    "Mod-z".to_string()
}

fn default_redo_shortcut() -> String {
    "Mod-Shift-z, Mod-y".to_string()
}

fn normalize_shortcut_list(raw: &str) -> std::result::Result<Vec<String>, String> {
    let mut normalized = Vec::new();

    for chord in raw
        .split(',')
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        normalized.push(normalize_chord(chord)?);
    }

    if normalized.is_empty() {
        return Err("Shortcut must include at least one chord".to_string());
    }

    let mut deduped = HashSet::new();
    for chord in &normalized {
        if !deduped.insert(chord.clone()) {
            return Err(format!("Shortcut repeats the same chord twice: {chord}"));
        }
    }

    Ok(normalized)
}

fn normalize_chord(raw: &str) -> std::result::Result<String, String> {
    let tokens = raw
        .split('-')
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .collect::<Vec<_>>();

    if tokens.len() < 2 {
        return Err(format!("Shortcut must include modifiers and a key: {raw}"));
    }

    let key = tokens
        .last()
        .copied()
        .ok_or_else(|| format!("Shortcut is missing a key: {raw}"))?;

    let mut modifiers = HashSet::new();
    for modifier in &tokens[..tokens.len() - 1] {
        modifiers.insert(normalize_modifier(modifier)?);
    }

    let normalized_key = normalize_key(key)?;
    let mut ordered = Vec::new();
    for modifier in ["Mod", "Alt", "Shift"] {
        if modifiers.contains(modifier) {
            ordered.push(modifier.to_string());
        }
    }

    if ordered.is_empty() {
        return Err(format!("Shortcut must include at least one supported modifier: {raw}"));
    }

    ordered.push(normalized_key);
    Ok(ordered.join("-"))
}

fn normalize_modifier(raw: &str) -> std::result::Result<&'static str, String> {
    match raw.trim().to_ascii_lowercase().as_str() {
        "mod" | "cmd" | "command" | "meta" | "ctrl" | "control" => Ok("Mod"),
        "alt" | "option" => Ok("Alt"),
        "shift" => Ok("Shift"),
        other => Err(format!("Unsupported modifier: {other}")),
    }
}

fn normalize_key(raw: &str) -> std::result::Result<String, String> {
    let key = raw.trim();
    if key.is_empty() {
        return Err("Shortcut key cannot be empty".to_string());
    }

    if key.len() == 1 {
        let ch = key
            .chars()
            .next()
            .ok_or_else(|| "Shortcut key cannot be empty".to_string())?;
        if ch.is_ascii_alphanumeric() {
            return Ok(ch.to_ascii_lowercase().to_string());
        }
    }

    match key.to_ascii_lowercase().as_str() {
        "enter" => Ok("Enter".to_string()),
        "space" => Ok("Space".to_string()),
        "tab" => Ok("Tab".to_string()),
        "escape" | "esc" => Ok("Escape".to_string()),
        "backspace" => Ok("Backspace".to_string()),
        "delete" => Ok("Delete".to_string()),
        "arrowup" => Ok("ArrowUp".to_string()),
        "arrowdown" => Ok("ArrowDown".to_string()),
        "arrowleft" => Ok("ArrowLeft".to_string()),
        "arrowright" => Ok("ArrowRight".to_string()),
        other => Err(format!("Unsupported key: {other}")),
    }
}

#[cfg(test)]
mod tests {
    use super::{
        default_app_keymap_settings, load_app_keymap_settings, save_app_keymap_settings,
        validate_app_keymap_settings, AppKeymapSettings, EditorKeymapSettings,
        GeneralKeymapSettings, ManagedKeymapSections,
    };
    use tempfile::TempDir;

    #[test]
    fn app_keymap_settings_roundtrip_through_app_toml() {
        let temp_dir = TempDir::new().expect("temp dir");
        let settings = AppKeymapSettings {
            keymaps: ManagedKeymapSections {
                general: GeneralKeymapSettings {
                    save_note: "Alt-s".to_string(),
                },
                editor: EditorKeymapSettings {
                    undo: "Alt-z".to_string(),
                    redo: "Alt-Shift-z".to_string(),
                },
            },
        };

        save_app_keymap_settings(temp_dir.path(), &settings).expect("save settings");
        let loaded = load_app_keymap_settings(temp_dir.path()).expect("load settings");

        assert_eq!(loaded, settings);
    }

    #[test]
    fn app_keymap_settings_default_when_file_missing() {
        let temp_dir = TempDir::new().expect("temp dir");

        let loaded = load_app_keymap_settings(temp_dir.path()).expect("load defaults");

        assert_eq!(loaded, default_app_keymap_settings());
    }

    #[test]
    fn app_keymap_settings_validation_rejects_duplicate_shortcuts() {
        let duplicate = AppKeymapSettings {
            keymaps: ManagedKeymapSections {
                general: GeneralKeymapSettings {
                    save_note: "Mod-s".to_string(),
                },
                editor: EditorKeymapSettings {
                    undo: "Mod-s".to_string(),
                    redo: "Mod-Shift-z".to_string(),
                },
            },
        };

        let result = validate_app_keymap_settings(&duplicate);

        assert!(result.is_err());
    }
}
