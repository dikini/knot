use crate::ipc::AppCommandResult;
use base64::Engine;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::{BTreeMap, HashMap};
use std::path::PathBuf;
use std::sync::mpsc::Sender;
use std::sync::Arc;
use tokio::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct UiAutomationAction {
    pub id: String,
    pub label: String,
    pub description: String,
    pub origin: String,
    #[serde(default)]
    pub input_schema: Value,
    #[serde(default)]
    pub available: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct UiAutomationView {
    pub id: String,
    pub label: String,
    pub description: String,
    pub origin: String,
    #[serde(default)]
    pub screenshotable: bool,
    #[serde(default)]
    pub visible: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct UiAutomationViewFrame {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct UiAutomationStateSnapshot {
    pub active_view: String,
    pub active_note_path: Option<String>,
    pub tool_mode: Option<String>,
    #[serde(default)]
    pub inspector_open: bool,
    #[serde(default)]
    pub vault_open: bool,
    #[serde(default)]
    pub view_frames: BTreeMap<String, UiAutomationViewFrame>,
    #[serde(default = "default_window_pixel_ratio")]
    pub window_pixel_ratio: f64,
}

fn default_window_pixel_ratio() -> f64 {
    1.0
}

impl Default for UiAutomationStateSnapshot {
    fn default() -> Self {
        Self {
            active_view: "window.welcome".to_string(),
            active_note_path: None,
            tool_mode: None,
            inspector_open: false,
            vault_open: false,
            view_frames: BTreeMap::new(),
            window_pixel_ratio: 1.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum UiAutomationFrontendRequest {
    InvokeAction {
        request_id: String,
        action_id: String,
        #[serde(default)]
        args: Value,
    },
    CaptureScreenshot {
        request_id: String,
        target: String,
        target_id: Option<String>,
        name: Option<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UiAutomationCompletion {
    pub success: bool,
    pub message: String,
    #[serde(default)]
    pub payload: Option<Value>,
    #[serde(default)]
    pub error_code: Option<String>,
}

struct PendingUiRequest {
    response_tx: Sender<AppCommandResult>,
    kind: PendingUiRequestKind,
}

enum PendingUiRequestKind {
    InvokeAction,
    CaptureScreenshot {
        name: Option<String>,
        target: String,
        target_id: Option<String>,
    },
}

#[derive(Default)]
struct UiAutomationInner {
    actions: Vec<UiAutomationAction>,
    views: Vec<UiAutomationView>,
    snapshot: UiAutomationStateSnapshot,
    pending: HashMap<String, PendingUiRequest>,
}

#[derive(Default, Clone)]
pub struct UiAutomationRuntime {
    inner: Arc<Mutex<UiAutomationInner>>,
}

impl UiAutomationRuntime {
    pub async fn sync_registry(
        &self,
        mut actions: Vec<UiAutomationAction>,
        mut views: Vec<UiAutomationView>,
    ) {
        actions.sort_by(|a, b| a.id.cmp(&b.id));
        views.sort_by(|a, b| a.id.cmp(&b.id));
        let mut guard = self.inner.lock().await;
        guard.actions = actions;
        guard.views = views;
    }

    pub async fn update_state(&self, snapshot: UiAutomationStateSnapshot) {
        self.inner.lock().await.snapshot = snapshot;
    }

    pub async fn actions(&self) -> Vec<UiAutomationAction> {
        self.inner.lock().await.actions.clone()
    }

    pub async fn views(&self) -> Vec<UiAutomationView> {
        self.inner.lock().await.views.clone()
    }

    pub async fn snapshot(&self) -> UiAutomationStateSnapshot {
        self.inner.lock().await.snapshot.clone()
    }

    pub async fn register_pending_invoke(
        &self,
        request_id: String,
        response_tx: Sender<AppCommandResult>,
    ) {
        self.inner.lock().await.pending.insert(
            request_id,
            PendingUiRequest {
                response_tx,
                kind: PendingUiRequestKind::InvokeAction,
            },
        );
    }

    pub async fn register_pending_capture(
        &self,
        request_id: String,
        response_tx: Sender<AppCommandResult>,
        name: Option<String>,
        target: String,
        target_id: Option<String>,
    ) {
        self.inner.lock().await.pending.insert(
            request_id,
            PendingUiRequest {
                response_tx,
                kind: PendingUiRequestKind::CaptureScreenshot {
                    name,
                    target,
                    target_id,
                },
            },
        );
    }

    pub async fn complete_request(
        &self,
        request_id: &str,
        completion: UiAutomationCompletion,
    ) -> Result<(), String> {
        let pending = self
            .inner
            .lock()
            .await
            .pending
            .remove(request_id)
            .ok_or_else(|| format!("Unknown UI automation request: {request_id}"))?;

        let payload = match (&pending.kind, completion.payload) {
            (
                PendingUiRequestKind::CaptureScreenshot {
                    name,
                    target,
                    target_id,
                },
                Some(payload),
            ) => Some(materialize_screenshot_payload(name.clone(), target, target_id.clone(), payload)?),
            (_, payload) => payload,
        };

        pending
            .response_tx
            .send(AppCommandResult {
                success: completion.success,
                message: completion.message,
                seq: None,
                error_code: completion.error_code,
                payload,
            })
            .map_err(|err| format!("Failed to complete UI automation request: {err}"))?;

        Ok(())
    }
}

fn materialize_screenshot_payload(
    name: Option<String>,
    target: &str,
    target_id: Option<String>,
    payload: Value,
) -> Result<Value, String> {
    let data_url = payload
        .get("image_data_url")
        .and_then(Value::as_str)
        .ok_or_else(|| "Missing screenshot payload field: image_data_url".to_string())?;
    let encoded = data_url
        .split_once(',')
        .map(|(_, tail)| tail)
        .ok_or_else(|| "Invalid data URL for screenshot payload".to_string())?;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(encoded)
        .map_err(|err| format!("Invalid base64 screenshot payload: {err}"))?;

    let output_dir = std::env::temp_dir().join("knot-ui-automation");
    std::fs::create_dir_all(&output_dir)
        .map_err(|err| format!("Failed to create screenshot output directory: {err}"))?;

    let filename = format!(
        "{}.png",
        sanitize_file_stem(name.unwrap_or_else(|| {
            format!(
                "{}-{}",
                target.replace('.', "-"),
                chrono::Utc::now().format("%Y%m%d%H%M%S%3f")
            )
        }))
    );
    let path = output_dir.join(filename);
    std::fs::write(&path, bytes).map_err(|err| format!("Failed to write screenshot artifact: {err}"))?;

    Ok(json!({
        "file_path": path.to_string_lossy().to_string(),
        "target": target,
        "target_id": target_id,
        "capture_scope": payload.get("capture_scope").cloned().unwrap_or_else(|| json!("view")),
        "width": payload.get("width").cloned().unwrap_or(Value::Null),
        "height": payload.get("height").cloned().unwrap_or(Value::Null),
        "timestamp_ms": chrono::Utc::now().timestamp_millis(),
    }))
}

fn sanitize_file_stem(value: String) -> String {
    let trimmed = value.trim();
    let sanitized = trimmed
        .chars()
        .map(|ch| if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' { ch } else { '-' })
        .collect::<String>();
    let collapsed = sanitized.trim_matches('-').to_string();
    if collapsed.is_empty() {
        "ui-capture".to_string()
    } else {
        collapsed
    }
}

pub fn ui_automation_socket_path() -> PathBuf {
    std::env::var("KNOT_UI_AUTOMATION_SOCKET_PATH")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("/tmp/knot-ui-automation.sock"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn screenshot_socket_path_defaults_to_ui_socket() {
        std::env::remove_var("KNOT_UI_AUTOMATION_SOCKET_PATH");
        assert_eq!(
            ui_automation_socket_path(),
            PathBuf::from("/tmp/knot-ui-automation.sock")
        );
    }
}
