use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};

use crate::error::{KnotError, Result};

const APP_CONFIG_FILE: &str = "app-config.toml";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AppKeymapSettings {
    #[serde(default)]
    pub keymaps: ManagedKeymapSections,

    #[serde(default)]
    pub graph: GraphUiSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct UiAutomationSettings {
    #[serde(default)]
    pub enabled: bool,

    #[serde(default)]
    pub groups: UiAutomationGroups,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub struct UiAutomationGroups {
    #[serde(default)]
    pub navigation: bool,

    #[serde(default)]
    pub screenshots: bool,

    #[serde(default)]
    pub behaviors: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
struct AppConfigFile {
    #[serde(flatten)]
    keymap_settings: AppKeymapSettings,

    #[serde(default)]
    ui_automation: UiAutomationSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
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

    #[serde(default = "default_switch_notes_shortcut")]
    pub switch_notes: String,

    #[serde(default = "default_switch_search_shortcut")]
    pub switch_search: String,

    #[serde(default = "default_switch_graph_shortcut")]
    pub switch_graph: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct EditorKeymapSettings {
    #[serde(default = "default_undo_shortcut")]
    pub undo: String,

    #[serde(default = "default_redo_shortcut")]
    pub redo: String,

    #[serde(default = "default_clear_paragraph_shortcut")]
    pub clear_paragraph: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct GraphUiSettings {
    #[serde(default = "default_graph_readability_floor_percent")]
    pub readability_floor_percent: u32,
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

impl Default for GeneralKeymapSettings {
    fn default() -> Self {
        Self {
            save_note: default_save_note_shortcut(),
            switch_notes: default_switch_notes_shortcut(),
            switch_search: default_switch_search_shortcut(),
            switch_graph: default_switch_graph_shortcut(),
        }
    }
}

impl Default for EditorKeymapSettings {
    fn default() -> Self {
        Self {
            undo: default_undo_shortcut(),
            redo: default_redo_shortcut(),
            clear_paragraph: default_clear_paragraph_shortcut(),
        }
    }
}

impl Default for GraphUiSettings {
    fn default() -> Self {
        Self {
            readability_floor_percent: default_graph_readability_floor_percent(),
        }
    }
}

impl Default for UiAutomationSettings {
    fn default() -> Self {
        default_ui_automation_settings()
    }
}

pub fn default_app_keymap_settings() -> AppKeymapSettings {
    AppKeymapSettings {
        keymaps: ManagedKeymapSections::default(),
        graph: GraphUiSettings::default(),
    }
}

pub fn default_ui_automation_settings() -> UiAutomationSettings {
    UiAutomationSettings {
        enabled: false,
        groups: UiAutomationGroups::default(),
    }
}

pub fn load_app_keymap_settings(config_root: &Path) -> Result<AppKeymapSettings> {
    let config = load_app_config_file(config_root)?;
    validate_app_keymap_settings(&config.keymap_settings)?;
    Ok(config.keymap_settings)
}

pub fn save_app_keymap_settings(config_root: &Path, settings: &AppKeymapSettings) -> Result<()> {
    validate_app_keymap_settings(settings)?;
    let mut config = load_app_config_file(config_root)?;
    config.keymap_settings = settings.clone();
    save_app_config_file(config_root, &config)?;
    Ok(())
}

pub fn load_ui_automation_settings(config_root: &Path) -> Result<UiAutomationSettings> {
    let config = load_app_config_file(config_root)?;
    Ok(config.ui_automation)
}

pub fn save_ui_automation_settings(
    config_root: &Path,
    settings: &UiAutomationSettings,
) -> Result<()> {
    let mut config = load_app_config_file(config_root)?;
    config.ui_automation = settings.clone();
    save_app_config_file(config_root, &config)?;
    Ok(())
}

pub fn validate_app_keymap_settings(settings: &AppKeymapSettings) -> Result<()> {
    let mut seen: HashMap<String, &str> = HashMap::new();
    let managed_values = [
        (
            "general.save_note",
            settings.keymaps.general.save_note.as_str(),
        ),
        (
            "general.switch_notes",
            settings.keymaps.general.switch_notes.as_str(),
        ),
        (
            "general.switch_search",
            settings.keymaps.general.switch_search.as_str(),
        ),
        (
            "general.switch_graph",
            settings.keymaps.general.switch_graph.as_str(),
        ),
        ("editor.undo", settings.keymaps.editor.undo.as_str()),
        ("editor.redo", settings.keymaps.editor.redo.as_str()),
        (
            "editor.clear_paragraph",
            settings.keymaps.editor.clear_paragraph.as_str(),
        ),
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

    if !(40..=100).contains(&settings.graph.readability_floor_percent) {
        errors.push(ShortcutValidationError {
            field: "graph.readability_floor_percent".to_string(),
            message: "Graph readability floor must be between 40 and 100".to_string(),
        });
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

pub fn app_config_root() -> Result<PathBuf> {
    let config_dir = dirs::config_dir()
        .ok_or_else(|| KnotError::Config("Could not determine config directory".to_string()))?;
    Ok(config_dir.join("knot"))
}

fn load_app_config_file(config_root: &Path) -> Result<AppConfigFile> {
    let path = app_config_path(config_root);
    if !path.exists() {
        return Ok(AppConfigFile {
            keymap_settings: default_app_keymap_settings(),
            ui_automation: default_ui_automation_settings(),
        });
    }

    let content = std::fs::read_to_string(path)?;
    let config = toml::from_str::<AppConfigFile>(&content)?;
    Ok(config)
}

fn save_app_config_file(config_root: &Path, config: &AppConfigFile) -> Result<()> {
    std::fs::create_dir_all(config_root)?;
    let content = toml::to_string_pretty(config)?;
    std::fs::write(app_config_path(config_root), content)?;
    Ok(())
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

fn default_switch_notes_shortcut() -> String {
    "Mod-1".to_string()
}

fn default_switch_search_shortcut() -> String {
    "Mod-2".to_string()
}

fn default_switch_graph_shortcut() -> String {
    "Mod-3".to_string()
}

fn default_clear_paragraph_shortcut() -> String {
    "Mod-Alt-0".to_string()
}

fn default_graph_readability_floor_percent() -> u32 {
    70
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
        return Err(format!(
            "Shortcut must include at least one supported modifier: {raw}"
        ));
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
        default_app_keymap_settings, default_ui_automation_settings, load_app_keymap_settings,
        load_ui_automation_settings, save_app_keymap_settings, save_ui_automation_settings,
        validate_app_keymap_settings, AppKeymapSettings, EditorKeymapSettings,
        GeneralKeymapSettings, GraphUiSettings, ManagedKeymapSections, UiAutomationGroups,
        UiAutomationSettings,
    };
    use tempfile::TempDir;

    #[test]
    fn app_keymap_settings_roundtrip_through_app_toml() {
        let temp_dir = TempDir::new().expect("temp dir");
        let settings = AppKeymapSettings {
            keymaps: ManagedKeymapSections {
                general: GeneralKeymapSettings {
                    save_note: "Alt-s".to_string(),
                    switch_notes: "Alt-1".to_string(),
                    switch_search: "Alt-2".to_string(),
                    switch_graph: "Alt-3".to_string(),
                },
                editor: EditorKeymapSettings {
                    undo: "Alt-z".to_string(),
                    redo: "Alt-Shift-z".to_string(),
                    clear_paragraph: "Alt-0".to_string(),
                },
            },
            graph: GraphUiSettings {
                readability_floor_percent: 85,
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
    fn app_keymap_settings_include_default_graph_readability_floor() {
        let defaults = default_app_keymap_settings();
        assert_eq!(defaults.graph.readability_floor_percent, 70);
    }

    #[test]
    fn app_keymap_settings_validation_rejects_duplicate_shortcuts() {
        let duplicate = AppKeymapSettings {
            keymaps: ManagedKeymapSections {
                general: GeneralKeymapSettings {
                    save_note: "Mod-s".to_string(),
                    switch_notes: "Mod-1".to_string(),
                    switch_search: "Mod-2".to_string(),
                    switch_graph: "Mod-3".to_string(),
                },
                editor: EditorKeymapSettings {
                    undo: "Mod-s".to_string(),
                    redo: "Mod-Shift-z".to_string(),
                    clear_paragraph: "Mod-Alt-0".to_string(),
                },
            },
            graph: GraphUiSettings::default(),
        };

        let result = validate_app_keymap_settings(&duplicate);

        assert!(result.is_err());
    }

    #[test]
    fn ui_automation_settings_default_when_file_missing() {
        let temp_dir = TempDir::new().expect("temp dir");

        let loaded = load_ui_automation_settings(temp_dir.path()).expect("load defaults");

        assert_eq!(loaded, default_ui_automation_settings());
    }

    #[test]
    fn ui_automation_settings_roundtrip_through_same_app_toml() {
        let temp_dir = TempDir::new().expect("temp dir");
        let settings = UiAutomationSettings {
            enabled: true,
            groups: UiAutomationGroups {
                navigation: true,
                screenshots: false,
                behaviors: true,
            },
        };

        save_ui_automation_settings(temp_dir.path(), &settings).expect("save settings");
        let loaded = load_ui_automation_settings(temp_dir.path()).expect("load settings");

        assert_eq!(loaded, settings);
    }

    #[test]
    fn ui_automation_settings_preserve_keymap_content_in_same_file() {
        let temp_dir = TempDir::new().expect("temp dir");
        let keymaps = AppKeymapSettings {
            keymaps: ManagedKeymapSections {
                general: GeneralKeymapSettings {
                    save_note: "Alt-s".to_string(),
                    switch_notes: "Alt-1".to_string(),
                    switch_search: "Alt-2".to_string(),
                    switch_graph: "Alt-3".to_string(),
                },
                editor: EditorKeymapSettings {
                    undo: "Alt-z".to_string(),
                    redo: "Alt-Shift-z".to_string(),
                    clear_paragraph: "Alt-0".to_string(),
                },
            },
            graph: GraphUiSettings {
                readability_floor_percent: 85,
            },
        };

        save_app_keymap_settings(temp_dir.path(), &keymaps).expect("save keymaps");
        save_ui_automation_settings(
            temp_dir.path(),
            &UiAutomationSettings {
                enabled: true,
                groups: UiAutomationGroups {
                    navigation: true,
                    screenshots: true,
                    behaviors: false,
                },
            },
        )
        .expect("save ui automation settings");

        let reloaded_keymaps = load_app_keymap_settings(temp_dir.path()).expect("reload keymaps");
        assert_eq!(reloaded_keymaps, keymaps);
    }
}
