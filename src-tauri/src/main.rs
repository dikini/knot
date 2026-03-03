// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::mpsc::channel;
use std::time::Duration;
use tauri::{Listener, Manager};
use tracing::info;

fn load_ui_automation_settings() -> knot::app_config::UiAutomationSettings {
    knot::app_config::app_config_root()
        .ok()
        .and_then(|root| knot::app_config::load_ui_automation_settings(&root).ok())
        .unwrap_or_default()
}

fn ui_automation_disabled_result(seq: u64) -> knot::ipc::AppCommandResult {
    knot::ipc::AppCommandResult {
        success: false,
        message: "UI automation is disabled in app settings".to_string(),
        seq: Some(seq),
        error_code: Some("UI_AUTOMATION_DISABLED".to_string()),
        payload: None,
    }
}

fn ui_automation_group_disabled_result(seq: u64, group: &str) -> knot::ipc::AppCommandResult {
    knot::ipc::AppCommandResult {
        success: false,
        message: format!("UI automation group is disabled: {group}"),
        seq: Some(seq),
        error_code: Some("UI_AUTOMATION_GROUP_DISABLED".to_string()),
        payload: None,
    }
}

fn init_tracing() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive(tracing::Level::INFO.into()),
        )
        .init();
}

fn apply_ui_runtime_env(
    config: &knot::launcher::LauncherConfig,
    paths: &knot::launcher::LauncherPaths,
) {
    let socket_path = knot::launcher::socket_path(config, paths);
    match config.ui_mode {
        knot::launcher::UiRuntimeMode::DaemonIpc => {
            std::env::set_var("KNOT_UI_RUNTIME_MODE", "daemon_ipc");
            std::env::set_var("KNOTD_SOCKET_PATH", socket_path);
        }
        knot::launcher::UiRuntimeMode::Embedded => {
            std::env::remove_var("KNOT_UI_RUNTIME_MODE");
            if std::env::var("KNOTD_SOCKET_PATH").is_err() {
                std::env::set_var("KNOTD_SOCKET_PATH", socket_path);
            }
        }
    }
}

fn run_bundled_knotd(
    config: &knot::launcher::LauncherConfig,
    paths: &knot::launcher::LauncherPaths,
) -> knot::Result<i32> {
    let knotd_bin = knot::launcher::resolve_knotd_binary()?;
    let socket_path = knot::launcher::socket_path(config, paths);
    let vault_path = knot::launcher::ensure_vault_path(config)?;
    let status = std::process::Command::new(knotd_bin)
        .arg("--listen-unix")
        .arg(socket_path)
        .arg("--vault")
        .arg(vault_path)
        .stdin(std::process::Stdio::inherit())
        .stdout(std::process::Stdio::inherit())
        .stderr(std::process::Stdio::inherit())
        .status()?;
    Ok(status.code().unwrap_or(1))
}

fn ensure_daemon_for_ui(
    config: &mut knot::launcher::LauncherConfig,
    paths: &knot::launcher::LauncherPaths,
) -> knot::Result<Option<std::process::Child>> {
    if !knot::launcher::ui_should_use_daemon(config) {
        apply_ui_runtime_env(config, paths);
        return Ok(None);
    }

    let socket_path = knot::launcher::socket_path(config, paths);
    if knot::launcher::is_socket_reachable(&socket_path) {
        config.ui_mode = knot::launcher::UiRuntimeMode::DaemonIpc;
        apply_ui_runtime_env(config, paths);
        return Ok(None);
    }

    let mut child = knot::launcher::spawn_knotd(config, paths)?;
    if let Err(error) = knot::launcher::wait_for_socket(&socket_path, Duration::from_secs(10)) {
        let _ = child.kill();
        return Err(error);
    }
    config.ui_mode = knot::launcher::UiRuntimeMode::DaemonIpc;
    apply_ui_runtime_env(config, paths);
    Ok(Some(child))
}

fn handle_launcher_command() -> knot::Result<Option<i32>> {
    let args = std::env::args().collect::<Vec<_>>();
    let mode = knot::launcher::parse_launcher_args(&args)?;
    let (mut config, paths) = knot::launcher::launcher_config_and_paths()?;

    match mode {
        knot::launcher::LauncherMode::Help => {
            println!("{}", knot::launcher::command_help());
            Ok(Some(0))
        }
        knot::launcher::LauncherMode::Service(command) => match command {
            knot::launcher::LauncherServiceCommand::Install { dry_run } => {
                let appimage_path = knot::launcher::current_appimage_or_exe()?;
                let artifacts =
                    knot::launcher::install_service(&mut config, &paths, &appimage_path, dry_run)?;
                if dry_run {
                    println!("[dry-run] wrapper -> {}", paths.wrapper_path.display());
                    println!("{}", artifacts.wrapper_script);
                    println!("[dry-run] env -> {}", paths.env_path.display());
                    println!("{}", artifacts.env_file);
                    println!("[dry-run] unit -> {}", paths.unit_path.display());
                    println!("{}", artifacts.unit_file);
                } else {
                    println!("Installed knot wrapper: {}", paths.wrapper_path.display());
                    println!("Installed knotd unit: {}", paths.unit_path.display());
                    println!("Next: systemctl --user enable --now knotd");
                }
                Ok(Some(0))
            }
            knot::launcher::LauncherServiceCommand::Uninstall { purge } => {
                knot::launcher::uninstall_service(&paths, purge)?;
                println!("Removed user service artifacts for knotd");
                Ok(Some(0))
            }
            knot::launcher::LauncherServiceCommand::Start => {
                knot::launcher::run_systemctl_user(["start", "knotd.service"])?;
                println!("Started knotd.service");
                Ok(Some(0))
            }
            knot::launcher::LauncherServiceCommand::Stop => {
                knot::launcher::run_systemctl_user(["stop", "knotd.service"])?;
                println!("Stopped knotd.service");
                Ok(Some(0))
            }
            knot::launcher::LauncherServiceCommand::Restart => {
                knot::launcher::run_systemctl_user(["restart", "knotd.service"])?;
                println!("Restarted knotd.service");
                Ok(Some(0))
            }
            knot::launcher::LauncherServiceCommand::Status => {
                println!("{}", knot::launcher::service_status_summary(&config, &paths));
                Ok(Some(0))
            }
        },
        knot::launcher::LauncherMode::Knotd { .. } => Ok(Some(run_bundled_knotd(&config, &paths)?)),
        knot::launcher::LauncherMode::Down => {
            println!("{}", knot::launcher::down_summary(&paths)?);
            Ok(Some(0))
        }
        knot::launcher::LauncherMode::Mcp(command) => match command {
            knot::launcher::LauncherMcpCommand::Bridge => {
                Ok(Some(knot::launcher::run_mcp_bridge(&config, &paths)?))
            }
            knot::launcher::LauncherMcpCommand::Status => {
                println!("{}", knot::launcher::mcp_status_summary(&config, &paths));
                Ok(Some(0))
            }
            knot::launcher::LauncherMcpCommand::SocketPath => {
                println!("{}", knot::launcher::socket_path(&config, &paths).display());
                Ok(Some(0))
            }
            knot::launcher::LauncherMcpCommand::CodexInstall => {
                let command_path = knot::launcher::codex_command_path(&paths)?;
                println!("{}", knot::launcher::install_codex_mcp(&paths, &command_path)?);
                Ok(Some(0))
            }
            knot::launcher::LauncherMcpCommand::CodexUninstall => {
                println!("{}", knot::launcher::uninstall_codex_mcp(&paths)?);
                Ok(Some(0))
            }
        },
        knot::launcher::LauncherMode::Up => {
            let child = ensure_daemon_for_ui(&mut config, &paths)?;
            if let Some(mut child) = child {
                let ui_result = run_tauri_app();
                let _ = child.kill();
                return ui_result.map(|_| Some(0));
            }
            Ok(None)
        }
        knot::launcher::LauncherMode::Ui => {
            let child = ensure_daemon_for_ui(&mut config, &paths)?;
            if let Some(mut child) = child {
                let ui_result = run_tauri_app();
                let _ = child.kill();
                return ui_result.map(|_| Some(0));
            }
            Ok(None)
        }
    }
}

fn run_tauri_app() -> knot::Result<Option<i32>> {

    info!("Starting Knot application");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Initialize application state
            knot::commands::init_app(app)?;

            let app_handle = app.handle().clone();
            let (dispatch_tx, dispatch_rx) = channel::<knot::ipc::IpcDispatchRequest>();
            let ui_socket_path = knot::ui_automation::ui_automation_socket_path();
            let ui_server = knot::ipc::IpcServer::new(ui_socket_path, dispatch_tx);
            ui_server.start()?;

            let dispatch_handle = app.handle().clone();
            std::thread::spawn(move || {
                while let Ok(request) = dispatch_rx.recv() {
                    let state = dispatch_handle.state::<knot::state::AppState>();
                    let response_tx = request.response_tx.clone();
                    let envelope = request.envelope;
                    let request_id = format!("ui-automation-{}", envelope.seq);
                    let policy = load_ui_automation_settings();

                    match envelope.command {
                        knot::app_command::AppCommand::Ui(knot::app_command::UiCommand::ListAutomationActions) => {
                            if !policy.enabled {
                                let _ = response_tx.send(ui_automation_disabled_result(envelope.seq));
                                continue;
                            }
                            let actions = tauri::async_runtime::block_on(state.ui_automation().actions());
                            let actions = actions
                                .into_iter()
                                .map(|mut action| {
                                    action.available = action.available && policy.groups.navigation;
                                    action
                                })
                                .collect::<Vec<_>>();
                            let _ = response_tx.send(knot::ipc::AppCommandResult {
                                success: true,
                                message: "ok".to_string(),
                                seq: Some(envelope.seq),
                                error_code: None,
                                payload: Some(serde_json::to_value(actions).unwrap_or_else(|_| serde_json::json!([]))),
                            });
                        }
                        knot::app_command::AppCommand::Ui(knot::app_command::UiCommand::ListAutomationViews) => {
                            if !policy.enabled {
                                let _ = response_tx.send(ui_automation_disabled_result(envelope.seq));
                                continue;
                            }
                            let views = tauri::async_runtime::block_on(state.ui_automation().views());
                            let views = views
                                .into_iter()
                                .map(|mut view| {
                                    view.screenshotable = view.screenshotable && policy.groups.screenshots;
                                    view
                                })
                                .collect::<Vec<_>>();
                            let _ = response_tx.send(knot::ipc::AppCommandResult {
                                success: true,
                                message: "ok".to_string(),
                                seq: Some(envelope.seq),
                                error_code: None,
                                payload: Some(serde_json::to_value(views).unwrap_or_else(|_| serde_json::json!([]))),
                            });
                        }
                        knot::app_command::AppCommand::Ui(
                            knot::app_command::UiCommand::ListAutomationBehaviors,
                        ) => {
                            if !policy.enabled {
                                let _ = response_tx.send(ui_automation_disabled_result(envelope.seq));
                                continue;
                            }
                            let behaviors = tauri::async_runtime::block_on(state.ui_automation().behaviors());
                            let behaviors = behaviors
                                .into_iter()
                                .map(|mut behavior| {
                                    behavior.available = behavior.available && policy.groups.behaviors;
                                    behavior
                                })
                                .collect::<Vec<_>>();
                            let _ = response_tx.send(knot::ipc::AppCommandResult {
                                success: true,
                                message: "ok".to_string(),
                                seq: Some(envelope.seq),
                                error_code: None,
                                payload: Some(
                                    serde_json::to_value(behaviors)
                                        .unwrap_or_else(|_| serde_json::json!([])),
                                ),
                            });
                        }
                        knot::app_command::AppCommand::Ui(knot::app_command::UiCommand::GetAutomationState) => {
                            if !policy.enabled {
                                let _ = response_tx.send(ui_automation_disabled_result(envelope.seq));
                                continue;
                            }
                            let snapshot = tauri::async_runtime::block_on(state.ui_automation().snapshot());
                            let _ = response_tx.send(knot::ipc::AppCommandResult {
                                success: true,
                                message: "ok".to_string(),
                                seq: Some(envelope.seq),
                                error_code: None,
                                payload: Some(
                                    serde_json::to_value(snapshot).unwrap_or_else(|_| serde_json::json!({})),
                                ),
                            });
                        }
                        knot::app_command::AppCommand::Ui(knot::app_command::UiCommand::InvokeAutomationAction {
                            action_id,
                            args,
                        }) => {
                            if !policy.enabled {
                                let _ = response_tx.send(ui_automation_disabled_result(envelope.seq));
                                continue;
                            }
                            if !policy.groups.navigation {
                                let _ = response_tx.send(ui_automation_group_disabled_result(
                                    envelope.seq,
                                    "navigation",
                                ));
                                continue;
                            }
                            tauri::async_runtime::block_on(
                                state
                                    .ui_automation()
                                    .register_pending_invoke(request_id.clone(), response_tx),
                            );
                            if let Err(err) = knot::commands::ui_automation::dispatch_frontend_request(
                                &dispatch_handle,
                                knot::ui_automation::UiAutomationFrontendRequest::InvokeAction {
                                    request_id: request_id.clone(),
                                    action_id,
                                    args,
                                },
                            ) {
                                let _ = tauri::async_runtime::block_on(state.ui_automation().complete_request(
                                    &request_id,
                                    knot::ui_automation::UiAutomationCompletion {
                                        success: false,
                                        message: err,
                                        payload: None,
                                        error_code: Some("UI_ACTION_EXECUTION_FAILED".to_string()),
                                    },
                                ));
                            }
                        }
                        knot::app_command::AppCommand::Ui(
                            knot::app_command::UiCommand::InvokeAutomationBehavior { behavior_id, args },
                        ) => {
                            if !policy.enabled {
                                let _ = response_tx.send(ui_automation_disabled_result(envelope.seq));
                                continue;
                            }
                            if !policy.groups.behaviors {
                                let _ = response_tx.send(ui_automation_group_disabled_result(
                                    envelope.seq,
                                    "behaviors",
                                ));
                                continue;
                            }
                            tauri::async_runtime::block_on(
                                state
                                    .ui_automation()
                                    .register_pending_behavior(request_id.clone(), response_tx),
                            );
                            if let Err(err) = knot::commands::ui_automation::dispatch_frontend_request(
                                &dispatch_handle,
                                knot::ui_automation::UiAutomationFrontendRequest::InvokeBehavior {
                                    request_id: request_id.clone(),
                                    behavior_id,
                                    args,
                                },
                            ) {
                                let _ = tauri::async_runtime::block_on(state.ui_automation().complete_request(
                                    &request_id,
                                    knot::ui_automation::UiAutomationCompletion {
                                        success: false,
                                        message: err,
                                        payload: None,
                                        error_code: Some("UI_ACTION_EXECUTION_FAILED".to_string()),
                                    },
                                ));
                            }
                        }
                        knot::app_command::AppCommand::Ui(
                            knot::app_command::UiCommand::CaptureAutomationScreenshot { target, target_id, name },
                        ) => {
                            if !policy.enabled {
                                let _ = response_tx.send(ui_automation_disabled_result(envelope.seq));
                                continue;
                            }
                            if !policy.groups.screenshots {
                                let _ = response_tx.send(ui_automation_group_disabled_result(
                                    envelope.seq,
                                    "screenshots",
                                ));
                                continue;
                            }
                            let snapshot = tauri::async_runtime::block_on(state.ui_automation().snapshot());
                            let capture_result = if target == "window"
                                && target_id
                                    .as_deref()
                                    .map(|id| id == "window.main")
                                    .unwrap_or(true)
                            {
                                knot::commands::ui_automation::capture_window_screenshot(&dispatch_handle, name)
                            } else if target == "view" {
                                match target_id.as_deref() {
                                    Some(view_id) => match snapshot.view_frames.get(view_id) {
                                        Some(frame) => knot::commands::ui_automation::capture_view_screenshot(
                                            &dispatch_handle,
                                            view_id,
                                            frame,
                                            snapshot.window_pixel_ratio,
                                            name,
                                        ),
                                        None => Err(format!("Unknown or non-visible screenshot target: {view_id}")),
                                    },
                                    None => Err("View screenshot capture requires a target_id".to_string()),
                                }
                            } else {
                                Err(format!("Unsupported screenshot target kind: {target}"))
                            };

                            match capture_result {
                                Ok(payload) => {
                                    let _ = response_tx.send(knot::ipc::AppCommandResult {
                                        success: true,
                                        message: "ok".to_string(),
                                        seq: Some(envelope.seq),
                                        error_code: None,
                                        payload: Some(payload),
                                    });
                                }
                                Err(err) => {
                                    let _ = response_tx.send(knot::ipc::AppCommandResult {
                                        success: false,
                                        message: err,
                                        seq: Some(envelope.seq),
                                        error_code: Some("UI_CAPTURE_UNSUPPORTED".to_string()),
                                        payload: None,
                                    });
                                }
                            }
                        }
                        other => {
                            let _ = response_tx.send(knot::ipc::AppCommandResult {
                                success: false,
                                message: format!("Unsupported UI IPC command: {:?}", other),
                                seq: Some(envelope.seq),
                                error_code: Some("UI_COMMAND_UNSUPPORTED".to_string()),
                                payload: None,
                            });
                        }
                    }
                }
            });

            // Preferred path: show window when frontend signals it finished initial render.
            app.listen("frontend://ready", move |_event| {
                if let Some(window) = app_handle.get_webview_window("main") {
                    if let Err(err) = window.show() {
                        tracing::warn!("Failed to show main window on frontend ready: {err}");
                    }
                }
            });

            // Safety fallback: never keep app invisible if frontend event fails.
            let fallback_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(Duration::from_millis(2500)).await;
                if let Some(window) = fallback_handle.get_webview_window("main") {
                    if let Err(err) = window.show() {
                        tracing::warn!("Failed to show main window from startup fallback: {err}");
                    }
                }
            });
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
            knot::commands::vault::set_unsaved_changes,
            knot::commands::vault::get_vault_settings,
            knot::commands::vault::list_vault_plugins,
            knot::commands::vault::update_vault_settings,
            knot::commands::vault::get_app_keymap_settings,
            knot::commands::vault::update_app_keymap_settings,
            knot::commands::vault::get_ui_automation_settings,
            knot::commands::vault::update_ui_automation_settings,
            knot::commands::vault::reindex_vault,
            // Note commands
            knot::commands::notes::list_notes,
            knot::commands::notes::get_note,
            knot::commands::notes::read_note_media_base64,
            knot::commands::notes::save_note,
            knot::commands::notes::delete_note,
            knot::commands::notes::rename_note,
            knot::commands::notes::create_note,
            knot::commands::notes::create_youtube_note,
            knot::commands::notes::get_graph_layout,
            knot::commands::notes::get_explorer_tree,
            knot::commands::notes::set_folder_expanded,
            knot::commands::notes::create_directory,
            knot::commands::notes::delete_directory,
            knot::commands::notes::rename_directory,
            // Search commands
            knot::commands::search::search_notes,
            knot::commands::search::search_suggestions,
            knot::commands::ui_automation::ui_automation_sync_registry,
            knot::commands::ui_automation::ui_automation_sync_state,
            knot::commands::ui_automation::ui_automation_complete_request,
        ])
        .run(tauri::generate_context!())
        .map_err(|error| knot::KnotError::Other(format!("error while running Knot application: {error}")))?;
    Ok(Some(0))
}

fn main() {
    init_tracing();

    match handle_launcher_command() {
        Ok(Some(code)) => std::process::exit(code),
        Ok(None) => {
            if let Err(error) = run_tauri_app() {
                eprintln!("{error}");
                std::process::exit(1);
            }
        }
        Err(error) => {
            eprintln!("{error}");
            std::process::exit(1);
        }
    }
}
