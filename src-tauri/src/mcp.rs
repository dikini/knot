//! MCP server implementation for Knot.
//!
//! SPEC: COMP-MCP-SERVER-001 FR-1, FR-2, FR-3, FR-4, FR-5, FR-6, FR-7, FR-8, FR-9, FR-10, FR-11
//! SPEC: COMP-MCP-SERVER-002 FR-1, FR-2, FR-3, FR-4, FR-5, FR-6, FR-7, FR-8
//! TRACE: DESIGN-mcp-server-core-tools-resources

use crate::core::VaultManager;
use crate::runtime::RuntimeHost;
use serde_json::{json, Value};
use std::collections::BTreeSet;
use std::io::{self, BufRead, BufReader, Read, Write};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Mutex;

const JSONRPC_VERSION: &str = "2.0";
const PROTOCOL_VERSION: &str = "2024-11-05";

pub struct McpServer {
    vault: Arc<Mutex<Option<VaultManager>>>,
    runtime: Option<RuntimeHost>,
    server_name: &'static str,
    server_version: &'static str,
}

impl McpServer {
    pub fn new(vault: VaultManager) -> Self {
        Self {
            vault: Arc::new(Mutex::new(Some(vault))),
            runtime: None,
            server_name: "knot-mcp",
            server_version: env!("CARGO_PKG_VERSION"),
        }
    }

    pub fn from_runtime(runtime: &RuntimeHost) -> Self {
        Self {
            vault: runtime.vault().clone(),
            runtime: Some(runtime.clone()),
            server_name: "knot-mcp",
            server_version: env!("CARGO_PKG_VERSION"),
        }
    }

    fn with_vault<T, F>(&self, f: F) -> Result<T, (i32, String)>
    where
        F: FnOnce(&VaultManager) -> Result<T, (i32, String)>,
    {
        let guard = self.vault.blocking_lock();
        let vault = guard
            .as_ref()
            .ok_or((-32000, "No vault is open".to_string()))?;
        f(vault)
    }

    fn with_vault_mut<T, F>(&self, f: F) -> Result<T, (i32, String)>
    where
        F: FnOnce(&mut VaultManager) -> Result<T, (i32, String)>,
    {
        let mut guard = self.vault.blocking_lock();
        let vault = guard
            .as_mut()
            .ok_or((-32000, "No vault is open".to_string()))?;
        f(vault)
    }

    fn with_runtime<T, F>(&self, f: F) -> Result<T, (i32, String)>
    where
        F: FnOnce(&RuntimeHost) -> Result<T, (i32, String)>,
    {
        let runtime = self
            .runtime
            .as_ref()
            .ok_or((-32000, "Runtime host is not available in this server mode".to_string()))?;
        f(runtime)
    }

    pub fn handle_request(&self, request: &Value) -> Option<Value> {
        let id = request.get("id").cloned();
        let method = request.get("method").and_then(Value::as_str).unwrap_or("");
        let params = request.get("params").cloned().unwrap_or_else(|| json!({}));

        match method {
            "initialize" => {
                // TRACE: DESIGN-knotd-mcp-ops
                let result = json!({
                    "protocolVersion": PROTOCOL_VERSION,
                    "capabilities": {
                        "tools": { "listChanged": false }
                    },
                    "serverInfo": {
                        "name": self.server_name,
                        "version": self.server_version,
                    }
                });
                id.map(|request_id| self.ok_response(request_id, result))
            }
            "initialized" => None,
            "tools/list" => id.map(|request_id| self.ok_response(request_id, self.tools_list())),
            "tools/call" => {
                let response = self.tools_call(&params);
                id.map(|request_id| match response {
                    Ok(result) => self.ok_response(request_id, result),
                    Err((code, message)) => self.error_response(request_id, code, &message),
                })
            }
            "resources/read" => {
                let response = self.resources_read(&params);
                id.map(|request_id| match response {
                    Ok(result) => self.ok_response(request_id, result),
                    Err((code, message)) => self.error_response(request_id, code, &message),
                })
            }
            _ => id.map(|request_id| self.error_response(request_id, -32601, "Method not found")),
        }
    }

    fn tools_list(&self) -> Value {
        json!({
            "tools": [
                {
                    "name": "search_notes",
                    "description": "Search notes by query text.",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "query": { "type": "string" },
                            "limit": { "type": "integer", "minimum": 1, "maximum": 200 }
                        },
                        "required": ["query"]
                    }
                },
                {
                    "name": "get_note",
                    "description": "Get a note by path, including markdown content.",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "path": { "type": "string" }
                        },
                        "required": ["path"]
                    }
                },
                {
                    "name": "list_tags",
                    "description": "List all tags in the current vault.",
                    "inputSchema": {
                        "type": "object",
                        "properties": {}
                    }
                },
                {
                    "name": "graph_neighbors",
                    "description": "Get graph neighbors for a note path up to depth.",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "path": { "type": "string" },
                            "depth": { "type": "integer", "minimum": 1, "maximum": 8 }
                        },
                        "required": ["path"]
                    }
                },
                {
                    "name": "create_note",
                    "description": "Create a new markdown note at path.",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "path": { "type": "string" },
                            "content": { "type": "string" }
                        },
                        "required": ["path"]
                    }
                },
                {
                    "name": "delete_note",
                    "description": "Delete a markdown note by path.",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "path": { "type": "string" }
                        },
                        "required": ["path"]
                    }
                },
                {
                    "name": "replace_note",
                    "description": "Replace note markdown content by path.",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "path": { "type": "string" },
                            "content": { "type": "string" }
                        },
                        "required": ["path", "content"]
                    }
                },
                {
                    "name": "create_directory",
                    "description": "Create a directory in the vault.",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "path": { "type": "string" }
                        },
                        "required": ["path"]
                    }
                },
                {
                    "name": "remove_directory",
                    "description": "Remove a directory in the vault.",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "path": { "type": "string" },
                            "recursive": { "type": "boolean" }
                        },
                        "required": ["path"]
                    }
                },
                {
                    "name": "rename_directory",
                    "description": "Rename or move a directory in the vault.",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "old_path": { "type": "string" },
                            "new_path": { "type": "string" }
                        },
                        "required": ["old_path", "new_path"]
                    }
                },
                {
                    "name": "list_directory",
                    "description": "List entries in a vault directory.",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "path": { "type": "string" }
                        }
                    }
                },
                {
                    "name": "list_notes",
                    "description": "List notes as UI note summaries.",
                    "inputSchema": { "type": "object", "properties": {} }
                },
                {
                    "name": "save_note",
                    "description": "Save a note by path and content.",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "path": { "type": "string" },
                            "content": { "type": "string" }
                        },
                        "required": ["path", "content"]
                    }
                },
                {
                    "name": "rename_note",
                    "description": "Rename/move note.",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "old_path": { "type": "string" },
                            "new_path": { "type": "string" }
                        },
                        "required": ["old_path", "new_path"]
                    }
                },
                {
                    "name": "search_suggestions",
                    "description": "Search suggestions by title.",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "query": { "type": "string" },
                            "limit": { "type": "integer", "minimum": 1, "maximum": 100 }
                        },
                        "required": ["query"]
                    }
                },
                {
                    "name": "get_graph_layout",
                    "description": "Get graph layout payload for UI.",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "width": { "type": "number" },
                            "height": { "type": "number" }
                        },
                        "required": ["width", "height"]
                    }
                },
                {
                    "name": "set_folder_expanded",
                    "description": "Persist explorer folder expansion state.",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "path": { "type": "string" },
                            "expanded": { "type": "boolean" }
                        },
                        "required": ["path", "expanded"]
                    }
                },
                {
                    "name": "get_vault_info",
                    "description": "Get currently open vault info payload.",
                    "inputSchema": { "type": "object", "properties": {} }
                },
                {
                    "name": "is_vault_open",
                    "description": "Return whether vault is open.",
                    "inputSchema": { "type": "object", "properties": {} }
                },
                {
                    "name": "get_recent_notes",
                    "description": "Get recent notes payload.",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "limit": { "type": "integer", "minimum": 1, "maximum": 500 }
                        }
                    }
                },
                {
                    "name": "sync_external_changes",
                    "description": "Run watcher sync and return changed count.",
                    "inputSchema": { "type": "object", "properties": {} }
                },
                {
                    "name": "get_vault_settings",
                    "description": "Read vault settings JSON.",
                    "inputSchema": { "type": "object", "properties": {} }
                },
                {
                    "name": "update_vault_settings",
                    "description": "Apply settings merge patch JSON.",
                    "inputSchema": {
                        "type": "object",
                        "properties": { "patch": {} },
                        "required": ["patch"]
                    }
                },
                {
                    "name": "reindex_vault",
                    "description": "Run full reindex and return count.",
                    "inputSchema": { "type": "object", "properties": {} }
                },
                {
                    "name": "create_vault",
                    "description": "Create and open vault at path (runtime-backed mode).",
                    "inputSchema": {
                        "type": "object",
                        "properties": { "path": { "type": "string" } },
                        "required": ["path"]
                    }
                },
                {
                    "name": "open_vault",
                    "description": "Open vault at path (runtime-backed mode).",
                    "inputSchema": {
                        "type": "object",
                        "properties": { "path": { "type": "string" } },
                        "required": ["path"]
                    }
                },
                {
                    "name": "close_vault",
                    "description": "Close currently open vault (runtime-backed mode).",
                    "inputSchema": { "type": "object", "properties": {} }
                },
                {
                    "name": "get_explorer_tree",
                    "description": "Get explorer tree payload.",
                    "inputSchema": { "type": "object", "properties": {} }
                }
            ]
        })
    }

    fn tools_call(&self, params: &Value) -> Result<Value, (i32, String)> {
        let name = params
            .get("name")
            .and_then(Value::as_str)
            .ok_or((-32602, "Missing tool name".to_string()))?;

        let arguments = params
            .get("arguments")
            .cloned()
            .unwrap_or_else(|| json!({}));

        match name {
            "search_notes" => {
                let query = arguments
                    .get("query")
                    .and_then(Value::as_str)
                    .ok_or((-32602, "Missing argument: query".to_string()))?;
                let limit = arguments.get("limit").and_then(Value::as_u64).unwrap_or(20) as usize;

                let results = self.with_vault(|vault| {
                    vault
                        .search(query, limit)
                        .map_err(|e| (-32000, e.to_response_string()))
                })?;

                let payload = results
                    .into_iter()
                    .map(|r| {
                        json!({
                            "path": r.path,
                            "title": r.title,
                            "excerpt": r.snippet,
                            "score": r.score
                        })
                    })
                    .collect::<Vec<_>>();

                Ok(json!({
                    "content": [
                        {
                            "type": "text",
                            "text": serde_json::to_string_pretty(&payload).unwrap_or_else(|_| "[]".to_string())
                        }
                    ],
                    "isError": false
                }))
            }
            "get_note" => {
                let path = arguments
                    .get("path")
                    .and_then(Value::as_str)
                    .ok_or((-32602, "Missing argument: path".to_string()))?;

                let payload = self.with_vault(|vault| {
                    let note = vault
                        .get_note(path)
                        .map_err(|e| (-32000, e.to_response_string()))?;
                    let note_headings = note.headings();
                    let backlinks = vault
                        .graph()
                        .backlinks(path)
                        .into_iter()
                        .map(|(source, context)| {
                            let source_title = vault
                                .get_note(&source)
                                .map(|source_note| source_note.title().to_string())
                                .unwrap_or_else(|_| {
                                    std::path::PathBuf::from(&source)
                                        .file_stem()
                                        .map(|v| v.to_string_lossy().to_string())
                                        .unwrap_or(source.clone())
                                });
                            json!({
                                "source_path": source,
                                "source_title": source_title,
                                "context": context
                            })
                        })
                        .collect::<Vec<_>>();

                    Ok(json!({
                        "id": note.id(),
                        "path": note.path(),
                        "title": note.title(),
                        "content": note.content(),
                        "created_at": note.created_at(),
                        "modified_at": note.modified_at(),
                        "word_count": note.word_count(),
                        "headings": note_headings
                            .iter()
                            .map(|h| json!({"level": h.level as u8, "text": h.text, "position": 0}))
                            .collect::<Vec<_>>(),
                        "backlinks": backlinks
                    }))
                })?;

                Ok(json!({
                    "content": [
                        {
                            "type": "text",
                            "text": serde_json::to_string_pretty(&payload).unwrap_or_else(|_| "{}".to_string())
                        }
                    ],
                    "isError": false
                }))
            }
            "list_tags" => {
                let tags = self.with_vault(|vault| {
                    vault
                        .list_tags()
                        .map_err(|e| (-32000, e.to_response_string()))
                })?;

                Ok(json!({
                    "content": [
                        {
                            "type": "text",
                            "text": serde_json::to_string_pretty(&tags).unwrap_or_else(|_| "[]".to_string())
                        }
                    ],
                    "isError": false
                }))
            }
            "graph_neighbors" => {
                let path = arguments
                    .get("path")
                    .and_then(Value::as_str)
                    .ok_or((-32602, "Missing argument: path".to_string()))?;
                let depth = arguments.get("depth").and_then(Value::as_u64).unwrap_or(1) as usize;

                let payload = self.with_vault(|vault| {
                    let nodes = vault.graph_neighbors(path, depth);
                    let mut edge_set = BTreeSet::<(String, String)>::new();
                    for node in &nodes {
                        for target in vault.graph().get_forward_links(node) {
                            if nodes.contains(&target) {
                                edge_set.insert((node.clone(), target));
                            }
                        }
                    }
                    let edges = edge_set
                        .into_iter()
                        .map(|(source, target)| json!({"source": source, "target": target}))
                        .collect::<Vec<_>>();

                    Ok(json!({
                        "nodes": nodes,
                        "edges": edges,
                    }))
                })?;

                Ok(json!({
                    "content": [
                        {
                            "type": "text",
                            "text": serde_json::to_string_pretty(&payload).unwrap_or_else(|_| "{}".to_string())
                        }
                    ],
                    "isError": false
                }))
            }
            "create_note" => {
                let path = arguments
                    .get("path")
                    .and_then(Value::as_str)
                    .ok_or((-32602, "Missing argument: path".to_string()))?;
                let content = arguments
                    .get("content")
                    .and_then(Value::as_str)
                    .unwrap_or_default();

                self.with_vault_mut(|vault| {
                    if vault.get_note(path).is_ok() {
                        return Err((-32000, format!("Note already exists: {path}")));
                    }
                    vault
                        .save_note(path, content)
                        .map_err(|e| (-32000, e.to_response_string()))?;
                    Ok(())
                })?;

                let payload = self.with_vault(|vault| {
                    let note = vault
                        .get_note(path)
                        .map_err(|e| (-32000, e.to_response_string()))?;
                    Ok(json!({
                        "id": note.id(),
                        "path": note.path(),
                        "title": note.title(),
                        "content": note.content(),
                        "created_at": note.created_at(),
                        "modified_at": note.modified_at(),
                        "word_count": note.word_count(),
                        "headings": note
                            .headings()
                            .into_iter()
                            .map(|h| json!({"level": h.level as u8, "text": h.text, "position": 0}))
                            .collect::<Vec<_>>(),
                        "backlinks": []
                    }))
                })?;

                Ok(json!({
                    "content": [{ "type": "text", "text": serde_json::to_string_pretty(&payload).unwrap_or_else(|_| "{}".to_string()) }],
                    "isError": false
                }))
            }
            "delete_note" => {
                let path = arguments
                    .get("path")
                    .and_then(Value::as_str)
                    .ok_or((-32602, "Missing argument: path".to_string()))?;

                self.with_vault_mut(|vault| {
                    vault
                        .delete_note(path)
                        .map_err(|e| (-32000, e.to_response_string()))?;
                    Ok(())
                })?;

                Ok(json!({
                    "content": [{ "type": "text", "text": format!("Deleted note: {path}") }],
                    "isError": false
                }))
            }
            "replace_note" => {
                let path = arguments
                    .get("path")
                    .and_then(Value::as_str)
                    .ok_or((-32602, "Missing argument: path".to_string()))?;
                let content = arguments
                    .get("content")
                    .and_then(Value::as_str)
                    .ok_or((-32602, "Missing argument: content".to_string()))?;

                self.with_vault_mut(|vault| {
                    vault
                        .save_note(path, content)
                        .map_err(|e| (-32000, e.to_response_string()))?;
                    Ok(())
                })?;

                Ok(json!({
                    "content": [{ "type": "text", "text": format!("Replaced note content: {path}") }],
                    "isError": false
                }))
            }
            "create_directory" => {
                let path = arguments
                    .get("path")
                    .and_then(Value::as_str)
                    .ok_or((-32602, "Missing argument: path".to_string()))?;

                self.with_vault(|vault| {
                    vault
                        .create_directory(path)
                        .map_err(|e| (-32000, e.to_response_string()))?;
                    Ok(())
                })?;

                Ok(json!({
                    "content": [{ "type": "text", "text": format!("Created directory: {path}") }],
                    "isError": false
                }))
            }
            "remove_directory" => {
                let path = arguments
                    .get("path")
                    .and_then(Value::as_str)
                    .ok_or((-32602, "Missing argument: path".to_string()))?;
                let recursive = arguments
                    .get("recursive")
                    .and_then(Value::as_bool)
                    .unwrap_or(true);

                let normalized = normalize_rel_dir_for_mcp(path).map_err(|e| (-32602, e))?;
                self.with_vault_mut(|vault| {
                    let target = vault.root_path().join(&normalized);

                    let prefix = format!("{normalized}/");
                    let notes_to_delete = vault
                        .list_notes()
                        .map_err(|e| (-32000, e.to_response_string()))?
                        .into_iter()
                        .map(|n| n.path)
                        .filter(|p| p == &normalized || p.starts_with(&prefix))
                        .collect::<Vec<_>>();

                    for note_path in notes_to_delete {
                        vault
                            .delete_note(&note_path)
                            .map_err(|e| (-32000, e.to_response_string()))?;
                    }

                    if target.exists() {
                        if recursive {
                            std::fs::remove_dir_all(&target).map_err(|e| {
                                (-32000, format!("Failed to remove directory: {e}"))
                            })?;
                        } else {
                            std::fs::remove_dir(&target).map_err(|e| {
                                (-32000, format!("Failed to remove directory: {e}"))
                            })?;
                        }
                    }
                    Ok(())
                })?;

                Ok(json!({
                    "content": [{ "type": "text", "text": format!("Removed directory: {path}") }],
                    "isError": false
                }))
            }
            "rename_directory" => {
                let old_path = arguments
                    .get("old_path")
                    .and_then(Value::as_str)
                    .ok_or((-32602, "Missing argument: old_path".to_string()))?;
                let new_path = arguments
                    .get("new_path")
                    .and_then(Value::as_str)
                    .ok_or((-32602, "Missing argument: new_path".to_string()))?;

                self.with_vault_mut(|vault| {
                    vault
                        .rename_directory(old_path, new_path)
                        .map_err(|e| (-32000, e.to_response_string()))?;
                    Ok(())
                })?;

                Ok(json!({
                    "content": [{ "type": "text", "text": format!("Renamed directory: {old_path} -> {new_path}") }],
                    "isError": false
                }))
            }
            "list_directory" => {
                let maybe_path = arguments.get("path").and_then(Value::as_str).map(str::trim);
                let entries = self.with_vault(|vault| {
                    let dir_path = resolve_directory_path(vault, maybe_path)?;
                    let mut entries = std::fs::read_dir(&dir_path)
                        .map_err(|e| (-32000, format!("Failed to read directory: {e}")))?
                        .filter_map(|entry| entry.ok())
                        .map(|entry| {
                            let file_type = entry.file_type().ok();
                            let is_dir = file_type.as_ref().map(|t| t.is_dir()).unwrap_or(false);
                            let is_file = file_type.as_ref().map(|t| t.is_file()).unwrap_or(false);
                            let name = entry.file_name().to_string_lossy().to_string();
                            let rel = entry
                                .path()
                                .strip_prefix(vault.root_path())
                                .map(|p| p.to_string_lossy().replace('\\', "/"))
                                .unwrap_or_else(|_| name.clone());
                            json!({
                                "name": name,
                                "path": rel,
                                "entry_type": if is_dir { "directory" } else if is_file { "file" } else { "other" }
                            })
                        })
                        .collect::<Vec<_>>();
                    entries.sort_by(|a, b| a["path"].as_str().cmp(&b["path"].as_str()));
                    Ok(entries)
                })?;

                Ok(json!({
                    "content": [{
                        "type": "text",
                        "text": serde_json::to_string_pretty(&entries).unwrap_or_else(|_| "[]".to_string())
                    }],
                    "isError": false
                }))
            }
            "list_notes" => {
                let payload = self.with_vault(|vault| {
                    let notes = vault
                        .list_notes()
                        .map_err(|e| (-32000, e.to_response_string()))?
                        .into_iter()
                        .map(|n| {
                            json!({
                                "id": n.id,
                                "path": n.path,
                                "title": n.title,
                                "created_at": n.created_at,
                                "modified_at": n.modified_at,
                                "word_count": n.word_count
                            })
                        })
                        .collect::<Vec<_>>();
                    Ok(notes)
                })?;
                Ok(json!({
                    "content": [{ "type": "text", "text": serde_json::to_string_pretty(&payload).unwrap_or_else(|_| "[]".to_string()) }],
                    "isError": false
                }))
            }
            "save_note" => {
                let path = arguments
                    .get("path")
                    .and_then(Value::as_str)
                    .ok_or((-32602, "Missing argument: path".to_string()))?;
                let content = arguments
                    .get("content")
                    .and_then(Value::as_str)
                    .ok_or((-32602, "Missing argument: content".to_string()))?;
                self.with_vault_mut(|vault| {
                    vault
                        .save_note(path, content)
                        .map_err(|e| (-32000, e.to_response_string()))?;
                    Ok(())
                })?;
                Ok(json!({ "content": [{ "type": "text", "text": "null" }], "isError": false }))
            }
            "rename_note" => {
                let old_path = arguments
                    .get("old_path")
                    .and_then(Value::as_str)
                    .ok_or((-32602, "Missing argument: old_path".to_string()))?;
                let new_path = arguments
                    .get("new_path")
                    .and_then(Value::as_str)
                    .ok_or((-32602, "Missing argument: new_path".to_string()))?;
                self.with_vault_mut(|vault| {
                    vault
                        .rename_note(old_path, new_path)
                        .map_err(|e| (-32000, e.to_response_string()))?;
                    Ok(())
                })?;
                Ok(json!({ "content": [{ "type": "text", "text": "null" }], "isError": false }))
            }
            "search_suggestions" => {
                let query = arguments
                    .get("query")
                    .and_then(Value::as_str)
                    .ok_or((-32602, "Missing argument: query".to_string()))?;
                let limit = arguments.get("limit").and_then(Value::as_u64).unwrap_or(10) as usize;
                let suggestions = self.with_vault(|vault| {
                    let results = vault
                        .search(query, limit)
                        .map_err(|e| (-32000, e.to_response_string()))?;
                    Ok(results.into_iter().map(|r| r.title).collect::<Vec<_>>())
                })?;
                Ok(json!({
                    "content": [{ "type": "text", "text": serde_json::to_string_pretty(&suggestions).unwrap_or_else(|_| "[]".to_string()) }],
                    "isError": false
                }))
            }
            "get_graph_layout" => {
                let width = arguments
                    .get("width")
                    .and_then(Value::as_f64)
                    .ok_or((-32602, "Missing argument: width".to_string()))?;
                let height = arguments
                    .get("height")
                    .and_then(Value::as_f64)
                    .ok_or((-32602, "Missing argument: height".to_string()))?;
                let payload = self.with_vault(|vault| {
                    let layout = vault.graph_layout(width, height);
                    let nodes = layout
                        .nodes
                        .into_iter()
                        .map(|n| json!({"id": n.id, "label": n.label, "x": n.x, "y": n.y}))
                        .collect::<Vec<_>>();
                    let edges = layout
                        .edges
                        .into_iter()
                        .map(|e| json!({"source": e.source, "target": e.target}))
                        .collect::<Vec<_>>();
                    Ok(json!({ "nodes": nodes, "edges": edges }))
                })?;
                Ok(json!({
                    "content": [{ "type": "text", "text": serde_json::to_string_pretty(&payload).unwrap_or_else(|_| "{}".to_string()) }],
                    "isError": false
                }))
            }
            "set_folder_expanded" => {
                let path = arguments
                    .get("path")
                    .and_then(Value::as_str)
                    .ok_or((-32602, "Missing argument: path".to_string()))?;
                let expanded = arguments
                    .get("expanded")
                    .and_then(Value::as_bool)
                    .ok_or((-32602, "Missing argument: expanded".to_string()))?;
                self.with_vault_mut(|vault| {
                    vault
                        .set_folder_expanded(path, expanded)
                        .map_err(|e| (-32000, e.to_response_string()))?;
                    Ok(())
                })?;
                Ok(json!({ "content": [{ "type": "text", "text": "null" }], "isError": false }))
            }
            "get_vault_info" => {
                let payload = self.with_vault(|vault| {
                    let path = vault.root_path().to_string_lossy().to_string();
                    let name = vault
                        .root_path()
                        .file_name()
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_else(|| "Vault".to_string());
                    let note_count = vault.note_count().map_err(|e| (-32000, e.to_response_string()))?;
                    let last_modified = std::fs::metadata(vault.root_path())
                        .and_then(|m| m.modified())
                        .ok()
                        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                        .map(|d| d.as_secs() as i64)
                        .unwrap_or_else(|| chrono::Utc::now().timestamp());
                    Ok(json!({"path": path, "name": name, "note_count": note_count, "last_modified": last_modified}))
                })?;
                Ok(json!({
                    "content": [{ "type": "text", "text": serde_json::to_string_pretty(&payload).unwrap_or_else(|_| "{}".to_string()) }],
                    "isError": false
                }))
            }
            "is_vault_open" => {
                let is_open = self.with_runtime(|runtime| Ok(runtime.vault().blocking_lock().is_some()))?;
                Ok(json!({ "content": [{ "type": "text", "text": serde_json::to_string(&is_open).unwrap_or_else(|_| "false".to_string()) }], "isError": false }))
            }
            "get_recent_notes" => {
                let limit = arguments.get("limit").and_then(Value::as_u64).unwrap_or(20) as usize;
                let payload = self.with_vault(|vault| {
                    let mut notes = vault
                        .list_notes()
                        .map_err(|e| (-32000, e.to_response_string()))?;
                    notes.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));
                    notes.truncate(limit);
                    Ok(notes
                        .into_iter()
                        .map(|n| json!({
                            "id": n.id,
                            "path": n.path,
                            "title": n.title,
                            "created_at": n.created_at,
                            "modified_at": n.modified_at,
                            "word_count": n.word_count
                        }))
                        .collect::<Vec<_>>())
                })?;
                Ok(json!({
                    "content": [{ "type": "text", "text": serde_json::to_string_pretty(&payload).unwrap_or_else(|_| "[]".to_string()) }],
                    "isError": false
                }))
            }
            "sync_external_changes" => {
                let changed = self.with_vault_mut(|vault| {
                    vault
                        .sync_external_changes()
                        .map_err(|e| (-32000, e.to_response_string()))
                })?;
                Ok(json!({
                    "content": [{ "type": "text", "text": serde_json::to_string(&json!({"changed_count": changed})).unwrap_or_else(|_| "{\"changed_count\":0}".to_string()) }],
                    "isError": false
                }))
            }
            "get_vault_settings" => {
                let payload = self.with_vault(|vault| {
                    vault
                        .get_vault_settings_value()
                        .map_err(|e| (-32000, e.to_response_string()))
                })?;
                Ok(json!({
                    "content": [{ "type": "text", "text": serde_json::to_string_pretty(&payload).unwrap_or_else(|_| "{}".to_string()) }],
                    "isError": false
                }))
            }
            "update_vault_settings" => {
                let patch = arguments.get("patch").cloned().ok_or((-32602, "Missing argument: patch".to_string()))?;
                let payload = self.with_vault_mut(|vault| {
                    vault
                        .update_vault_settings_patch(&patch)
                        .map_err(|e| (-32000, e.to_response_string()))
                })?;
                Ok(json!({
                    "content": [{ "type": "text", "text": serde_json::to_string_pretty(&payload).unwrap_or_else(|_| "{}".to_string()) }],
                    "isError": false
                }))
            }
            "reindex_vault" => {
                let count = self.with_vault_mut(|vault| {
                    vault
                        .full_reindex()
                        .map_err(|e| (-32000, e.to_response_string()))
                })?;
                Ok(json!({
                    "content": [{ "type": "text", "text": serde_json::to_string(&json!({"reindexed_count": count})).unwrap_or_else(|_| "{\"reindexed_count\":0}".to_string()) }],
                    "isError": false
                }))
            }
            "create_vault" => {
                let path = arguments
                    .get("path")
                    .and_then(Value::as_str)
                    .ok_or((-32602, "Missing argument: path".to_string()))?;
                let target = PathBuf::from(path);
                self.with_runtime(|runtime| {
                    if runtime.vault().blocking_lock().is_some() {
                        futures::executor::block_on(runtime.close())
                            .map_err(|e| (-32000, e.to_response_string()))?;
                    }
                    futures::executor::block_on(runtime.create_new(&target))
                        .map_err(|e| (-32000, e.to_response_string()))
                })?;
                let info = self.with_vault(|vault| {
                    let path = vault.root_path().to_string_lossy().to_string();
                    let name = vault
                        .root_path()
                        .file_name()
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_else(|| "Vault".to_string());
                    let note_count = vault.note_count().map_err(|e| (-32000, e.to_response_string()))?;
                    let last_modified = std::fs::metadata(vault.root_path())
                        .and_then(|m| m.modified())
                        .ok()
                        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                        .map(|d| d.as_secs() as i64)
                        .unwrap_or_else(|| chrono::Utc::now().timestamp());
                    Ok(json!({"path": path, "name": name, "note_count": note_count, "last_modified": last_modified}))
                })?;
                Ok(json!({ "content": [{ "type": "text", "text": serde_json::to_string_pretty(&info).unwrap_or_else(|_| "{}".to_string()) }], "isError": false }))
            }
            "open_vault" => {
                let path = arguments
                    .get("path")
                    .and_then(Value::as_str)
                    .ok_or((-32602, "Missing argument: path".to_string()))?;
                let target = PathBuf::from(path);
                self.with_runtime(|runtime| {
                    if runtime.vault().blocking_lock().is_some() {
                        futures::executor::block_on(runtime.close())
                            .map_err(|e| (-32000, e.to_response_string()))?;
                    }
                    futures::executor::block_on(runtime.open_existing(&target))
                        .map_err(|e| (-32000, e.to_response_string()))
                })?;
                let info = self.with_vault(|vault| {
                    let path = vault.root_path().to_string_lossy().to_string();
                    let name = vault
                        .root_path()
                        .file_name()
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_else(|| "Vault".to_string());
                    let note_count = vault.note_count().map_err(|e| (-32000, e.to_response_string()))?;
                    let last_modified = std::fs::metadata(vault.root_path())
                        .and_then(|m| m.modified())
                        .ok()
                        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                        .map(|d| d.as_secs() as i64)
                        .unwrap_or_else(|| chrono::Utc::now().timestamp());
                    Ok(json!({"path": path, "name": name, "note_count": note_count, "last_modified": last_modified}))
                })?;
                Ok(json!({ "content": [{ "type": "text", "text": serde_json::to_string_pretty(&info).unwrap_or_else(|_| "{}".to_string()) }], "isError": false }))
            }
            "close_vault" => {
                self.with_runtime(|runtime| {
                    futures::executor::block_on(runtime.close())
                        .map_err(|e| (-32000, e.to_response_string()))
                })?;
                Ok(json!({ "content": [{ "type": "text", "text": "null" }], "isError": false }))
            }
            "get_explorer_tree" => {
                let payload = self.with_vault(|vault| {
                    let mut notes = vault
                        .list_notes()
                        .map_err(|e| (-32000, e.to_response_string()))?
                        .into_iter()
                        .map(|n| json!({
                            "path": n.path,
                            "title": n.title,
                            "display_title": n.title,
                            "modified_at": n.modified_at,
                            "word_count": n.word_count
                        }))
                        .collect::<Vec<_>>();
                    notes.sort_by(|a, b| a["path"].as_str().cmp(&b["path"].as_str()));
                    let root_name = vault
                        .root_path()
                        .file_name()
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_else(|| "Vault".to_string());
                    Ok(json!({
                        "root": {
                            "path": "",
                            "name": root_name,
                            "expanded": true,
                            "folders": [],
                            "notes": notes
                        },
                        "hidden_policy": "hide-dotfiles"
                    }))
                })?;
                Ok(json!({
                    "content": [{ "type": "text", "text": serde_json::to_string_pretty(&payload).unwrap_or_else(|_| "{}".to_string()) }],
                    "isError": false
                }))
            }
            _ => Err((-32601, format!("Unknown tool: {name}"))),
        }
    }

    fn resources_read(&self, params: &Value) -> Result<Value, (i32, String)> {
        let uri = params
            .get("uri")
            .and_then(Value::as_str)
            .ok_or((-32602, "Missing uri".to_string()))?;

        let path = parse_note_uri(uri).map_err(|e| (-32602, e))?;
        let note = self.with_vault(|vault| {
            vault
                .get_note(&path)
                .map_err(|e| (-32000, e.to_response_string()))
        })?;

        Ok(json!({
            "contents": [
                {
                    "uri": uri,
                    "mimeType": "text/markdown",
                    "text": note.content(),
                }
            ]
        }))
    }

    fn ok_response(&self, id: Value, result: Value) -> Value {
        json!({
            "jsonrpc": JSONRPC_VERSION,
            "id": id,
            "result": result,
        })
    }

    fn error_response(&self, id: Value, code: i32, message: &str) -> Value {
        json!({
            "jsonrpc": JSONRPC_VERSION,
            "id": id,
            "error": {
                "code": code,
                "message": message,
            },
        })
    }
}

pub fn note_uri(path: &str) -> String {
    format!("knot://note/{}", hex_encode(path.as_bytes()))
}

pub fn parse_note_uri(uri: &str) -> Result<String, String> {
    let encoded = uri
        .strip_prefix("knot://note/")
        .ok_or_else(|| "Unsupported note URI".to_string())?;
    let bytes = hex_decode(encoded)?;
    String::from_utf8(bytes).map_err(|_| "Invalid UTF-8 note URI".to_string())
}

fn hex_encode(bytes: &[u8]) -> String {
    let mut out = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        use std::fmt::Write as _;
        let _ = write!(out, "{b:02x}");
    }
    out
}

fn hex_decode(input: &str) -> Result<Vec<u8>, String> {
    if input.len() % 2 != 0 {
        return Err("Invalid hex length".to_string());
    }

    (0..input.len())
        .step_by(2)
        .map(|idx| {
            u8::from_str_radix(&input[idx..idx + 2], 16)
                .map_err(|_| "Invalid hex character".to_string())
        })
        .collect()
}

fn resolve_directory_path(
    vault: &VaultManager,
    path: Option<&str>,
) -> Result<std::path::PathBuf, (i32, String)> {
    let Some(value) = path else {
        return Ok(vault.root_path().to_path_buf());
    };

    if value.is_empty() || value == "." {
        return Ok(vault.root_path().to_path_buf());
    }

    if value.starts_with('/') {
        return Err((
            -32602,
            "Directory path must be relative to vault root".to_string(),
        ));
    }

    let normalized = value.replace('\\', "/").trim_matches('/').to_string();
    if normalized
        .split('/')
        .any(|segment| segment.is_empty() || segment == "." || segment == "..")
    {
        return Err((-32602, "Invalid directory path".to_string()));
    }

    Ok(vault.root_path().join(normalized))
}

fn normalize_rel_dir_for_mcp(path: &str) -> Result<String, String> {
    let normalized = path.trim().replace('\\', "/").trim_matches('/').to_string();
    if normalized.is_empty() {
        return Err("Invalid directory path".to_string());
    }
    if normalized.starts_with('.') {
        return Err("Invalid directory path".to_string());
    }
    if normalized
        .split('/')
        .any(|segment| segment.is_empty() || segment == "." || segment == "..")
    {
        return Err("Invalid directory path".to_string());
    }
    Ok(normalized)
}

pub fn run_stdio_server<R: Read, W: Write>(
    server: &McpServer,
    input: R,
    mut output: W,
) -> io::Result<()> {
    let mut reader = BufReader::new(input);
    loop {
        let message = match read_framed_message(&mut reader)? {
            Some(msg) => msg,
            None => return Ok(()),
        };

        let request: Value = match serde_json::from_str(&message) {
            Ok(v) => v,
            Err(err) => {
                let response = json!({
                    "jsonrpc": JSONRPC_VERSION,
                    "id": null,
                    "error": {
                        "code": -32700,
                        "message": format!("Parse error: {err}"),
                    }
                });
                write_framed_message(&mut output, &response)?;
                continue;
            }
        };

        if let Some(response) = server.handle_request(&request) {
            write_framed_message(&mut output, &response)?;
        }
    }
}

fn read_framed_message<R: BufRead>(reader: &mut R) -> io::Result<Option<String>> {
    let mut content_length: Option<usize> = None;
    let mut line = String::new();

    loop {
        line.clear();
        let read = reader.read_line(&mut line)?;
        if read == 0 {
            return Ok(None);
        }

        let trimmed = line.trim_end_matches(['\r', '\n']);
        if trimmed.is_empty() {
            break;
        }

        if let Some((name, value)) = trimmed.split_once(':') {
            if name.eq_ignore_ascii_case("Content-Length") {
                content_length = value.trim().parse::<usize>().ok();
            }
        }
    }

    let len = content_length
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "Missing Content-Length"))?;

    let mut body = vec![0_u8; len];
    reader.read_exact(&mut body)?;

    String::from_utf8(body)
        .map(Some)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))
}

fn write_framed_message<W: Write>(output: &mut W, value: &Value) -> io::Result<()> {
    let payload =
        serde_json::to_vec(value).map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;

    write!(output, "Content-Length: {}\r\n\r\n", payload.len())?;
    output.write_all(&payload)?;
    output.flush()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::VaultManager;
    use crate::runtime::{RuntimeHost, RuntimeMode};
    use serde_json::json;
    use tempfile::tempdir;

    fn setup_server() -> McpServer {
        let dir = tempdir().expect("tempdir");
        let root = dir.keep();
        let mut vault = VaultManager::create(&root).expect("create vault");

        vault
            .save_note(
                "programming/rust.md",
                "# Rust\n\nRust note with #rust and [[programming/python]].",
            )
            .expect("save rust");
        vault
            .save_note(
                "programming/python.md",
                "# Python\n\nPython note with #python.",
            )
            .expect("save python");

        McpServer::new(vault)
    }

    fn setup_runtime_backed_server() -> McpServer {
        let dir = tempdir().expect("tempdir");
        let root = dir.keep();
        let runtime = RuntimeHost::new(RuntimeMode::DesktopEmbedded);
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("tokio runtime");

        rt.block_on(async {
            runtime.create_new(&root).await.expect("create runtime vault");
            runtime
                .with_manager_mut(|vault| {
                    vault
                        .save_note(
                            "runtime/hello.md",
                            "# Runtime\n\nRuntime-backed MCP note with #runtime.",
                        )
                        .map_err(|e| crate::error::KnotError::Other(e.to_response_string()))?;
                    Ok(())
                })
                .await
                .expect("seed note");
        });

        McpServer::from_runtime(&runtime)
    }

    #[test]
    fn initialize_returns_capabilities() {
        let server = setup_server();
        let response = server
            .handle_request(&json!({
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {}
            }))
            .expect("initialize response");

        assert_eq!(
            response["result"]["protocolVersion"],
            json!(PROTOCOL_VERSION)
        );
        assert!(response["result"]["capabilities"]["tools"].is_object());
        assert!(
            response["result"]["capabilities"]
                .get("resources")
                .is_none()
        );
    }

    #[test]
    fn tools_list_contains_core_tools() {
        let server = setup_server();
        let response = server
            .handle_request(&json!({
                "jsonrpc": "2.0",
                "id": 2,
                "method": "tools/list",
                "params": {}
            }))
            .expect("tools/list response");

        let tools = response["result"]["tools"].as_array().expect("tools array");
        let names = tools
            .iter()
            .filter_map(|t| t.get("name").and_then(Value::as_str))
            .collect::<Vec<_>>();

        assert!(names.contains(&"search_notes"));
        assert!(names.contains(&"get_note"));
        assert!(names.contains(&"list_tags"));
        assert!(names.contains(&"graph_neighbors"));
        assert!(names.contains(&"create_note"));
        assert!(names.contains(&"delete_note"));
        assert!(names.contains(&"replace_note"));
        assert!(names.contains(&"create_directory"));
        assert!(names.contains(&"remove_directory"));
        assert!(names.contains(&"rename_directory"));
        assert!(names.contains(&"list_directory"));
    }

    #[test]
    fn tools_call_get_note_returns_content() {
        let server = setup_server();
        let response = server
            .handle_request(&json!({
                "jsonrpc": "2.0",
                "id": 3,
                "method": "tools/call",
                "params": {
                    "name": "get_note",
                    "arguments": { "path": "programming/rust.md" }
                }
            }))
            .expect("tools/call response");

        let text = response["result"]["content"][0]["text"]
            .as_str()
            .expect("text");
        assert!(text.contains("programming/rust.md"));
        assert!(text.contains("Rust note"));
    }

    #[test]
    fn tools_call_search_tags_and_graph_neighbors_work() {
        let server = setup_server();

        let search = server
            .handle_request(&json!({
                "jsonrpc": "2.0",
                "id": 31,
                "method": "tools/call",
                "params": {
                    "name": "search_notes",
                    "arguments": { "query": "Rust", "limit": 5 }
                }
            }))
            .expect("search response");
        let search_text = search["result"]["content"][0]["text"]
            .as_str()
            .expect("search text");
        let parsed: Value = serde_json::from_str(search_text).expect("search json");
        assert!(parsed.is_array());

        let tags = server
            .handle_request(&json!({
                "jsonrpc": "2.0",
                "id": 32,
                "method": "tools/call",
                "params": {
                    "name": "list_tags",
                    "arguments": {}
                }
            }))
            .expect("tags response");
        let tags_text = tags["result"]["content"][0]["text"]
            .as_str()
            .expect("tags text");
        assert!(tags_text.contains("rust"));
        assert!(tags_text.contains("python"));

        let graph = server
            .handle_request(&json!({
                "jsonrpc": "2.0",
                "id": 33,
                "method": "tools/call",
                "params": {
                    "name": "graph_neighbors",
                    "arguments": { "path": "programming/rust.md", "depth": 1 }
                }
            }))
            .expect("graph response");
        let graph_text = graph["result"]["content"][0]["text"]
            .as_str()
            .expect("graph text");
        let parsed_graph: Value = serde_json::from_str(graph_text).expect("graph json");
        assert!(parsed_graph.get("nodes").is_some());
        assert!(parsed_graph.get("edges").is_some());
    }

    #[test]
    fn runtime_backed_server_handles_tools() {
        let server = setup_runtime_backed_server();
        let response = server
            .handle_request(&json!({
                "jsonrpc": "2.0",
                "id": 34,
                "method": "tools/call",
                "params": {
                    "name": "get_note",
                    "arguments": { "path": "runtime/hello.md" }
                }
            }))
            .expect("get_note response");

        let search_text = response["result"]["content"][0]["text"]
            .as_str()
            .expect("payload text");
        assert!(search_text.contains("runtime/hello.md"));
    }

    #[test]
    fn resources_list_is_disabled_and_resources_read_still_works() {
        let server = setup_server();

        let list_response = server
            .handle_request(&json!({
                "jsonrpc": "2.0",
                "id": 4,
                "method": "resources/list",
                "params": {}
            }))
            .expect("resources/list response");

        assert_eq!(list_response["error"]["code"], json!(-32601));

        let uri = note_uri("programming/rust.md");
        let read_response = server
            .handle_request(&json!({
                "jsonrpc": "2.0",
                "id": 5,
                "method": "resources/read",
                "params": { "uri": uri }
            }))
            .expect("resources/read response");

        let text = read_response["result"]["contents"][0]["text"]
            .as_str()
            .expect("markdown text");
        assert!(text.contains("# "));
    }

    #[test]
    fn invalid_method_returns_error() {
        let server = setup_server();
        let response = server
            .handle_request(&json!({
                "jsonrpc": "2.0",
                "id": 6,
                "method": "unknown/method",
                "params": {}
            }))
            .expect("error response");

        assert_eq!(response["error"]["code"], json!(-32601));
    }

    #[test]
    fn note_uri_round_trip() {
        let path = "folder/Невронни мрежи.md";
        let uri = note_uri(path);
        let decoded = parse_note_uri(&uri).expect("decode");
        assert_eq!(decoded, path);
    }

    #[test]
    fn mutation_and_directory_tools_work() {
        let server = setup_server();

        let create_dir = server
            .handle_request(&json!({
                "jsonrpc": "2.0",
                "id": 41,
                "method": "tools/call",
                "params": { "name": "create_directory", "arguments": { "path": "scratch" } }
            }))
            .expect("create directory response");
        assert!(create_dir["result"]["content"][0]["text"]
            .as_str()
            .unwrap_or_default()
            .contains("Created directory"));

        let create_note = server
            .handle_request(&json!({
                "jsonrpc": "2.0",
                "id": 42,
                "method": "tools/call",
                "params": { "name": "create_note", "arguments": { "path": "scratch/new.md", "content": "# New" } }
            }))
            .expect("create note response");
        assert!(create_note["result"]["isError"] == json!(false));

        let replace_note = server
            .handle_request(&json!({
                "jsonrpc": "2.0",
                "id": 43,
                "method": "tools/call",
                "params": { "name": "replace_note", "arguments": { "path": "scratch/new.md", "content": "# Updated\\n\\nBody" } }
            }))
            .expect("replace note response");
        assert!(replace_note["result"]["isError"] == json!(false));

        let list_dir = server
            .handle_request(&json!({
                "jsonrpc": "2.0",
                "id": 44,
                "method": "tools/call",
                "params": { "name": "list_directory", "arguments": { "path": "scratch" } }
            }))
            .expect("list directory response");
        let list_text = list_dir["result"]["content"][0]["text"]
            .as_str()
            .expect("list text");
        assert!(list_text.contains("scratch/new.md"));

        let rename_dir = server
            .handle_request(&json!({
                "jsonrpc": "2.0",
                "id": 45,
                "method": "tools/call",
                "params": { "name": "delete_note", "arguments": { "path": "scratch/new.md" } }
            }))
            .expect("delete note response");
        assert!(
            rename_dir["result"]["isError"] == json!(false),
            "{rename_dir:?}"
        );

        let delete_note = server
            .handle_request(&json!({
                "jsonrpc": "2.0",
                "id": 46,
                "method": "tools/call",
                "params": { "name": "rename_directory", "arguments": { "old_path": "scratch", "new_path": "scratch-renamed" } }
            }))
            .expect("rename directory response");
        assert!(
            delete_note["result"]["isError"] == json!(false),
            "{delete_note:?}"
        );

        let remove_dir = server
            .handle_request(&json!({
                "jsonrpc": "2.0",
                "id": 47,
                "method": "tools/call",
                "params": { "name": "create_directory", "arguments": { "path": "temp-empty" } }
            }))
            .expect("create temp-empty directory response");
        assert!(
            remove_dir["result"]["isError"] == json!(false),
            "{remove_dir:?}"
        );

        let remove_empty_dir = server
            .handle_request(&json!({
                "jsonrpc": "2.0",
                "id": 49,
                "method": "tools/call",
                "params": { "name": "remove_directory", "arguments": { "path": "temp-empty", "recursive": true } }
            }))
            .expect("remove directory response");
        assert!(
            remove_empty_dir["result"]["isError"] == json!(false),
            "{remove_empty_dir:?}"
        );
    }

    #[test]
    fn list_directory_rejects_traversal_path() {
        let server = setup_server();
        let response = server
            .handle_request(&json!({
                "jsonrpc": "2.0",
                "id": 48,
                "method": "tools/call",
                "params": { "name": "list_directory", "arguments": { "path": "../" } }
            }))
            .expect("list directory error response");

        assert_eq!(response["error"]["code"], json!(-32602));
    }
}
