//! Debug command system for UI automation and testing
//!
//! Provides command types for IPC-based control of the BotPane Qt
//! application's UI elements for debugging, automated testing,
//! and screenshot capture workflows.

use serde::{Deserialize, Serialize};

/// A command to control UI elements for debugging/testing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DebugCommand {
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
}

/// Window state for UI control
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WindowState {
    Normal,
    Maximized,
    Minimized,
    FullScreen,
}

/// Result of executing a debug command
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandResult {
    pub success: bool,
    pub message: String,
}
