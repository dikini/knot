//! Tauri command handlers.
//!
//! This module contains all #[tauri::command] functions that are
//! exposed to the frontend. Each command is a thin wrapper around
//! the core business logic.

pub mod vault;
pub mod notes;
pub mod search;

use tauri::Manager;
use tracing::info;

/// Initialize the application state and resources.
///
/// This is called once at application startup.
pub fn init_app(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    info!("initializing Knot application");

    // Initialize the application state
    use crate::state::AppState;
    app.manage(AppState::new());

    info!("Knot application initialized");
    Ok(())
}

/// Emit an event to all windows.
#[allow(dead_code)]
pub fn emit_event<M: Manager<R>, R: tauri::Runtime, S: serde::Serialize>(
    _manager: &M,
    _event: &str,
    _payload: S,
) {
    // TODO: Fix for Tauri 2.0 API
    // if let Err(e) = manager.emit(event, payload) {
    //     tracing::warn!(event, error = ?e, "failed to emit event");
    // }
}
