use knot::app_config::{
    default_app_keymap_settings, load_app_keymap_settings, save_app_keymap_settings,
    validate_app_keymap_settings, AppKeymapSettings, GraphUiSettings,
};
use tempfile::TempDir;

#[test]
fn app_keymap_settings_roundtrip_through_app_toml() {
    let temp_dir = TempDir::new().expect("temp dir");
    let settings = AppKeymapSettings {
        keymaps: knot::app_config::ManagedKeymapSections {
            general: knot::app_config::GeneralKeymapSettings {
                save_note: "Alt-s".to_string(),
                switch_notes: "Alt-1".to_string(),
                switch_search: "Alt-2".to_string(),
                switch_graph: "Alt-3".to_string(),
            },
            editor: knot::app_config::EditorKeymapSettings {
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

    assert_eq!(loaded.keymaps.general.save_note, "Alt-s");
    assert_eq!(loaded.keymaps.general.switch_notes, "Alt-1");
    assert_eq!(loaded.keymaps.general.switch_search, "Alt-2");
    assert_eq!(loaded.keymaps.general.switch_graph, "Alt-3");
    assert_eq!(loaded.keymaps.editor.undo, "Alt-z");
    assert_eq!(loaded.keymaps.editor.redo, "Alt-Shift-z");
    assert_eq!(loaded.keymaps.editor.clear_paragraph, "Alt-0");
    assert_eq!(loaded.graph.readability_floor_percent, 85);
}

#[test]
fn app_keymap_settings_default_when_file_missing() {
    let temp_dir = TempDir::new().expect("temp dir");

    let loaded = load_app_keymap_settings(temp_dir.path()).expect("load defaults");

    assert_eq!(
        loaded.keymaps.general.save_note,
        default_app_keymap_settings().keymaps.general.save_note
    );
}

#[test]
fn app_keymap_settings_validation_rejects_duplicate_shortcuts() {
    let duplicate = AppKeymapSettings {
        keymaps: knot::app_config::ManagedKeymapSections {
            general: knot::app_config::GeneralKeymapSettings {
                save_note: "Mod-s".to_string(),
                switch_notes: "Mod-1".to_string(),
                switch_search: "Mod-2".to_string(),
                switch_graph: "Mod-3".to_string(),
            },
            editor: knot::app_config::EditorKeymapSettings {
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
