//! Note-related Tauri commands.
//!
//! SPEC: COMP-NOTE-001 FR-1, FR-2, FR-3, FR-4, FR-5, FR-6, FR-10
//! SPEC: COMP-GRAPH-001 FR-6

use tauri::State;
use tracing::{info, instrument};
use std::collections::{BTreeMap, HashMap};
use std::path::{Path, PathBuf};
use walkdir::WalkDir;
use serde::Serialize;
use tauri::Window;
use crate::commands::emit_event;

use crate::state::response::{
    Backlink, ExplorerFolderNode, ExplorerNoteNode, ExplorerTree, Heading, NoteData, NoteSummary,
};
use crate::state::AppState;

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

/// SPEC: COMP-NOTE-001 FR-2, FR-10
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
    let mut vault_guard = state.vault().lock().await;

    match vault_guard.as_mut() {
        Some(vault) => {
            vault.save_note(&path, &content)
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
    let mut vault_guard = state.vault().lock().await;

    match vault_guard.as_mut() {
        Some(vault) => {
            vault.delete_note(&path)
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
    let mut vault_guard = state.vault().lock().await;

    match vault_guard.as_mut() {
        Some(vault) => {
            vault.rename_note(&old_path, &new_path)
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

/// SPEC: COMP-GRAPH-001 FR-6
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

/// SPEC: COMP-EXPLORER-TREE-001 FR-1, FR-2, FR-6, FR-7, FR-12
/// Get explorer tree with folders and notes (including empty folders).
#[tauri::command]
#[instrument(skip(state))]
pub async fn get_explorer_tree(state: State<'_, AppState>) -> Result<ExplorerTree, String> {
    let vault_guard = state.vault().lock().await;

    match vault_guard.as_ref() {
        Some(vault) => {
            let notes = vault
                .list_notes()
                .map_err(|e| e.to_response_string())?
                .into_iter()
                .map(note_to_summary)
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
    let mut vault_guard = state.vault().lock().await;

    match vault_guard.as_mut() {
        Some(vault) => {
            vault.create_directory(&path).map_err(|e| e.to_response_string())?;
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
            parent_entry
                .children
                .insert(path.to_string(), path.rsplit('/').next().unwrap_or(path).to_string());
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
        notes.sort_by(|a, b| a.display_title.to_ascii_lowercase().cmp(&b.display_title.to_ascii_lowercase()));

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
            .map(|p| normalize_rel_path(p))
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
            });
        }
    }

    build_node(
        &map,
        "",
        expansion_state_initialized,
        expanded_folders,
    )
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
        assert!(programming.folders.iter().any(|f| f.path == "Programming/empty"));
    }

    #[test]
    fn explorer_tree_falls_back_to_filename_stem_for_empty_title() {
        let root = Path::new("/tmp/vault");
        let notes = vec![
            note("b.md", "", 1),
            note("a.md", "Alpha", 2),
        ];

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

        let a = tree.folders.iter().find(|f| f.path == "A").expect("A exists");
        let b = a.folders.iter().find(|f| f.path == "A/B").expect("B exists");
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
}
