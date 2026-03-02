//! IPC module for cross-process communication via Unix domain sockets
//!
//! This allows the MCP server to send commands to the running BotPane Qt app.

use crate::app_command::{AppCommand, UiCommand};
use crate::error::{Result, VaultError};
use crate::event_log::{CommandEvent, EventLog};
use serde::{Deserialize, Serialize};
use std::io::{Read, Write};
use std::os::unix::net::{UnixListener, UnixStream};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{Receiver, Sender};
use std::thread;

/// Socket path for IPC
pub const DEFAULT_SOCKET_PATH: &str = "/tmp/knotd.sock";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppCommandEnvelope {
    pub seq: u64,
    pub request_id: Option<String>,
    pub command: AppCommand,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppCommandResult {
    pub success: bool,
    pub message: String,
    pub seq: Option<u64>,
    pub error_code: Option<String>,
    pub payload: Option<serde_json::Value>,
}

pub struct IpcDispatchRequest {
    pub envelope: AppCommandEnvelope,
    pub response_tx: Sender<AppCommandResult>,
}

/// IPC message types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum IpcMessage {
    /// Command from MCP to Qt
    Command(AppCommandEnvelope),
    /// Response from Qt to MCP
    Response(AppCommandResult),
    /// Ping to check if server is alive
    Ping,
    /// Pong response
    Pong,
}

/// IPC Server (runs in BotPane Qt app)
pub struct IpcServer {
    socket_path: PathBuf,
    dispatch_sender: Sender<IpcDispatchRequest>,
    next_seq: AtomicU64,
    event_log: Option<EventLog>,
}

impl IpcServer {
    /// Create a new IPC server
    pub fn new(socket_path: impl Into<PathBuf>, dispatch_sender: Sender<IpcDispatchRequest>) -> Self {
        let socket_path = socket_path.into();
        let event_log = Self::build_event_log(&socket_path);
        let recovered_seq = event_log.as_ref().map(EventLog::last_seq).unwrap_or(0);

        Self {
            socket_path,
            dispatch_sender,
            next_seq: AtomicU64::new(recovered_seq),
            event_log,
        }
    }

    /// Start the server in a background thread
    pub fn start(self) -> Result<()> {
        // Remove old socket if it exists
        if self.socket_path.exists() {
            std::fs::remove_file(&self.socket_path).map_err(|e| VaultError::Io(e.to_string()))?;
        }

        let listener = UnixListener::bind(&self.socket_path)
            .map_err(|e| VaultError::Other(format!("Failed to bind socket: {}", e)))?;

        thread::spawn(move || {
            tracing::info!("IPC server started on {:?}", self.socket_path);

            for stream in listener.incoming() {
                match stream {
                    Ok(mut stream) => {
                        if let Err(e) = Self::handle_connection(
                            &mut stream,
                            &self.dispatch_sender,
                            &self.next_seq,
                            &self.event_log,
                        ) {
                            tracing::error!("Error handling IPC connection: {}", e);
                        }
                    }
                    Err(e) => {
                        tracing::error!("IPC connection error: {}", e);
                    }
                }
            }
        });

        Ok(())
    }

    fn handle_connection(
        stream: &mut UnixStream,
        dispatch_sender: &Sender<IpcDispatchRequest>,
        next_seq: &AtomicU64,
        event_log: &Option<EventLog>,
    ) -> Result<()> {
        let mut buffer = [0u8; 4096];
        let bytes_read = stream
            .read(&mut buffer)
            .map_err(|e| VaultError::Io(e.to_string()))?;

        if bytes_read == 0 {
            return Ok(());
        }

        let message: IpcMessage = serde_json::from_slice(&buffer[..bytes_read])
            .map_err(|e| VaultError::Json(e.to_string()))?;

        let response = match message {
            IpcMessage::Command(envelope) => {
                tracing::debug!("Received command via IPC: {:?}", envelope.command);
                let seq = next_seq.fetch_add(1, Ordering::Relaxed) + 1;
                let request_id = envelope.request_id.clone();
                Self::append_accepted_event(event_log, seq, request_id, &envelope.command);
                let queued = AppCommandEnvelope {
                    seq,
                    request_id: envelope.request_id,
                    command: envelope.command,
                };
                let (response_tx, response_rx): (Sender<AppCommandResult>, Receiver<AppCommandResult>) =
                    std::sync::mpsc::channel();

                match dispatch_sender.send(IpcDispatchRequest {
                    envelope: queued,
                    response_tx,
                }) {
                    Ok(_) => match response_rx.recv_timeout(std::time::Duration::from_secs(10)) {
                        Ok(mut result) => {
                            if result.seq.is_none() {
                                result.seq = Some(seq);
                            }
                            IpcMessage::Response(result)
                        }
                        Err(e) => IpcMessage::Response(AppCommandResult {
                            success: false,
                            message: format!("Timed out waiting for command result: {}", e),
                            seq: Some(seq),
                            error_code: Some("IPC_COMMAND_TIMEOUT".to_string()),
                            payload: None,
                        }),
                    },
                    Err(e) => IpcMessage::Response(AppCommandResult {
                        success: false,
                        message: format!("Failed to dispatch command: {}", e),
                        seq: Some(seq),
                        error_code: Some("IPC_DISPATCH_SEND_FAILED".to_string()),
                        payload: None,
                    }),
                }
            }
            IpcMessage::Ping => IpcMessage::Pong,
            other => IpcMessage::Response(AppCommandResult {
                success: false,
                message: format!("Unexpected message: {:?}", other),
                seq: None,
                error_code: Some("IPC_UNEXPECTED_MESSAGE".to_string()),
                payload: None,
            }),
        };

        let response_bytes =
            serde_json::to_vec(&response).map_err(|e| VaultError::Json(e.to_string()))?;

        stream
            .write_all(&response_bytes)
            .map_err(|e| VaultError::Io(e.to_string()))?;

        Ok(())
    }

    fn build_event_log(socket_path: &Path) -> Option<EventLog> {
        let socket_parent = socket_path.parent();
        let vault_root = socket_parent
            .and_then(EventLog::discover_vault_root)
            .or_else(|| {
                std::env::current_dir()
                    .ok()
                    .and_then(EventLog::discover_vault_root)
            });

        let vault_root = vault_root?;

        match EventLog::from_vault_root(vault_root) {
            Ok(log) => Some(log),
            Err(err) => {
                tracing::warn!("Unable to initialize IPC event log: {}", err);
                None
            }
        }
    }

    fn append_accepted_event(
        event_log: &Option<EventLog>,
        seq: u64,
        request_id: Option<String>,
        command: &AppCommand,
    ) {
        let Some(log) = event_log else {
            return;
        };

        let event = CommandEvent {
            seq,
            timestamp_ms: Self::current_timestamp_ms(),
            request_id,
            command_kind: Self::command_kind(command),
            target: Self::command_target(command),
            status: "accepted".to_string(),
            message: "Command accepted by IPC ingress".to_string(),
        };

        if let Err(err) = log.append(&event) {
            tracing::warn!("Failed to append IPC accepted event: {}", err);
        }
    }

    fn current_timestamp_ms() -> i64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.as_millis() as i64)
            .unwrap_or_default()
    }

    fn command_kind(command: &AppCommand) -> String {
        match command {
            AppCommand::Ui(ui_command) => match ui_command {
                UiCommand::OpenNewVaultDialog => "ui.open_new_vault_dialog".to_string(),
                UiCommand::OpenNewNoteDialog => "ui.open_new_note_dialog".to_string(),
                UiCommand::OpenDeleteDialog { .. } => "ui.open_delete_dialog".to_string(),
                UiCommand::OpenRenameDialog { .. } => "ui.open_rename_dialog".to_string(),
                UiCommand::OpenPluginManagerDialog => "ui.open_plugin_manager_dialog".to_string(),
                UiCommand::OpenLoadPluginDialog => "ui.open_load_plugin_dialog".to_string(),
                UiCommand::FillField { .. } => "ui.fill_field".to_string(),
                UiCommand::ClickButton { .. } => "ui.click_button".to_string(),
                UiCommand::SelectNote { .. } => "ui.select_note".to_string(),
                UiCommand::SwitchPanel { .. } => "ui.switch_panel".to_string(),
                UiCommand::ShowNotification { .. } => "ui.show_notification".to_string(),
                UiCommand::SetWindowState { .. } => "ui.set_window_state".to_string(),
                UiCommand::TakeScreenshot { .. } => "ui.take_screenshot".to_string(),
                UiCommand::ListAutomationActions => "ui.list_automation_actions".to_string(),
                UiCommand::ListAutomationViews => "ui.list_automation_views".to_string(),
                UiCommand::GetAutomationState => "ui.get_automation_state".to_string(),
                UiCommand::InvokeAutomationAction { .. } => "ui.invoke_automation_action".to_string(),
                UiCommand::CaptureAutomationScreenshot { .. } => {
                    "ui.capture_automation_screenshot".to_string()
                }
            },
            AppCommand::Resource(_) => "resource".to_string(),
            AppCommand::Settings(_) => "settings".to_string(),
        }
    }

    fn command_target(command: &AppCommand) -> Option<String> {
        match command {
            AppCommand::Ui(ui_command) => match ui_command {
                UiCommand::OpenDeleteDialog { path } => Some(path.clone()),
                UiCommand::OpenRenameDialog { path } => Some(path.clone()),
                UiCommand::FillField { field, .. } => Some(field.clone()),
                UiCommand::ClickButton { button } => Some(button.clone()),
                UiCommand::SelectNote { path } => Some(path.clone()),
                UiCommand::SwitchPanel { panel } => Some(panel.clone()),
                UiCommand::TakeScreenshot { name } => Some(name.clone()),
                UiCommand::InvokeAutomationAction { action_id, .. } => Some(action_id.clone()),
                UiCommand::CaptureAutomationScreenshot { target, target_id, .. } => {
                    target_id.clone().or_else(|| Some(target.clone()))
                }
                UiCommand::OpenNewVaultDialog
                | UiCommand::OpenNewNoteDialog
                | UiCommand::OpenPluginManagerDialog
                | UiCommand::OpenLoadPluginDialog
                | UiCommand::ShowNotification { .. }
                | UiCommand::SetWindowState { .. }
                | UiCommand::ListAutomationActions
                | UiCommand::ListAutomationViews
                | UiCommand::GetAutomationState => None,
            },
            AppCommand::Resource(_) | AppCommand::Settings(_) => None,
        }
    }
}

/// IPC Client (used by MCP server)
#[derive(Clone)]
pub struct IpcClient {
    socket_path: PathBuf,
}

impl IpcClient {
    /// Create a new IPC client
    pub fn new(socket_path: impl Into<PathBuf>) -> Self {
        Self {
            socket_path: socket_path.into(),
        }
    }

    /// Check if server is available
    pub fn ping(&self) -> Result<bool> {
        match self.send_message(IpcMessage::Ping)? {
            IpcMessage::Pong => Ok(true),
            other => Err(VaultError::Other(format!(
                "Unexpected ping response from knotd: {:?}",
                other
            ))),
        }
    }

    /// Send a command to the Qt app
    pub fn send_command(&self, command: AppCommand) -> Result<AppCommandResult> {
        let response = self.send_message(IpcMessage::Command(AppCommandEnvelope {
            seq: 0,
            request_id: None,
            command,
        }))?;

        match response {
            IpcMessage::Response(result) => {
                if result.success {
                    Ok(result)
                } else {
                    let mut err = result.message;
                    if let Some(code) = result.error_code {
                        err = format!("{err} ({code})");
                    }
                    Err(VaultError::Other(err))
                }
            }
            _ => Err(VaultError::Other("Unexpected response".to_string())),
        }
    }

    fn send_message(&self, message: IpcMessage) -> Result<IpcMessage> {
        let mut stream = UnixStream::connect(&self.socket_path).map_err(|e| {
            VaultError::Other(format!(
                "Failed to connect to knotd at {}: {}. Is knotd running?",
                self.socket_path.display(),
                e,
            ))
        })?;

        let message_bytes =
            serde_json::to_vec(&message).map_err(|e| VaultError::Json(e.to_string()))?;

        stream
            .write_all(&message_bytes)
            .map_err(|e| VaultError::Io(e.to_string()))?;

        // Set read timeout
        stream
            .set_read_timeout(Some(std::time::Duration::from_secs(5)))
            .map_err(|e| VaultError::Io(e.to_string()))?;

        let mut buffer = [0u8; 4096];
        let bytes_read = stream
            .read(&mut buffer)
            .map_err(|e| VaultError::Io(e.to_string()))?;

        let response: IpcMessage = serde_json::from_slice(&buffer[..bytes_read])
            .map_err(|e| VaultError::Json(e.to_string()))?;

        Ok(response)
    }
}

/// Global IPC client instance for convenience
static IPC_CLIENT: std::sync::OnceLock<IpcClient> = std::sync::OnceLock::new();

/// Initialize the global IPC client
pub fn init_ipc_client(socket_path: Option<PathBuf>) {
    let path = socket_path.unwrap_or_else(|| PathBuf::from(DEFAULT_SOCKET_PATH));
    let _ = IPC_CLIENT.set(IpcClient::new(path));
}

/// Get the global IPC client
pub fn ipc_client() -> Option<&'static IpcClient> {
    IPC_CLIENT.get()
}

/// Send a command using the global IPC client
pub fn send_command_ipc(command: AppCommand) -> Result<()> {
    if let Some(client) = ipc_client() {
        client.send_command(command)?;
        Ok(())
    } else {
        Err(VaultError::Other("IPC client not initialized".to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::app_command::UiCommand;
    use std::sync::mpsc::channel;
    use std::time::Duration;

    #[test]
    fn test_ipc_communication() {
        let socket_path = format!("/tmp/botpane_test_{}.sock", std::process::id());

        // Create server
        let (tx, rx): (Sender<AppCommand>, std::sync::mpsc::Receiver<AppCommand>) = channel();
        let (dispatch_tx, dispatch_rx): (Sender<IpcDispatchRequest>, std::sync::mpsc::Receiver<IpcDispatchRequest>) =
            channel();
        let server = IpcServer::new(&socket_path, dispatch_tx);
        server.start().unwrap();
        thread::spawn(move || {
            while let Ok(request) = dispatch_rx.recv() {
                tx.send(request.envelope.command).unwrap();
                request
                    .response_tx
                    .send(AppCommandResult {
                        success: true,
                        message: "ok".to_string(),
                        seq: None,
                        error_code: None,
                        payload: None,
                    })
                    .unwrap();
            }
        });

        // Give server time to start
        thread::sleep(Duration::from_millis(100));

        // Create client and send command
        let client = IpcClient::new(&socket_path);

        // Test ping
        assert!(client.ping().unwrap());

        // Test command
        let cmd = AppCommand::Ui(UiCommand::OpenNewVaultDialog);
        let result = client.send_command(cmd.clone());
        assert!(result.is_ok());

        // Verify command was received
        let received = rx.recv_timeout(Duration::from_secs(1));
        assert!(received.is_ok());
        assert!(matches!(
            received.unwrap(),
            AppCommand::Ui(UiCommand::OpenNewVaultDialog)
        ));

        // Cleanup
        let _ = std::fs::remove_file(&socket_path);
    }

    #[test]
    fn test_ipc_response_contains_seq_for_command() {
        let socket_path = format!("/tmp/botpane_test_seq_{}.sock", std::process::id());

        let (dispatch_tx, dispatch_rx): (Sender<IpcDispatchRequest>, std::sync::mpsc::Receiver<IpcDispatchRequest>) =
            channel();
        let server = IpcServer::new(&socket_path, dispatch_tx);
        server.start().unwrap();
        thread::spawn(move || {
            while let Ok(request) = dispatch_rx.recv() {
                request
                    .response_tx
                    .send(AppCommandResult {
                        success: true,
                        message: "ok".to_string(),
                        seq: None,
                        error_code: None,
                        payload: None,
                    })
                    .unwrap();
            }
        });
        thread::sleep(Duration::from_millis(100));

        let client = IpcClient::new(&socket_path);
        let result = client
            .send_command(AppCommand::Ui(UiCommand::OpenNewVaultDialog))
            .unwrap();

        assert!(
            result.seq.unwrap_or(0) > 0,
            "response should include positive sequence number, got: {:?}",
            result
        );

        let _ = std::fs::remove_file(&socket_path);
    }

    #[test]
    fn test_ipc_response_seq_is_monotonic_for_multiple_commands() {
        let socket_path = format!("/tmp/botpane_test_seq_multi_{}.sock", std::process::id());

        let (dispatch_tx, dispatch_rx): (Sender<IpcDispatchRequest>, std::sync::mpsc::Receiver<IpcDispatchRequest>) =
            channel();
        let server = IpcServer::new(&socket_path, dispatch_tx);
        server.start().unwrap();
        thread::spawn(move || {
            while let Ok(request) = dispatch_rx.recv() {
                request
                    .response_tx
                    .send(AppCommandResult {
                        success: true,
                        message: "ok".to_string(),
                        seq: None,
                        error_code: None,
                        payload: None,
                    })
                    .unwrap();
            }
        });
        thread::sleep(Duration::from_millis(100));

        let client = IpcClient::new(&socket_path);
        let first = client
            .send_command(AppCommand::Ui(UiCommand::OpenNewVaultDialog))
            .unwrap();
        let second = client
            .send_command(AppCommand::Ui(UiCommand::OpenNewVaultDialog))
            .unwrap();

        let first_seq = first.seq.unwrap_or(0);
        let second_seq = second.seq.unwrap_or(0);
        assert!(
            second_seq > first_seq,
            "expected monotonic seq values, first: {first_seq}, second: {second_seq}"
        );

        let _ = std::fs::remove_file(&socket_path);
    }

    #[test]
    fn test_global_ipc_client_init() {
        // After init, ipc_client() should return Some
        init_ipc_client(Some(PathBuf::from("/tmp/test_global.sock")));
        assert!(ipc_client().is_some());
    }

    #[test]
    fn tdd_kui_002_default_socket_path_targets_knotd() {
        assert_eq!(DEFAULT_SOCKET_PATH, "/tmp/knotd.sock");
    }

    #[test]
    fn tdd_kui_002_transport_error_mentions_knotd() {
        let missing_socket = format!("/tmp/knotd_missing_{}.sock", std::process::id());
        let client = IpcClient::new(missing_socket);
        let err = client.ping().expect_err("expected transport failure");
        let message = err.to_string().to_lowercase();
        assert!(message.contains("knotd"), "error should reference knotd: {message}");
    }
}
