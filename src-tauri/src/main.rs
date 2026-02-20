// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tracing::info;

fn main() {
    // Initialize tracing for logging
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive(tracing::Level::INFO.into())
        )
        .init();

    info!("Starting Knot application");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Initialize application state
            knot::commands::init_app(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Vault commands
            knot::commands::vault::greet,
            knot::commands::vault::create_vault,
            knot::commands::vault::open_vault,
            knot::commands::vault::open_vault_dialog,
            knot::commands::vault::create_vault_dialog,
            knot::commands::vault::close_vault,
            knot::commands::vault::get_vault_info,
            knot::commands::vault::is_vault_open,
            knot::commands::vault::get_recent_notes,
            knot::commands::vault::get_recent_vaults,
            knot::commands::vault::add_recent_vault,
            knot::commands::vault::sync_external_changes,

            // Note commands
            knot::commands::notes::list_notes,
            knot::commands::notes::get_note,
            knot::commands::notes::save_note,
            knot::commands::notes::delete_note,
            knot::commands::notes::rename_note,
            knot::commands::notes::create_note,
            knot::commands::notes::get_graph_layout,
            knot::commands::notes::get_explorer_tree,
            knot::commands::notes::set_folder_expanded,
            knot::commands::notes::create_directory,
            knot::commands::notes::delete_directory,
            knot::commands::notes::rename_directory,

            // Search commands
            knot::commands::search::search_notes,
            knot::commands::search::search_suggestions,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Knot application");
}
