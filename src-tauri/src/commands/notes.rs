//! Note-related Tauri commands.

use tauri::State;
use tracing::{info, instrument};

use crate::state::response::{NoteData, NoteSummary, Heading, Backlink};
use crate::state::AppState;

/// List all notes in the vault.
#[tauri::command]
#[instrument(skip(state))]
pub async fn list_notes(state: State<'_, AppState>) -> Result<Vec<NoteSummary>, String> {
    let vault_guard = state.vault().lock().await;

    match vault_guard.as_ref() {
        Some(vault) => {
            let notes = vault.list_notes()
                .map_err(|e| e.to_response_string())?;

            let summaries: Vec<_> = notes.into_iter()
                .map(|n| note_to_summary(n))
                .collect();

            Ok(summaries)
        }
        None => Err("No vault is open".to_string()),
    }
}

/// Get a note by its path.
#[tauri::command]
#[instrument(skip(state))]
pub async fn get_note(
    path: String,
    state: State<'_, AppState>,
) -> Result<NoteData, String> {
    let vault_guard = state.vault().lock().await;

    match vault_guard.as_ref() {
        Some(vault) => {
            let note = vault.get_note(&path)
                .map_err(|e| e.to_response_string())?;

            // Get backlinks from graph
            let backlinks = vault.graph()
                .backlinks(&path)
                .into_iter()
                .map(|(source, context)| Backlink {
                    source_path: source.clone(),
                    source_title: source, // TODO: Get actual title
                    context,
                })
                .collect();

            let data = NoteData {
                id: note.id().to_string(),
                path: note.path().to_string(),
                title: note.title().to_string(),
                content: note.content().to_string(),
                created_at: note.created_at(),
                modified_at: note.modified_at(),
                word_count: note.word_count(),
                headings: note.headings().iter()
                    .map(|h| Heading {
                        level: h.level as u8,
                        text: h.text.clone(),
                        position: 0, // TODO: calculate actual position
                    })
                    .collect(),
                backlinks,
            };

            Ok(data)
        }
        None => Err("No vault is open".to_string()),
    }
}

/// Save a note.
#[tauri::command]
#[instrument(skip(state))]
pub async fn save_note(
    path: String,
    content: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut vault_guard = state.vault().lock().await;

    match vault_guard.as_mut() {
        Some(vault) => {
            vault.save_note(&path, &content)
                .map_err(|e| e.to_response_string())?;

            info!(path, "note saved");
            Ok(())
        }
        None => Err("No vault is open".to_string()),
    }
}

/// Delete a note.
#[tauri::command]
#[instrument(skip(state))]
pub async fn delete_note(
    path: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut vault_guard = state.vault().lock().await;

    match vault_guard.as_mut() {
        Some(vault) => {
            vault.delete_note(&path)
                .map_err(|e| e.to_response_string())?;

            info!(path, "note deleted");
            Ok(())
        }
        None => Err("No vault is open".to_string()),
    }
}

/// Rename/move a note.
#[tauri::command]
#[instrument(skip(state))]
pub async fn rename_note(
    old_path: String,
    new_path: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let mut vault_guard = state.vault().lock().await;

    match vault_guard.as_mut() {
        Some(vault) => {
            vault.rename_note(&old_path, &new_path)
                .map_err(|e| e.to_response_string())?;

            info!(old_path, new_path, "note renamed");
            Ok(())
        }
        None => Err("No vault is open".to_string()),
    }
}

/// Create a new note.
#[tauri::command]
#[instrument(skip(state))]
pub async fn create_note(
    path: String,
    content: Option<String>,
    state: State<'_, AppState>,
) -> Result<NoteData, String> {
    let mut vault_guard = state.vault().lock().await;

    match vault_guard.as_mut() {
        Some(vault) => {
            // Check if note already exists
            if vault.get_note(&path).is_ok() {
                return Err(format!("Note already exists: {}", path));
            }

            let content = content.unwrap_or_default();
            vault.save_note(&path, &content)
                .map_err(|e| e.to_response_string())?;

            // Return the newly created note
            let note = vault.get_note(&path)
                .map_err(|e| e.to_response_string())?;

            let data = NoteData {
                id: note.id().to_string(),
                path: note.path().to_string(),
                title: note.title().to_string(),
                content: note.content().to_string(),
                created_at: note.created_at(),
                modified_at: note.modified_at(),
                word_count: note.word_count(),
                headings: note.headings().iter()
                    .map(|h| Heading {
                        level: h.level as u8,
                        text: h.text.clone(),
                        position: 0, // TODO: calculate actual position
                    })
                    .collect(),
                backlinks: vec![],
            };

            info!(path, "note created");
            Ok(data)
        }
        None => Err("No vault is open".to_string()),
    }
}

/// Get the link graph layout.
#[tauri::command]
#[instrument(skip(state))]
pub async fn get_graph_layout(
    width: f64,
    height: f64,
    state: State<'_, AppState>,
) -> Result<crate::state::response::GraphLayout, String> {
    let vault_guard = state.vault().lock().await;

    match vault_guard.as_ref() {
        Some(vault) => {
            let layout = vault.graph_layout(width, height);

            let nodes: Vec<_> = layout.nodes.into_iter()
                .map(|n| crate::state::response::GraphNode {
                    id: n.id,
                    label: n.label,
                    x: n.x,
                    y: n.y,
                })
                .collect();

            let edges: Vec<_> = layout.edges.into_iter()
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

/// Helper to convert NoteMeta to NoteSummary.
fn note_to_summary(meta: crate::note::NoteMeta) -> NoteSummary {
    NoteSummary {
        id: meta.id,
        path: meta.path,
        title: meta.title,
        created_at: meta.created_at,
        modified_at: meta.modified_at,
        word_count: meta.word_count,
    }
}
