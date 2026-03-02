//! App command system for UI automation and testing
//!
//! Provides command types for IPC-based control of the BotPane Qt
//! application.

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Root command namespace for app-level IPC commands.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AppCommand {
    Ui(UiCommand),
    Resource(ResourceCommand),
    Settings(SettingsCommand),
}

/// UI command namespace.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum UiCommand {
    /// Open the new vault dialog
    OpenNewVaultDialog,
    /// Open the new note dialog
    OpenNewNoteDialog,
    /// Open the delete confirmation dialog for a note
    OpenDeleteDialog { path: String },
    /// Open the rename dialog for a note
    OpenRenameDialog { path: String },
    /// Open the plugin manager dialog
    OpenPluginManagerDialog,
    /// Open the load plugin dialog
    OpenLoadPluginDialog,
    /// Fill a form field in the currently open dialog
    FillField { field: String, value: String },
    /// Click a button by its identifier
    ClickButton { button: String },
    /// Select a note from the file tree
    SelectNote { path: String },
    /// Switch to a specific sidebar panel
    SwitchPanel { panel: String },
    /// Show a notification popup
    ShowNotification { message: String, is_error: bool },
    /// Set the window visibility state
    SetWindowState { state: WindowState },
    /// Take a screenshot (placeholder for coordination)
    TakeScreenshot { name: String },
    /// List registered automation actions.
    ListAutomationActions,
    /// List registered automation views.
    ListAutomationViews,
    /// List registered automation behaviors.
    ListAutomationBehaviors,
    /// Return compact UI automation state.
    GetAutomationState,
    /// Invoke a semantic UI automation action.
    InvokeAutomationAction { action_id: String, args: Value },
    /// Invoke a semantic UI automation behavior.
    InvokeAutomationBehavior { behavior_id: String, args: Value },
    /// Capture a UI screenshot for a semantic target.
    CaptureAutomationScreenshot {
        target: String,
        target_id: Option<String>,
        name: Option<String>,
    },
}

/// Resource command namespace.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ResourceCommand {
    CreateNote { path: String, content: String },
    UpdateNote { path: String, content: String },
    DeleteNote { path: String },
    MoveNote { from_path: String, to_path: String },
    CreateDirectory { path: String },
    DeleteDirectory { path: String, recursive: bool },
}

/// Settings command namespace.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SettingsCommand {
    UpdateVaultSettings { patch: serde_json::Value },
    UpdateAppSettings { patch: serde_json::Value },
}

/// Window state for UI control
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WindowState {
    Normal,
    Maximized,
    Minimized,
    FullScreen,
}

/// Result of executing an app command
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandResult {
    pub success: bool,
    pub message: String,
    pub payload: Option<Value>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn app_command_serializes_resource_and_settings_variants() {
        let create_note = AppCommand::Resource(ResourceCommand::CreateNote {
            path: "notes/new.md".to_string(),
            content: "# Hello".to_string(),
        });
        assert_eq!(
            serde_json::to_value(&create_note).unwrap(),
            json!({
                "Resource": {
                    "CreateNote": {
                        "path": "notes/new.md",
                        "content": "# Hello"
                    }
                }
            })
        );

        let delete_directory = AppCommand::Resource(ResourceCommand::DeleteDirectory {
            path: "notes/archive".to_string(),
            recursive: true,
        });
        assert_eq!(
            serde_json::to_value(&delete_directory).unwrap(),
            json!({
                "Resource": {
                    "DeleteDirectory": {
                        "path": "notes/archive",
                        "recursive": true
                    }
                }
            })
        );

        let update_vault_settings = AppCommand::Settings(SettingsCommand::UpdateVaultSettings {
            patch: json!({"theme": "solarized"}),
        });
        assert_eq!(
            serde_json::to_value(&update_vault_settings).unwrap(),
            json!({
                "Settings": {
                    "UpdateVaultSettings": {
                        "patch": {
                            "theme": "solarized"
                        }
                    }
                }
            })
        );

        let update_app_settings = AppCommand::Settings(SettingsCommand::UpdateAppSettings {
            patch: json!({"window": {"maximized": true}}),
        });
        assert_eq!(
            serde_json::to_value(&update_app_settings).unwrap(),
            json!({
                "Settings": {
                    "UpdateAppSettings": {
                        "patch": {
                            "window": {
                                "maximized": true
                            }
                        }
                    }
                }
            })
        );
    }
}
