use crate::state::AppState;
use crate::ui_automation::{
    UiAutomationAction, UiAutomationCompletion, UiAutomationFrontendRequest, UiAutomationStateSnapshot,
    UiAutomationView, UiAutomationViewFrame,
};
use image::{GenericImageView, ImageFormat};
use serde_json::json;
use std::io::Cursor;
use tauri::{Emitter, Manager, State};

#[tauri::command]
pub async fn ui_automation_sync_registry(
    actions: Vec<UiAutomationAction>,
    views: Vec<UiAutomationView>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.ui_automation().sync_registry(actions, views).await;
    Ok(())
}

#[tauri::command]
pub async fn ui_automation_sync_state(
    snapshot: UiAutomationStateSnapshot,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state.ui_automation().update_state(snapshot).await;
    Ok(())
}

#[tauri::command]
pub async fn ui_automation_complete_request(
    request_id: String,
    completion: UiAutomationCompletion,
    state: State<'_, AppState>,
) -> Result<(), String> {
    state
        .ui_automation()
        .complete_request(&request_id, completion)
        .await
}

pub fn dispatch_frontend_request<R: tauri::Runtime, M: Manager<R> + Emitter<R>>(
    manager: &M,
    request: UiAutomationFrontendRequest,
) -> Result<(), String> {
    manager
        .emit("ui-automation://request", request)
        .map_err(|err| format!("Failed to emit UI automation request: {err}"))
}

pub struct CapturedPng {
    pub bytes: Vec<u8>,
    pub width: u32,
    pub height: u32,
}

pub fn capture_main_window_png<R: tauri::Runtime>(app: &tauri::AppHandle<R>) -> Result<CapturedPng, String> {
    #[cfg(target_os = "linux")]
    {
        use std::sync::mpsc::sync_channel;
        use std::time::Duration;
        use webkit2gtk::{SnapshotOptions, SnapshotRegion, WebViewExt};

        let webview_window = app
            .get_webview_window("main")
            .ok_or_else(|| "Main webview window is unavailable".to_string())?;
        let (tx, rx) = sync_channel::<Result<CapturedPng, String>>(1);

        webview_window
            .with_webview(move |webview| {
                let sender = tx;
                webview.inner().snapshot(
                    SnapshotRegion::Visible,
                    SnapshotOptions::NONE,
                    None::<&webkit2gtk::gio::Cancellable>,
                    move |result: Result<cairo::Surface, webkit2gtk::glib::Error>| {
                        let snapshot = result
                            .map_err(|err| format!("Failed to snapshot Linux webview: {err}"))
                            .and_then(|surface: cairo::Surface| {
                                let mapped = surface
                                    .map_to_image(None)
                                    .map_err(|err| format!("Failed to map snapshot surface: {err}"))?;
                                let width = mapped.width().max(0) as u32;
                                let height = mapped.height().max(0) as u32;
                                let mut bytes = Vec::new();
                                mapped
                                    .write_to_png(&mut bytes)
                                    .map_err(|err| format!("Failed to encode snapshot PNG: {err}"))?;
                                Ok(CapturedPng {
                                    bytes,
                                    width,
                                    height,
                                })
                            });
                        let _ = sender.send(snapshot);
                    },
                );
            })
            .map_err(|err| format!("Failed to access main webview: {err}"))?;

        rx.recv_timeout(Duration::from_secs(10))
            .map_err(|_| "Timed out while waiting for native window screenshot".to_string())?
    }

    #[cfg(not(target_os = "linux"))]
    {
        let _ = app;
        Err("Native window screenshot capture is unavailable on this platform".to_string())
    }
}

pub fn capture_window_screenshot<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    name: Option<String>,
) -> Result<serde_json::Value, String> {
    let captured = capture_main_window_png(app)?;
    persist_capture_payload(
        captured.bytes,
        captured.width,
        captured.height,
        name,
        "window",
        "window.main",
        "window",
    )
}

pub fn capture_view_screenshot<R: tauri::Runtime>(
    app: &tauri::AppHandle<R>,
    target_id: &str,
    frame: &UiAutomationViewFrame,
    pixel_ratio: f64,
    name: Option<String>,
) -> Result<serde_json::Value, String> {
    let captured = capture_main_window_png(app)?;
    let cropped = crop_png_to_frame(&captured, frame, pixel_ratio)?;
    persist_capture_payload(cropped.bytes, cropped.width, cropped.height, name, "view", target_id, "view")
}

fn crop_png_to_frame(
    captured: &CapturedPng,
    frame: &UiAutomationViewFrame,
    pixel_ratio: f64,
) -> Result<CapturedPng, String> {
    let scale = if pixel_ratio.is_finite() && pixel_ratio > 0.0 {
        pixel_ratio
    } else {
        1.0
    };
    let x = (frame.x * scale).floor().max(0.0) as u32;
    let y = (frame.y * scale).floor().max(0.0) as u32;
    let width = (frame.width * scale).ceil().max(1.0) as u32;
    let height = (frame.height * scale).ceil().max(1.0) as u32;

    if x >= captured.width || y >= captured.height {
        return Err("View frame falls outside the captured window".to_string());
    }

    let bounded_width = width.min(captured.width.saturating_sub(x));
    let bounded_height = height.min(captured.height.saturating_sub(y));
    if bounded_width == 0 || bounded_height == 0 {
        return Err("View frame resolves to an empty crop region".to_string());
    }

    let image = image::load_from_memory_with_format(&captured.bytes, ImageFormat::Png)
        .map_err(|err| format!("Failed to decode captured PNG: {err}"))?;
    let cropped = image.crop_imm(x, y, bounded_width, bounded_height);
    let (cropped_width, cropped_height) = cropped.dimensions();
    let mut output = Cursor::new(Vec::new());
    cropped
        .write_to(&mut output, ImageFormat::Png)
        .map_err(|err| format!("Failed to encode cropped PNG: {err}"))?;

    Ok(CapturedPng {
        bytes: output.into_inner(),
        width: cropped_width,
        height: cropped_height,
    })
}

fn persist_capture_payload(
    bytes: Vec<u8>,
    width: u32,
    height: u32,
    name: Option<String>,
    target: &str,
    target_id: &str,
    capture_scope: &str,
) -> Result<serde_json::Value, String> {
    let output_dir = std::env::temp_dir().join("knot-ui-automation");
    std::fs::create_dir_all(&output_dir)
        .map_err(|err| format!("Failed to create screenshot output directory: {err}"))?;

    let filename = format!(
        "{}.png",
        sanitize_capture_name(name.unwrap_or_else(|| {
            format!(
                "{}-{}",
                target_id.replace('.', "-"),
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
        "capture_scope": capture_scope,
        "width": width,
        "height": height,
        "timestamp_ms": chrono::Utc::now().timestamp_millis(),
    }))
}

fn sanitize_capture_name(value: String) -> String {
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

#[cfg(test)]
mod tests {
    use super::{crop_png_to_frame, CapturedPng};
    use crate::ui_automation::UiAutomationViewFrame;
    use image::{ImageBuffer, ImageFormat, Rgba};
    use std::io::Cursor;

    #[test]
    fn crop_png_to_frame_respects_pixel_ratio() {
        let image = ImageBuffer::<Rgba<u8>, Vec<u8>>::from_pixel(100, 80, Rgba([1, 2, 3, 255]));
        let mut encoded = Cursor::new(Vec::new());
        image
            .write_to(&mut encoded, ImageFormat::Png)
            .expect("encode source png");
        let captured = CapturedPng {
            bytes: encoded.into_inner(),
            width: 100,
            height: 80,
        };

        let cropped = crop_png_to_frame(
            &captured,
            &UiAutomationViewFrame {
                x: 10.0,
                y: 5.0,
                width: 20.0,
                height: 10.0,
            },
            2.0,
        )
        .expect("crop view png");

        assert_eq!(cropped.width, 40);
        assert_eq!(cropped.height, 20);
    }
}
