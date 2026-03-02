//! Note-related Tauri commands.
//!
//! SPEC: COMP-NOTE-001 FR-1, FR-2, FR-3, FR-4, FR-5, FR-6, FR-10
//! SPEC: COMP-GRAPH-001 FR-6

use crate::commands::emit_event;
use crate::note_type::{note_type_has_text_content, NoteEmbedDescriptorInput, NoteTypeId};
use base64::Engine;
use serde::Serialize;
use std::collections::{BTreeMap, HashMap};
use std::path::{Path, PathBuf};
use tauri::State;
use tauri::Window;
use tracing::{info, instrument};
use walkdir::WalkDir;

use crate::state::response::{
    Backlink, ExplorerFolderNode, ExplorerNoteNode, ExplorerTree, Heading, NoteData, NoteSummary,
};
use crate::knotd_client;
use crate::state::AppState;
use crate::youtube::{
    build_youtube_note_markdown, build_youtube_note_path, extract_youtube_metadata, import_youtube_note,
};

#[derive(Debug, Clone, Serialize)]
struct TreeChangedEventPayload {
    reason: &'static str,
    changed_count: usize,
}

/// SPEC: COMP-NOTE-001 FR-1
/// List all notes in the vault.
#[tauri::command]
#[instrument(skip(state))]
pub async fn list_notes(state: State<'_, AppState>) -> Result<Vec<NoteSummary>, String> {
    if state.is_daemon_mode() {
        return knotd_client::call_tool_typed("list_notes", serde_json::json!({}))
            .map_err(|e| e.to_response_string());
    }

    let vault_guard = state.vault().lock().await;

    match vault_guard.as_ref() {
        Some(vault) => {
            let notes = vault.list_notes().map_err(|e| e.to_response_string())?;

            let summaries: Vec<_> = notes
                .into_iter()
                .map(|note| note_to_summary(vault.root_path(), note))
                .collect();

            Ok(summaries)
        }
        None => Err("No vault is open".to_string()),
    }
}

/// SPEC: COMP-NOTE-001 FR-2, FR-10
/// Get a note by its path.
#[tauri::command]
#[instrument(skip(state))]
pub async fn get_note(path: String, state: State<'_, AppState>) -> Result<NoteData, String> {
    if state.is_daemon_mode() {
        return knotd_client::call_tool_typed("get_note", serde_json::json!({ "path": path }))
            .map_err(|e| e.to_response_string());
    }

    let vault_guard = state.vault().lock().await;

    match vault_guard.as_ref() {
        Some(vault) => {
            let note = vault.get_note(&path).map_err(|e| e.to_response_string())?;
            Ok(build_note_data(vault.root_path(), vault, note))
        }
        None => Err("No vault is open".to_string()),
    }
}

#[tauri::command]
#[instrument(skip(state))]
pub async fn read_note_media_base64(file_path: String, state: State<'_, AppState>) -> Result<String, String> {
    let requested_path =
        PathBuf::from(&file_path).canonicalize().map_err(|e| format!("Failed to resolve media path: {e}"))?;

    let vault_root = if state.is_daemon_mode() {
        state
            .current_asset_scope_path()
            .await
            .ok_or_else(|| "No vault is open".to_string())?
    } else {
        let vault_guard = state.vault().lock().await;
        vault_guard
            .as_ref()
            .map(|vault| vault.root_path().to_path_buf())
            .ok_or_else(|| "No vault is open".to_string())?
    };

    let resolved_root =
        vault_root.canonicalize().map_err(|e| format!("Failed to resolve current vault path: {e}"))?;

    if !requested_path.starts_with(&resolved_root) {
        return Err("Requested media path is outside the current vault".to_string());
    }

    let bytes = std::fs::read(&requested_path).map_err(|e| format!("Failed to read media file: {e}"))?;
    Ok(base64::engine::general_purpose::STANDARD.encode(bytes))
}

/// SPEC: COMP-NOTE-001 FR-3
/// Save a note.
#[tauri::command]
#[instrument(skip(state))]
pub async fn save_note(
    path: String,
    content: String,
    window: Window,
    state: State<'_, AppState>,
) -> Result<(), String> {
    if state.is_daemon_mode() {
        knotd_client::call_tool_typed::<serde_json::Value>(
            "save_note",
            serde_json::json!({ "path": path, "content": content }),
        )
        .map_err(|e| e.to_response_string())?;
        emit_event(
            &window,
            "vault://tree-changed",
            TreeChangedEventPayload {
                reason: "save-note",
                changed_count: 1,
            },
        );
        return Ok(());
    }

    let mut vault_guard = state.vault().lock().await;

    match vault_guard.as_mut() {
        Some(vault) => {
            vault
                .save_note(&path, &content)
                .map_err(|e| e.to_response_string())?;
            emit_event(
                &window,
                "vault://tree-changed",
                TreeChangedEventPayload {
                    reason: "save-note",
                    changed_count: 1,
                },
            );

            info!(path, "note saved");
            Ok(())
        }
        None => Err("No vault is open".to_string()),
    }
}

/// SPEC: COMP-NOTE-001 FR-4
/// Delete a note.
#[tauri::command]
#[instrument(skip(state))]
pub async fn delete_note(
    path: String,
    window: Window,
    state: State<'_, AppState>,
) -> Result<(), String> {
    if state.is_daemon_mode() {
        knotd_client::call_tool_typed::<serde_json::Value>(
            "delete_note",
            serde_json::json!({ "path": path }),
        )
        .map_err(|e| e.to_response_string())?;
        emit_event(
            &window,
            "vault://tree-changed",
            TreeChangedEventPayload {
                reason: "delete-note",
                changed_count: 1,
            },
        );
        return Ok(());
    }

    let mut vault_guard = state.vault().lock().await;

    match vault_guard.as_mut() {
        Some(vault) => {
            vault
                .delete_note(&path)
                .map_err(|e| e.to_response_string())?;
            emit_event(
                &window,
                "vault://tree-changed",
                TreeChangedEventPayload {
                    reason: "delete-note",
                    changed_count: 1,
                },
            );

            info!(path, "note deleted");
            Ok(())
        }
        None => Err("No vault is open".to_string()),
    }
}

/// SPEC: COMP-NOTE-001 FR-5
/// Rename/move a note.
#[tauri::command]
#[instrument(skip(state))]
pub async fn rename_note(
    old_path: String,
    new_path: String,
    window: Window,
    state: State<'_, AppState>,
) -> Result<(), String> {
    if state.is_daemon_mode() {
        knotd_client::call_tool_typed::<serde_json::Value>(
            "rename_note",
            serde_json::json!({ "old_path": old_path, "new_path": new_path }),
        )
        .map_err(|e| e.to_response_string())?;
        emit_event(
            &window,
            "vault://tree-changed",
            TreeChangedEventPayload {
                reason: "rename-note",
                changed_count: 1,
            },
        );
        return Ok(());
    }

    let mut vault_guard = state.vault().lock().await;

    match vault_guard.as_mut() {
        Some(vault) => {
            vault
                .rename_note(&old_path, &new_path)
                .map_err(|e| e.to_response_string())?;
            emit_event(
                &window,
                "vault://tree-changed",
                TreeChangedEventPayload {
                    reason: "rename-note",
                    changed_count: 1,
                },
            );

            info!(old_path, new_path, "note renamed");
            Ok(())
        }
        None => Err("No vault is open".to_string()),
    }
}

/// SPEC: COMP-NOTE-001 FR-6
/// Create a new note.
#[tauri::command]
#[instrument(skip(state))]
pub async fn create_note(
    path: String,
    content: Option<String>,
    window: Window,
    state: State<'_, AppState>,
) -> Result<NoteData, String> {
    if state.is_daemon_mode() {
        let payload = knotd_client::call_tool_typed(
            "create_note",
            serde_json::json!({ "path": path, "content": content.unwrap_or_default() }),
        )
        .map_err(|e| e.to_response_string())?;
        emit_event(
            &window,
            "vault://tree-changed",
            TreeChangedEventPayload {
                reason: "create-note",
                changed_count: 1,
            },
        );
        return Ok(payload);
    }

    let mut vault_guard = state.vault().lock().await;

    match vault_guard.as_mut() {
        Some(vault) => {
            // Check if note already exists
            if vault.get_note(&path).is_ok() {
                return Err(format!("Note already exists: {}", path));
            }

            let content = content.unwrap_or_default();
            vault
                .save_note(&path, &content)
                .map_err(|e| e.to_response_string())?;

            // Return the newly created note
            let note = vault.get_note(&path).map_err(|e| e.to_response_string())?;
            let data = build_note_data(vault.root_path(), vault, note);

            info!(path, "note created");
            emit_event(
                &window,
                "vault://tree-changed",
                TreeChangedEventPayload {
                    reason: "create-note",
                    changed_count: 1,
                },
            );
            Ok(data)
        }
        None => Err("No vault is open".to_string()),
    }
}

/// SPEC: COMP-YOUTUBE-NOTE-TYPE-015 FR-1, FR-2, FR-3, FR-4
/// Create a YouTube transcript note from a public YouTube URL.
#[tauri::command]
#[instrument(skip(state))]
pub async fn create_youtube_note(
    base_folder_path: String,
    url: String,
    window: Window,
    state: State<'_, AppState>,
) -> Result<NoteData, String> {
    if state.is_daemon_mode() {
        let payload = knotd_client::call_tool_typed(
            "create_youtube_note",
            serde_json::json!({ "base_folder_path": base_folder_path, "url": url }),
        )
        .map_err(|e| e.to_response_string())?;
        emit_event(
            &window,
            "vault://tree-changed",
            TreeChangedEventPayload {
                reason: "create-youtube-note",
                changed_count: 1,
            },
        );
        return Ok(payload);
    }

    let mut vault_guard = state.vault().lock().await;
    match vault_guard.as_mut() {
        Some(vault) => {
            let imported = import_youtube_note(&url)?;
            let path = build_youtube_note_path(
                &base_folder_path,
                &imported.title,
                &imported.parsed_url.video_id,
                |candidate| vault.get_note(candidate).is_ok(),
            );
            let markdown = build_youtube_note_markdown(
                &imported.title,
                &imported.description,
                &imported.parsed_url.watch_url,
                &imported.parsed_url.video_id,
                &imported.parsed_url.embed_url,
                &imported.parsed_url.thumbnail_url,
                &imported.transcript_language,
                &imported.transcript_source,
                &imported.transcript,
            );

            vault
                .save_note(&path, &markdown)
                .map_err(|e| e.to_response_string())?;

            let note = vault.get_note(&path).map_err(|e| e.to_response_string())?;
            let data = build_note_data(vault.root_path(), vault, note);

            emit_event(
                &window,
                "vault://tree-changed",
                TreeChangedEventPayload {
                    reason: "create-youtube-note",
                    changed_count: 1,
                },
            );
            info!(path, "youtube note created");
            Ok(data)
        }
        None => Err("No vault is open".to_string()),
    }
}

/// SPEC: COMP-GRAPH-001 FR-6
/// Get the link graph layout.
#[tauri::command]
#[instrument(skip(state))]
pub async fn get_graph_layout(
    width: f64,
    height: f64,
    state: State<'_, AppState>,
) -> Result<crate::state::response::GraphLayout, String> {
    if state.is_daemon_mode() {
        return knotd_client::call_tool_typed(
            "get_graph_layout",
            serde_json::json!({ "width": width, "height": height }),
        )
        .map_err(|e| e.to_response_string());
    }

    let vault_guard = state.vault().lock().await;

    match vault_guard.as_ref() {
        Some(vault) => {
            let layout = vault.graph_layout(width, height);

            let nodes: Vec<_> = layout
                .nodes
                .into_iter()
                .map(|n| crate::state::response::GraphNode {
                    id: n.id,
                    label: n.label,
                    x: n.x,
                    y: n.y,
                })
                .collect();

            let edges: Vec<_> = layout
                .edges
                .into_iter()
                .map(|e| crate::state::response::GraphEdge {
                    source: e.source,
                    target: e.target,
                })
                .collect();

            Ok(crate::state::response::GraphLayout { nodes, edges })
        }
        None => Err("No vault is open".to_string()),
    }
}

/// SPEC: COMP-EXPLORER-TREE-001 FR-1, FR-2, FR-6, FR-7, FR-12
/// Get explorer tree with folders and notes (including empty folders).
#[tauri::command]
#[instrument(skip(state))]
pub async fn get_explorer_tree(state: State<'_, AppState>) -> Result<ExplorerTree, String> {
    if state.is_daemon_mode() {
        let notes: Vec<NoteSummary> = knotd_client::call_tool_typed("list_notes", serde_json::json!({}))
            .map_err(|e| e.to_response_string())?;
        let settings: serde_json::Value =
            knotd_client::call_tool_typed("get_vault_settings", serde_json::json!({}))
                .map_err(|e| e.to_response_string())?;
        let vault_info: crate::state::response::VaultInfo =
            knotd_client::call_tool_typed("get_vault_info", serde_json::json!({}))
                .map_err(|e| e.to_response_string())?;

        let expanded_folders = settings
            .get("explorer")
            .and_then(|v| v.get("expanded_folders"))
            .and_then(serde_json::Value::as_array)
            .map(|a| {
                a.iter()
                    .filter_map(serde_json::Value::as_str)
                    .map(ToString::to_string)
                    .collect::<Vec<_>>()
            })
            .unwrap_or_default();
        let expansion_state_initialized = settings
            .get("explorer")
            .and_then(|v| v.get("expansion_state_initialized"))
            .and_then(serde_json::Value::as_bool)
            .unwrap_or(false);

        let root_path = PathBuf::from(vault_info.path);
        let folders = scan_visible_folders(&root_path)?;
        let root = build_explorer_tree(
            &root_path,
            notes,
            folders,
            &expanded_folders,
            expansion_state_initialized,
        );
        return Ok(ExplorerTree {
            root,
            hidden_policy: "hide-dotfiles".to_string(),
        });
    }

    let vault_guard = state.vault().lock().await;

    match vault_guard.as_ref() {
        Some(vault) => {
            let notes = vault
                .list_notes()
                .map_err(|e| e.to_response_string())?
                .into_iter()
                .map(|note| note_to_summary(vault.root_path(), note))
                .collect::<Vec<_>>();
            let folders = scan_visible_folders(vault.root_path())?;
            let root = build_explorer_tree(
                vault.root_path(),
                notes,
                folders,
                &vault.config().explorer.expanded_folders,
                vault.config().explorer.expansion_state_initialized,
            );
            Ok(ExplorerTree {
                root,
                hidden_policy: "hide-dotfiles".to_string(),
            })
        }
        None => Err("No vault is open".to_string()),
    }
}

/// SPEC: COMP-EXPLORER-TREE-001 FR-5
/// Persist expanded/collapsed state for a folder path.
#[tauri::command]
#[instrument(skip(state))]
pub async fn set_folder_expanded(
    path: String,
    expanded: bool,
    window: Window,
    state: State<'_, AppState>,
) -> Result<(), String> {
    if state.is_daemon_mode() {
        knotd_client::call_tool_typed::<serde_json::Value>(
            "set_folder_expanded",
            serde_json::json!({ "path": path, "expanded": expanded }),
        )
        .map_err(|e| e.to_response_string())?;
        emit_event(
            &window,
            "vault://tree-changed",
            TreeChangedEventPayload {
                reason: "set-folder-expanded",
                changed_count: 1,
            },
        );
        return Ok(());
    }

    let mut vault_guard = state.vault().lock().await;

    match vault_guard.as_mut() {
        Some(vault) => {
            vault
                .set_folder_expanded(&path, expanded)
                .map_err(|e| e.to_response_string())?;
            emit_event(
                &window,
                "vault://tree-changed",
                TreeChangedEventPayload {
                    reason: "set-folder-expanded",
                    changed_count: 1,
                },
            );
            Ok(())
        }
        None => Err("No vault is open".to_string()),
    }
}

/// SPEC: COMP-EXPLORER-TREE-001 FR-8
/// Create a directory in the current vault.
#[tauri::command]
#[instrument(skip(state))]
pub async fn create_directory(
    path: String,
    window: Window,
    state: State<'_, AppState>,
) -> Result<(), String> {
    if state.is_daemon_mode() {
        knotd_client::call_tool_typed::<serde_json::Value>(
            "create_directory",
            serde_json::json!({ "path": path }),
        )
        .map_err(|e| e.to_response_string())?;
        emit_event(
            &window,
            "vault://tree-changed",
            TreeChangedEventPayload {
                reason: "create-directory",
                changed_count: 1,
            },
        );
        return Ok(());
    }

    let mut vault_guard = state.vault().lock().await;

    match vault_guard.as_mut() {
        Some(vault) => {
            vault
                .create_directory(&path)
                .map_err(|e| e.to_response_string())?;
            emit_event(
                &window,
                "vault://tree-changed",
                TreeChangedEventPayload {
                    reason: "create-directory",
                    changed_count: 1,
                },
            );
            Ok(())
        }
        None => Err("No vault is open".to_string()),
    }
}

/// SPEC: COMP-EXPLORER-TREE-001 FR-8
/// Delete a directory from the current vault.
#[tauri::command]
#[instrument(skip(state))]
pub async fn delete_directory(
    path: String,
    recursive: bool,
    window: Window,
    state: State<'_, AppState>,
) -> Result<(), String> {
    if state.is_daemon_mode() {
        knotd_client::call_tool_typed::<serde_json::Value>(
            "remove_directory",
            serde_json::json!({ "path": path, "recursive": recursive }),
        )
        .map_err(|e| e.to_response_string())?;
        emit_event(
            &window,
            "vault://tree-changed",
            TreeChangedEventPayload {
                reason: "delete-directory",
                changed_count: 1,
            },
        );
        return Ok(());
    }

    let mut vault_guard = state.vault().lock().await;

    match vault_guard.as_mut() {
        Some(vault) => {
            vault
                .delete_directory(&path, recursive)
                .map_err(|e| e.to_response_string())?;
            emit_event(
                &window,
                "vault://tree-changed",
                TreeChangedEventPayload {
                    reason: "delete-directory",
                    changed_count: 1,
                },
            );
            Ok(())
        }
        None => Err("No vault is open".to_string()),
    }
}

/// SPEC: COMP-EXPLORER-TREE-001 FR-8
/// Rename/move a directory in the current vault.
#[tauri::command]
#[instrument(skip(state))]
pub async fn rename_directory(
    old_path: String,
    new_path: String,
    window: Window,
    state: State<'_, AppState>,
) -> Result<(), String> {
    if state.is_daemon_mode() {
        knotd_client::call_tool_typed::<serde_json::Value>(
            "rename_directory",
            serde_json::json!({ "old_path": old_path, "new_path": new_path }),
        )
        .map_err(|e| e.to_response_string())?;
        emit_event(
            &window,
            "vault://tree-changed",
            TreeChangedEventPayload {
                reason: "rename-directory",
                changed_count: 1,
            },
        );
        return Ok(());
    }

    let mut vault_guard = state.vault().lock().await;

    match vault_guard.as_mut() {
        Some(vault) => {
            vault
                .rename_directory(&old_path, &new_path)
                .map_err(|e| e.to_response_string())?;
            emit_event(
                &window,
                "vault://tree-changed",
                TreeChangedEventPayload {
                    reason: "rename-directory",
                    changed_count: 1,
                },
            );
            Ok(())
        }
        None => Err("No vault is open".to_string()),
    }
}

fn scan_visible_folders(root: &Path) -> Result<Vec<String>, String> {
    let mut paths = Vec::new();
    for entry in WalkDir::new(root)
        .min_depth(1)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if !entry.file_type().is_dir() {
            continue;
        }
        let relative = entry
            .path()
            .strip_prefix(root)
            .map_err(|_| "Failed to compute folder path".to_string())?;
        let rel = normalize_rel_path(relative);
        if rel.is_empty() || is_hidden_rel_path(&rel) || rel.starts_with(".vault") {
            continue;
        }
        paths.push(rel);
    }
    Ok(paths)
}

fn normalize_rel_path(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

fn filename_stem(path: &str) -> String {
    PathBuf::from(path)
        .file_stem()
        .map(|v| v.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string())
}

fn is_hidden_rel_path(rel_path: &str) -> bool {
    rel_path
        .split('/')
        .any(|segment| !segment.is_empty() && segment.starts_with('.'))
}

fn build_explorer_tree(
    vault_root: &Path,
    notes: Vec<NoteSummary>,
    folders: Vec<String>,
    expanded_folders: &[String],
    expansion_state_initialized: bool,
) -> ExplorerFolderNode {
    #[derive(Clone)]
    struct FolderAccum {
        path: String,
        name: String,
        children: BTreeMap<String, String>,
        notes: Vec<ExplorerNoteNode>,
    }

    fn ensure_folder(map: &mut HashMap<String, FolderAccum>, path: &str, root_name: &str) {
        if map.contains_key(path) {
            return;
        }

        let name = if path.is_empty() {
            root_name.to_string()
        } else {
            path.rsplit('/').next().unwrap_or(path).to_string()
        };

        map.insert(
            path.to_string(),
            FolderAccum {
                path: path.to_string(),
                name,
                children: BTreeMap::new(),
                notes: Vec::new(),
            },
        );

        if path.is_empty() {
            return;
        }

        let parent = path.rsplit_once('/').map(|(p, _)| p).unwrap_or("");
        ensure_folder(map, parent, root_name);
        if let Some(parent_entry) = map.get_mut(parent) {
            parent_entry.children.insert(
                path.to_string(),
                path.rsplit('/').next().unwrap_or(path).to_string(),
            );
        }
    }

    fn folder_expanded(
        path: &str,
        expansion_state_initialized: bool,
        expanded_folders: &[String],
    ) -> bool {
        if path.is_empty() {
            return true;
        }
        if expansion_state_initialized {
            return expanded_folders.iter().any(|p| p == path);
        }
        !path.contains('/')
    }

    fn build_node(
        map: &HashMap<String, FolderAccum>,
        path: &str,
        expansion_state_initialized: bool,
        expanded_folders: &[String],
    ) -> ExplorerFolderNode {
        let current = map.get(path).expect("folder path should exist");
        let mut folder_paths = current.children.keys().cloned().collect::<Vec<_>>();
        folder_paths.sort_by_key(|p| p.to_ascii_lowercase());

        let folders = folder_paths
            .iter()
            .map(|child| build_node(map, child, expansion_state_initialized, expanded_folders))
            .collect::<Vec<_>>();

        let mut notes = current.notes.clone();
        notes.sort_by(|a, b| {
            a.display_title
                .to_ascii_lowercase()
                .cmp(&b.display_title.to_ascii_lowercase())
        });

        ExplorerFolderNode {
            path: current.path.clone(),
            name: current.name.clone(),
            expanded: folder_expanded(path, expansion_state_initialized, expanded_folders),
            folders,
            notes,
        }
    }

    let root_name = vault_root
        .file_name()
        .map(|v| v.to_string_lossy().to_string())
        .unwrap_or_else(|| "Vault".to_string());

    let mut map: HashMap<String, FolderAccum> = HashMap::new();
    ensure_folder(&mut map, "", &root_name);

    for folder in folders {
        ensure_folder(&mut map, &folder, &root_name);
    }

    for note in notes {
        let parent = Path::new(&note.path)
            .parent()
            .map(normalize_rel_path)
            .unwrap_or_default();
        let title = note.title.clone();
        let display_title = if note.title.trim().is_empty() {
            filename_stem(&note.path)
        } else {
            note.title.clone()
        };
        ensure_folder(&mut map, &parent, &root_name);
        if let Some(parent_folder) = map.get_mut(&parent) {
            parent_folder.notes.push(ExplorerNoteNode {
                path: note.path,
                title,
                display_title,
                modified_at: note.modified_at,
                word_count: note.word_count,
                type_badge: note.type_badge,
                is_dimmed: note.is_dimmed,
            });
        }
    }

    build_node(&map, "", expansion_state_initialized, expanded_folders)
}

/// Helper to convert NoteMeta to NoteSummary.
fn note_to_summary(vault_root: &Path, meta: crate::note::NoteMeta) -> NoteSummary {
    let resolved = crate::note_type::NoteTypeRegistry::default().resolve_path(&vault_root.join(&meta.path));
    NoteSummary {
        id: meta.id,
        path: meta.path,
        title: meta.title,
        created_at: meta.created_at,
        modified_at: meta.modified_at,
        word_count: meta.word_count,
        note_type: resolved.note_type,
        type_badge: resolved.type_badge,
        is_dimmed: !resolved.is_known,
    }
}

pub(crate) fn build_note_data(
    vault_root: &Path,
    vault: &crate::core::VaultManager,
    note: crate::note::Note,
) -> NoteData {
    let mut resolved = vault.note_type_registry().resolve_path(&vault_root.join(note.path()));
    let (headings, backlinks, content) = if note_type_has_text_content(resolved.note_type) {
        let note_headings = note.headings();
        let heading_positions = compute_heading_positions(note.content(), &note_headings);
        let headings = note_headings
            .iter()
            .enumerate()
            .map(|(index, h)| Heading {
                level: h.level as u8,
                text: h.text.clone(),
                position: *heading_positions.get(index).unwrap_or(&0),
            })
            .collect();
        let backlinks = vault
            .graph()
            .backlinks(note.path())
            .into_iter()
            .map(|(source, context)| Backlink {
                source_path: source.clone(),
                source_title: vault
                    .get_note(&source)
                    .map(|source_note| source_note.title().to_string())
                    .unwrap_or_else(|_| fallback_title_from_path(&source)),
                context,
            })
            .collect();
        (headings, backlinks, note.content().to_string())
    } else {
        (Vec::new(), Vec::new(), String::new())
    };

    if resolved.note_type == NoteTypeId::YouTube {
        resolved.metadata.extra = extract_youtube_metadata(&content);
    }

    let embed = vault.note_type_registry().build_embed_descriptor(
        &vault_root.join(note.path()),
        &NoteEmbedDescriptorInput {
            path: note.path(),
            title: note.title(),
            content: &content,
            metadata: &resolved.metadata,
            media: resolved.media.as_ref(),
        },
    );

    NoteData {
        id: note.id().to_string(),
        path: note.path().to_string(),
        title: note.title().to_string(),
        content,
        created_at: note.created_at(),
        modified_at: note.modified_at(),
        word_count: note.word_count(),
        headings,
        backlinks,
        note_type: resolved.note_type,
        available_modes: resolved.available_modes,
        metadata: resolved.metadata,
        embed,
        type_badge: resolved.type_badge,
        media: resolved.media,
        is_dimmed: !resolved.is_known,
    }
}

/// SPEC: COMP-NOTE-METADATA-001 FR-4
/// Build a display-friendly fallback title from note path when note lookup fails.
fn fallback_title_from_path(path: &str) -> String {
    Path::new(path)
        .file_stem()
        .and_then(|stem| stem.to_str())
        .filter(|stem| !stem.trim().is_empty())
        .map(std::string::ToString::to_string)
        .unwrap_or_else(|| path.to_string())
}

/// SPEC: COMP-NOTE-METADATA-001 FR-2, FR-3
/// Compute zero-based byte offsets for heading line starts in source markdown.
fn compute_heading_positions(content: &str, headings: &[crate::markdown::Heading]) -> Vec<usize> {
    let mut heading_lines: Vec<(u8, String, usize)> = Vec::new();
    let mut offset = 0usize;

    for line_with_ending in content.split_inclusive('\n') {
        let line = line_with_ending.trim_end_matches(['\n', '\r']);
        if let Some((level, text)) = parse_atx_heading_line(line) {
            heading_lines.push((level, text, offset));
        }
        offset += line_with_ending.len();
    }

    if !content.ends_with('\n') {
        let trailing_start = content.rfind('\n').map_or(0, |idx| idx + 1);
        if trailing_start < content.len() {
            let trailing = &content[trailing_start..];
            if let Some((level, text)) = parse_atx_heading_line(trailing) {
                if heading_lines
                    .last()
                    .map(|(_, _, pos)| *pos != trailing_start)
                    .unwrap_or(true)
                {
                    heading_lines.push((level, text, trailing_start));
                }
            }
        }
    }

    let mut cursor = 0usize;
    let mut positions = Vec::with_capacity(headings.len());

    for heading in headings {
        let wanted_level = heading.level as u8;
        let wanted_text = heading.text.trim();

        let found = heading_lines
            .iter()
            .enumerate()
            .skip(cursor)
            .find(|(_, (level, text, _))| *level == wanted_level && text == wanted_text)
            .map(|(index, (_, _, position))| {
                cursor = index + 1;
                *position
            })
            .unwrap_or(0);

        positions.push(found);
    }

    positions
}

fn parse_atx_heading_line(line: &str) -> Option<(u8, String)> {
    let trimmed_start = line.trim_start();
    let hash_count = trimmed_start.chars().take_while(|ch| *ch == '#').count();
    if hash_count == 0 || hash_count > 6 {
        return None;
    }

    let rest = trimmed_start.get(hash_count..)?;
    if !rest.starts_with(' ') {
        return None;
    }

    let text = rest
        .trim()
        .trim_end_matches('#')
        .trim()
        .to_string();

    if text.is_empty() {
        return None;
    }

    Some((hash_count as u8, text))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn note(path: &str, title: &str, modified_at: i64) -> NoteSummary {
        NoteSummary {
            id: format!("id-{path}"),
            path: path.to_string(),
            title: title.to_string(),
            created_at: modified_at,
            modified_at,
            word_count: 10,
            note_type: crate::note_type::NoteTypeId::Markdown,
            type_badge: None,
            is_dimmed: false,
        }
    }

    #[test]
    fn explorer_tree_includes_empty_folders() {
        let root = Path::new("/tmp/vault");
        let notes = vec![note("Programming/rust.md", "Rust", 1)];
        let folders = vec!["Programming".to_string(), "Programming/empty".to_string()];

        let tree = build_explorer_tree(root, notes, folders, &[], false);
        let programming = tree
            .folders
            .iter()
            .find(|f| f.path == "Programming")
            .expect("Programming folder exists");
        assert!(programming
            .folders
            .iter()
            .any(|f| f.path == "Programming/empty"));
    }

    #[test]
    fn explorer_tree_falls_back_to_filename_stem_for_empty_title() {
        let root = Path::new("/tmp/vault");
        let notes = vec![note("b.md", "", 1), note("a.md", "Alpha", 2)];

        let tree = build_explorer_tree(root, notes, vec![], &[], false);
        assert_eq!(tree.notes.len(), 2);
        assert_eq!(tree.notes[0].display_title, "Alpha");
        assert_eq!(tree.notes[1].display_title, "b");
    }

    #[test]
    fn explorer_tree_default_expansion_top_level_only() {
        let root = Path::new("/tmp/vault");
        let folders = vec!["A".to_string(), "A/B".to_string()];
        let tree = build_explorer_tree(root, vec![], folders, &[], false);

        let a = tree
            .folders
            .iter()
            .find(|f| f.path == "A")
            .expect("A exists");
        let b = a
            .folders
            .iter()
            .find(|f| f.path == "A/B")
            .expect("B exists");
        assert!(a.expanded);
        assert!(!b.expanded);
    }

    #[test]
    fn hidden_rel_paths_are_filtered() {
        assert!(is_hidden_rel_path(".vault"));
        assert!(is_hidden_rel_path("Programming/.drafts"));
        assert!(is_hidden_rel_path(".hidden/file.md"));
        assert!(!is_hidden_rel_path("Programming/rust"));
    }

    #[test]
    // BUG-NOTE-METADATA-001: heading positions must not remain placeholder zeros.
    fn bug_note_metadata_001_heading_offsets_track_heading_line_starts() {
        let content = "# Top\n\nText\n## Child\n";
        let headings = vec![
            crate::markdown::Heading {
                level: 1,
                text: "Top".to_string(),
                anchor: "top".to_string(),
            },
            crate::markdown::Heading {
                level: 2,
                text: "Child".to_string(),
                anchor: "child".to_string(),
            },
        ];

        let offsets = compute_heading_positions(content, &headings);
        assert_eq!(offsets, vec![0, 12]);
    }

    #[test]
    // BUG-NOTE-METADATA-001: fallback backlink titles should be human-readable.
    fn bug_note_metadata_001_title_fallback_uses_filename_stem() {
        let title = fallback_title_from_path("projects/deep-learning.md");
        assert_eq!(title, "deep-learning");
    }
}
