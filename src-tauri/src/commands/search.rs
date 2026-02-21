//! Search-related Tauri commands.
//!
//! SPEC: COMP-SEARCH-001 FR-4, FR-8

use tauri::State;
use tracing::instrument;

use crate::state::response::SearchResult;
use crate::state::AppState;

/// SPEC: COMP-SEARCH-001 FR-4
/// Search notes in the vault.
#[tauri::command]
#[instrument(skip(state))]
pub async fn search_notes(
    query: String,
    limit: Option<usize>,
    state: State<'_, AppState>,
) -> Result<Vec<SearchResult>, String> {
    let vault_guard = state.vault().lock().await;

    match vault_guard.as_ref() {
        Some(vault) => {
            let limit = limit.unwrap_or(20);
            let results = vault
                .search(&query, limit)
                .map_err(|e| e.to_response_string())?;

            let response: Vec<_> = results
                .into_iter()
                .map(|r| SearchResult {
                    path: r.path,
                    title: r.title,
                    excerpt: r.snippet, // search module uses "snippet", response uses "excerpt"
                    score: r.score,
                })
                .collect();

            Ok(response)
        }
        None => Err("No vault is open".to_string()),
    }
}

/// SPEC: COMP-SEARCH-001 FR-8
/// Get search suggestions as user types.
#[tauri::command]
#[instrument(skip(state))]
pub async fn search_suggestions(
    query: String,
    limit: Option<usize>,
    state: State<'_, AppState>,
) -> Result<Vec<String>, String> {
    let vault_guard = state.vault().lock().await;

    match vault_guard.as_ref() {
        Some(vault) => {
            let limit = limit.unwrap_or(10);

            // Search and extract unique titles
            let results = vault
                .search(&query, limit)
                .map_err(|e| e.to_response_string())?;

            let suggestions: Vec<_> = results.into_iter().map(|r| r.title).collect();

            Ok(suggestions)
        }
        None => Err("No vault is open".to_string()),
    }
}
