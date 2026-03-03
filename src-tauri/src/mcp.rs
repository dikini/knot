//! MCP server implementation for Knot.
//!
//! SPEC: COMP-MCP-SERVER-001 FR-1, FR-2, FR-3, FR-4, FR-5, FR-6, FR-7, FR-8, FR-9, FR-10, FR-11
//! SPEC: COMP-MCP-SERVER-002 FR-1, FR-2, FR-3, FR-4, FR-5, FR-6, FR-7, FR-8
//! TRACE: DESIGN-mcp-server-core-tools-resources

use crate::app_command::{AppCommand, UiCommand};
use crate::commands::notes::build_note_data;
use crate::core::VaultManager;
use crate::ipc::IpcClient;
use crate::runtime::RuntimeHost;
use crate::ui_automation::ui_automation_socket_path;
use crate::youtube::{build_youtube_note_markdown, build_youtube_note_path, import_youtube_note};
use serde_json::{json, Value};
use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::fs::OpenOptions;
use std::io::{self, BufRead, BufReader, Read, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex as StdMutex};
use std::time::{Instant, SystemTime, UNIX_EPOCH};
use tokio::sync::Mutex;

const JSONRPC_VERSION: &str = "2.0";
const PROTOCOL_VERSION: &str = "2024-11-05";

fn default_write_log_path() -> PathBuf {
    std::env::var("KNOTD_WRITE_LOG_PATH")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("/tmp/knotd-write.log"))
}

pub struct McpServer {
    vault: Arc<Mutex<Option<VaultManager>>>,
    runtime: Option<RuntimeHost>,
    // TRACE: DESIGN-daemon-ui-ipc-cutover
    write_executor: Arc<StdMutex<()>>,
    write_op_seq: Arc<AtomicU64>,
    write_log_path: PathBuf,
    server_name: &'static str,
    server_version: &'static str,
}

impl McpServer {
    pub fn new(vault: VaultManager) -> Self {
        Self {
            vault: Arc::new(Mutex::new(Some(vault))),
            runtime: None,
            write_executor: Arc::new(StdMutex::new(())),
            write_op_seq: Arc::new(AtomicU64::new(0)),
            write_log_path: default_write_log_path(),
            server_name: "knot-mcp",
            server_version: env!("CARGO_PKG_VERSION"),
        }
    }

    pub fn from_runtime(runtime: &RuntimeHost) -> Self {
        Self {
            vault: runtime.vault().clone(),
            runtime: Some(runtime.clone()),
            write_executor: Arc::new(StdMutex::new(())),
            write_op_seq: Arc::new(AtomicU64::new(0)),
            write_log_path: default_write_log_path(),
            server_name: "knot-mcp",
            server_version: env!("CARGO_PKG_VERSION"),
        }
    }

    fn is_mutating_tool(name: &str) -> bool {
        matches!(
            name,
            "create_note"
                | "create_youtube_note"
                | "delete_note"
                | "replace_note"
                | "create_directory"
                | "remove_directory"
                | "rename_directory"
                | "save_note"
                | "rename_note"
                | "set_folder_expanded"
                | "sync_external_changes"
                | "update_vault_settings"
                | "reindex_vault"
                | "create_vault"
                | "open_vault"
                | "close_vault"
        )
    }

    fn args_summary(arguments: &Value) -> Value {
        let mut out = serde_json::Map::new();
        let Some(obj) = arguments.as_object() else {
            return Value::Object(out);
        };

        for key in [
            "path",
            "old_path",
            "new_path",
            "from_path",
            "to_path",
            "recursive",
            "expanded",
            "limit",
            "base_folder_path",
        ] {
            if let Some(v) = obj.get(key) {
                out.insert(key.to_string(), v.clone());
            }
        }

        if let Some(content) = obj.get("content").and_then(Value::as_str) {
            out.insert("content_len".to_string(), json!(content.len()));
        }
        if let Some(patch) = obj.get("patch").and_then(Value::as_object) {
            let mut keys = patch.keys().cloned().collect::<Vec<_>>();
            keys.sort();
            out.insert("patch_keys".to_string(), json!(keys));
        }

        let mut arg_keys = obj.keys().cloned().collect::<Vec<_>>();
        arg_keys.sort();
        out.insert("arg_keys".to_string(), json!(arg_keys));
        Value::Object(out)
    }

    fn log_write_event(&self, event: &Value) {
        if let Ok(mut file) = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.write_log_path)
        {
            let _ = serde_json::to_writer(&mut file, event);
            let _ = file.write_all(b"\n");
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
        let runtime = self.runtime.as_ref().ok_or((
            -32000,
            "Runtime host is not available in this server mode".to_string(),
        ))?;
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
                    "name": "create_youtube_note",
                    "description": "Create a YouTube transcript note from a YouTube URL.",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "base_folder_path": { "type": "string" },
                            "url": { "type": "string" }
                        },
                        "required": ["base_folder_path", "url"]
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
                    "name": "list_ui_actions",
                    "description": "List discoverable semantic UI automation actions.",
                    "inputSchema": { "type": "object", "properties": {} }
                },
                {
                    "name": "list_ui_views",
                    "description": "List discoverable semantic UI automation views.",
                    "inputSchema": { "type": "object", "properties": {} }
                },
                {
                    "name": "list_ui_behaviors",
                    "description": "List discoverable semantic UI automation behaviors.",
                    "inputSchema": { "type": "object", "properties": {} }
                },
                {
                    "name": "get_ui_state",
                    "description": "Return compact UI automation state for the running app.",
                    "inputSchema": { "type": "object", "properties": {} }
                },
                {
                    "name": "invoke_ui_action",
                    "description": "Invoke a semantic UI automation action in the running app.",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "action_id": { "type": "string" },
                            "args": { "type": "object" }
                        },
                        "required": ["action_id"]
                    }
                },
                {
                    "name": "invoke_ui_behavior",
                    "description": "Invoke a semantic UI automation behavior in the running app.",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "behavior_id": { "type": "string" },
                            "args": { "type": "object" }
                        },
                        "required": ["behavior_id"]
                    }
                },
                {
                    "name": "capture_ui_screenshot",
                    "description": "Capture a semantic UI screenshot from the running app.",
                    "inputSchema": {
                        "type": "object",
                        "properties": {
                            "target": { "type": "string", "enum": ["window", "view"] },
                            "target_id": { "type": "string" },
                            "name": { "type": "string" }
                        },
                        "required": ["target"]
                    }
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
                    "name": "list_vault_plugins",
                    "description": "List installed vault plugins and effective enablement state.",
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

        if !Self::is_mutating_tool(name) {
            return self.execute_tool_call(name, &arguments);
        }

        // TRACE: DESIGN-daemon-ui-ipc-cutover
        let op_id = self.write_op_seq.fetch_add(1, Ordering::SeqCst) + 1;
        let requested_at_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        let args_summary = Self::args_summary(&arguments);
        self.log_write_event(&json!({
            "kind": "write_op",
            "phase": "start",
            "op_id": op_id,
            "tool": name,
            "requested_at_ms": requested_at_ms,
            "args": args_summary,
        }));

        let lock_wait_started = Instant::now();
        let _guard = self
            .write_executor
            .lock()
            .map_err(|_| (-32000, "Write executor is poisoned".to_string()))?;
        let lock_wait_ms = lock_wait_started.elapsed().as_millis() as u64;

        let started = Instant::now();
        let result = self.execute_tool_call(name, &arguments);
        let duration_ms = started.elapsed().as_millis() as u64;

        match &result {
            Ok(_) => self.log_write_event(&json!({
                "kind": "write_op",
                "phase": "end",
                "op_id": op_id,
                "tool": name,
                "ok": true,
                "lock_wait_ms": lock_wait_ms,
                "duration_ms": duration_ms,
            })),
            Err((code, message)) => self.log_write_event(&json!({
                "kind": "write_op",
                "phase": "end",
                "op_id": op_id,
                "tool": name,
                "ok": false,
                "lock_wait_ms": lock_wait_ms,
                "duration_ms": duration_ms,
                "error_code": code,
                "error_message": message,
            })),
        }

        result
    }

    fn execute_tool_call(&self, name: &str, arguments: &Value) -> Result<Value, (i32, String)> {
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
                    let data = build_note_data(vault.root_path(), vault, note);
                    serde_json::to_value(data).map_err(|e| (-32000, e.to_string()))
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
                    let data = build_note_data(vault.root_path(), vault, note);
                    serde_json::to_value(data).map_err(|e| (-32000, e.to_string()))
                })?;

                Ok(json!({
                    "content": [{ "type": "text", "text": serde_json::to_string_pretty(&payload).unwrap_or_else(|_| "{}".to_string()) }],
                    "isError": false
                }))
            }
            "create_youtube_note" => {
                let base_folder_path = arguments
                    .get("base_folder_path")
                    .and_then(Value::as_str)
                    .ok_or((-32602, "Missing argument: base_folder_path".to_string()))?;
                let url = arguments
                    .get("url")
                    .and_then(Value::as_str)
                    .ok_or((-32602, "Missing argument: url".to_string()))?;

                let imported = import_youtube_note(url).map_err(|message| (-32000, message))?;
                let path = self.with_vault_mut(|vault| {
                    let path = build_youtube_note_path(
                        base_folder_path,
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
                        .map_err(|e| (-32000, e.to_response_string()))?;
                    Ok(path)
                })?;

                let payload = self.with_vault(|vault| {
                    let note = vault
                        .get_note(&path)
                        .map_err(|e| (-32000, e.to_response_string()))?;
                    let data = build_note_data(vault.root_path(), vault, note);
                    serde_json::to_value(data).map_err(|e| (-32000, e.to_string()))
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

                Ok(json!({ "content": [{ "type": "text", "text": "null" }], "isError": false }))
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

                Ok(json!({ "content": [{ "type": "text", "text": "null" }], "isError": false }))
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

                Ok(json!({ "content": [{ "type": "text", "text": "null" }], "isError": false }))
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

                Ok(json!({ "content": [{ "type": "text", "text": "null" }], "isError": false }))
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

                Ok(json!({ "content": [{ "type": "text", "text": "null" }], "isError": false }))
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
                            let resolved = vault
                                .note_type_registry()
                                .resolve_path(&vault.root_path().join(&n.path));
                            json!({
                                "id": n.id,
                                "path": n.path,
                                "title": n.title,
                                "created_at": n.created_at,
                                "modified_at": n.modified_at,
                                "word_count": n.word_count,
                                "note_type": resolved.note_type,
                                "type_badge": resolved.type_badge,
                                "is_dimmed": !resolved.is_known
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
            "list_ui_actions" => {
                self.execute_ui_tool(AppCommand::Ui(UiCommand::ListAutomationActions))
            }
            "list_ui_views" => self.execute_ui_tool(AppCommand::Ui(UiCommand::ListAutomationViews)),
            "list_ui_behaviors" => {
                self.execute_ui_tool(AppCommand::Ui(UiCommand::ListAutomationBehaviors))
            }
            "get_ui_state" => self.execute_ui_tool(AppCommand::Ui(UiCommand::GetAutomationState)),
            "invoke_ui_action" => {
                let action_id = arguments
                    .get("action_id")
                    .and_then(Value::as_str)
                    .ok_or((-32602, "Missing argument: action_id".to_string()))?;
                let args = arguments.get("args").cloned().unwrap_or_else(|| json!({}));
                self.execute_ui_tool(AppCommand::Ui(UiCommand::InvokeAutomationAction {
                    action_id: action_id.to_string(),
                    args,
                }))
            }
            "invoke_ui_behavior" => {
                let behavior_id = arguments
                    .get("behavior_id")
                    .and_then(Value::as_str)
                    .ok_or((-32602, "Missing argument: behavior_id".to_string()))?;
                let args = arguments.get("args").cloned().unwrap_or_else(|| json!({}));
                self.execute_ui_tool(AppCommand::Ui(UiCommand::InvokeAutomationBehavior {
                    behavior_id: behavior_id.to_string(),
                    args,
                }))
            }
            "capture_ui_screenshot" => {
                let target = arguments
                    .get("target")
                    .and_then(Value::as_str)
                    .ok_or((-32602, "Missing argument: target".to_string()))?;
                let target_id = arguments
                    .get("target_id")
                    .and_then(Value::as_str)
                    .map(ToString::to_string);
                let name = arguments
                    .get("name")
                    .and_then(Value::as_str)
                    .map(ToString::to_string);
                self.execute_ui_tool(AppCommand::Ui(UiCommand::CaptureAutomationScreenshot {
                    target: target.to_string(),
                    target_id,
                    name,
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
                let is_open =
                    self.with_runtime(|runtime| Ok(runtime.vault().blocking_lock().is_some()))?;
                Ok(
                    json!({ "content": [{ "type": "text", "text": serde_json::to_string(&is_open).unwrap_or_else(|_| "false".to_string()) }], "isError": false }),
                )
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
                        .map(|n| {
                            let resolved = vault
                                .note_type_registry()
                                .resolve_path(&vault.root_path().join(&n.path));
                            json!({
                                "id": n.id,
                                "path": n.path,
                                "title": n.title,
                                "created_at": n.created_at,
                                "modified_at": n.modified_at,
                                "word_count": n.word_count,
                                "note_type": resolved.note_type,
                                "type_badge": resolved.type_badge,
                                "is_dimmed": !resolved.is_known
                            })
                        })
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
            "list_vault_plugins" => {
                let payload = self.with_vault(|vault| {
                    vault
                        .list_installed_plugins()
                        .map_err(|e| (-32000, e.to_response_string()))
                })?;
                Ok(json!({
                    "content": [{ "type": "text", "text": serde_json::to_string_pretty(&payload).unwrap_or_else(|_| "[]".to_string()) }],
                    "isError": false
                }))
            }
            "update_vault_settings" => {
                let patch = arguments
                    .get("patch")
                    .cloned()
                    .ok_or((-32602, "Missing argument: patch".to_string()))?;
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
                Ok(
                    json!({ "content": [{ "type": "text", "text": serde_json::to_string_pretty(&info).unwrap_or_else(|_| "{}".to_string()) }], "isError": false }),
                )
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
                Ok(
                    json!({ "content": [{ "type": "text", "text": serde_json::to_string_pretty(&info).unwrap_or_else(|_| "{}".to_string()) }], "isError": false }),
                )
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
                    let notes = vault
                        .list_notes()
                        .map_err(|e| (-32000, e.to_response_string()))?
                        .into_iter();
                    let folders = scan_visible_folders(vault.root_path())
                        .map_err(|e| (-32000, e.to_string()))?;
                    let notes = notes
                        .map(|note| {
                            let path = note.path.clone();
                            let title = note.title.clone();
                            let resolved = vault
                                .note_type_registry()
                                .resolve_path(&vault.root_path().join(&path));
                            ExplorerTreeNote {
                                path,
                                title: title.clone(),
                                display_title: if title.trim().is_empty() {
                                    filename_stem(&note.path)
                                } else {
                                    title
                                },
                                modified_at: note.modified_at,
                                word_count: note.word_count,
                                type_badge: resolved.type_badge,
                                is_dimmed: !resolved.is_known,
                            }
                        })
                        .collect::<Vec<_>>();
                    let root = build_explorer_tree_json(
                        vault.root_path(),
                        notes,
                        folders,
                        &vault.config().explorer.expanded_folders,
                        vault.config().explorer.expansion_state_initialized,
                    );
                    Ok(json!({ "root": root, "hidden_policy": "hide-dotfiles" }))
                })?;
                Ok(json!({
                    "content": [{ "type": "text", "text": serde_json::to_string_pretty(&payload).unwrap_or_else(|_| "{}".to_string()) }],
                    "isError": false
                }))
            }
            _ => Err((-32601, format!("Unknown tool: {name}"))),
        }
    }

    fn execute_ui_tool(&self, command: AppCommand) -> Result<Value, (i32, String)> {
        let client = IpcClient::new(ui_automation_socket_path());
        let result = client
            .send_command(command)
            .map_err(|err| (-32000, err.to_string()))?;

        if !result.success {
            let code = result
                .error_code
                .unwrap_or_else(|| "UI_ACTION_EXECUTION_FAILED".to_string());
            return Err((-32000, format!("{} ({code})", result.message)));
        }

        let payload = result.payload.unwrap_or(Value::Null);
        Ok(json!({
            "content": [
                {
                    "type": "text",
                    "text": serde_json::to_string_pretty(&payload).unwrap_or_else(|_| "null".to_string())
                }
            ],
            "isError": false
        }))
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

#[derive(Clone)]
struct ExplorerTreeNote {
    path: String,
    title: String,
    display_title: String,
    modified_at: i64,
    word_count: usize,
    type_badge: Option<String>,
    is_dimmed: bool,
}

fn scan_visible_folders(root: &Path) -> io::Result<Vec<String>> {
    let mut paths = Vec::new();
    for entry in walkdir::WalkDir::new(root)
        .min_depth(1)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if !entry.file_type().is_dir() {
            continue;
        }
        let relative = match entry.path().strip_prefix(root) {
            Ok(relative) => relative,
            Err(_) => continue,
        };
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

fn is_hidden_rel_path(rel_path: &str) -> bool {
    rel_path
        .split('/')
        .any(|segment| !segment.is_empty() && segment.starts_with('.'))
}

fn filename_stem(path: &str) -> String {
    PathBuf::from(path)
        .file_stem()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string())
}

fn build_explorer_tree_json(
    vault_root: &Path,
    notes: Vec<ExplorerTreeNote>,
    folders: Vec<String>,
    expanded_folders: &[String],
    expansion_state_initialized: bool,
) -> Value {
    #[derive(Clone)]
    struct FolderAccum {
        path: String,
        name: String,
        children: BTreeMap<String, String>,
        notes: Vec<ExplorerTreeNote>,
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
    ) -> Value {
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

        json!({
            "path": current.path,
            "name": current.name,
            "expanded": folder_expanded(path, expansion_state_initialized, expanded_folders),
            "folders": folders,
            "notes": notes.into_iter().map(|note| json!({
                "path": note.path,
                "title": note.title,
                "display_title": note.display_title,
                "modified_at": note.modified_at,
                "word_count": note.word_count,
                "type_badge": note.type_badge,
                "is_dimmed": note.is_dimmed,
            })).collect::<Vec<_>>(),
        })
    }

    let root_name = vault_root
        .file_name()
        .map(|value| value.to_string_lossy().to_string())
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
        ensure_folder(&mut map, &parent, &root_name);
        if let Some(parent_folder) = map.get_mut(&parent) {
            parent_folder.notes.push(note);
        }
    }

    build_node(&map, "", expansion_state_initialized, expanded_folders)
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

pub fn read_framed_message<R: BufRead>(reader: &mut R) -> io::Result<Option<String>> {
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
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::sync::Arc;
    use std::thread;
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
            runtime
                .create_new(&root)
                .await
                .expect("create runtime vault");
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
        assert!(response["result"]["capabilities"]
            .get("resources")
            .is_none());
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
        assert!(names.contains(&"create_youtube_note"));
        assert!(names.contains(&"delete_note"));
        assert!(names.contains(&"replace_note"));
        assert!(names.contains(&"create_directory"));
        assert!(names.contains(&"remove_directory"));
        assert!(names.contains(&"rename_directory"));
        assert!(names.contains(&"list_directory"));
        assert!(names.contains(&"list_ui_actions"));
        assert!(names.contains(&"list_ui_views"));
        assert!(names.contains(&"list_ui_behaviors"));
        assert!(names.contains(&"get_ui_state"));
        assert!(names.contains(&"invoke_ui_action"));
        assert!(names.contains(&"invoke_ui_behavior"));
        assert!(names.contains(&"capture_ui_screenshot"));
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
    fn tools_call_get_note_returns_unknown_payload_for_non_markdown_files_when_plugins_disabled() {
        let server = setup_server();
        server
            .with_vault(|vault| {
                let image_path = vault.root_path().join("images/photo.jpg");
                std::fs::create_dir_all(
                    image_path
                        .parent()
                        .ok_or((-32000, "image path missing parent".to_string()))?,
                )
                .map_err(|e| (-32000, e.to_string()))?;
                std::fs::write(&image_path, b"\xff\xd8\xff\xdb")
                    .map_err(|e| (-32000, e.to_string()))?;
                Ok(())
            })
            .expect("seed image");

        let response = server
            .handle_request(&json!({
                "jsonrpc": "2.0",
                "id": 301,
                "method": "tools/call",
                "params": {
                    "name": "get_note",
                    "arguments": { "path": "images/photo.jpg" }
                }
            }))
            .expect("image get_note response");

        let text = response["result"]["content"][0]["text"]
            .as_str()
            .expect("text");
        let payload: Value = serde_json::from_str(text).expect("image note json");

        assert_eq!(payload["path"], json!("images/photo.jpg"));
        assert_eq!(payload["note_type"], json!("unknown"));
        assert_eq!(payload["type_badge"], json!("JPG"));
        assert_eq!(payload["available_modes"]["view"], json!(true));
        assert_eq!(payload["available_modes"]["edit"], json!(false));
        assert_eq!(payload["available_modes"]["source"], json!(false));
        assert_eq!(payload["content"], json!(""));
        assert_eq!(payload["media"], Value::Null);
    }

    #[test]
    fn tools_call_get_note_returns_image_payload_for_non_markdown_files_when_plugins_enabled() {
        let server = setup_server();
        server
            .with_vault_mut(|vault| {
                vault
                    .update_vault_settings_patch(&json!({
                        "plugins_enabled": true
                    }))
                    .map_err(|e| (-32000, e.to_response_string()))?;
                let image_path = vault.root_path().join("images/photo.jpg");
                std::fs::create_dir_all(
                    image_path
                        .parent()
                        .ok_or((-32000, "image path missing parent".to_string()))?,
                )
                .map_err(|e| (-32000, e.to_string()))?;
                std::fs::write(&image_path, b"\xff\xd8\xff\xdb")
                    .map_err(|e| (-32000, e.to_string()))?;
                Ok(())
            })
            .expect("seed image with plugins enabled");

        let response = server
            .handle_request(&json!({
                "jsonrpc": "2.0",
                "id": 302,
                "method": "tools/call",
                "params": {
                    "name": "get_note",
                    "arguments": { "path": "images/photo.jpg" }
                }
            }))
            .expect("image get_note response");

        let text = response["result"]["content"][0]["text"]
            .as_str()
            .expect("text");
        let payload: Value = serde_json::from_str(text).expect("image note json");

        assert_eq!(payload["path"], json!("images/photo.jpg"));
        assert_eq!(payload["note_type"], json!("image"));
        assert_eq!(payload["type_badge"], json!("JPG"));
        assert_eq!(payload["available_modes"]["view"], json!(true));
        assert_eq!(payload["available_modes"]["edit"], json!(false));
        assert_eq!(payload["available_modes"]["source"], json!(false));
        assert_eq!(payload["content"], json!(""));
        assert_eq!(payload["media"]["mime_type"], json!("image/jpeg"));
        assert!(payload["media"]["file_path"]
            .as_str()
            .expect("file path")
            .ends_with("/images/photo.jpg"));
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
        let create_dir_text = create_dir["result"]["content"][0]["text"]
            .as_str()
            .expect("create directory text");
        assert_eq!(
            serde_json::from_str::<Value>(create_dir_text).expect("create directory JSON payload"),
            Value::Null
        );

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
        let replace_note_text = replace_note["result"]["content"][0]["text"]
            .as_str()
            .expect("replace note text");
        assert_eq!(
            serde_json::from_str::<Value>(replace_note_text).expect("replace note JSON payload"),
            Value::Null
        );

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

        let delete_note = server
            .handle_request(&json!({
                "jsonrpc": "2.0",
                "id": 45,
                "method": "tools/call",
                "params": { "name": "delete_note", "arguments": { "path": "scratch/new.md" } }
            }))
            .expect("delete note response");
        assert!(
            delete_note["result"]["isError"] == json!(false),
            "{delete_note:?}"
        );
        let delete_note_text = delete_note["result"]["content"][0]["text"]
            .as_str()
            .expect("delete note text");
        assert_eq!(
            serde_json::from_str::<Value>(delete_note_text).expect("delete note JSON payload"),
            Value::Null
        );

        let rename_dir = server
            .handle_request(&json!({
                "jsonrpc": "2.0",
                "id": 46,
                "method": "tools/call",
                "params": { "name": "rename_directory", "arguments": { "old_path": "scratch", "new_path": "scratch-renamed" } }
            }))
            .expect("rename directory response");
        assert!(
            rename_dir["result"]["isError"] == json!(false),
            "{rename_dir:?}"
        );
        let rename_dir_text = rename_dir["result"]["content"][0]["text"]
            .as_str()
            .expect("rename directory text");
        assert_eq!(
            serde_json::from_str::<Value>(rename_dir_text).expect("rename directory JSON payload"),
            Value::Null
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
        let remove_dir_text = remove_dir["result"]["content"][0]["text"]
            .as_str()
            .expect("create temp-empty directory text");
        assert_eq!(
            serde_json::from_str::<Value>(remove_dir_text)
                .expect("create temp-empty directory JSON payload"),
            Value::Null
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
        let remove_empty_dir_text = remove_empty_dir["result"]["content"][0]["text"]
            .as_str()
            .expect("remove directory text");
        assert_eq!(
            serde_json::from_str::<Value>(remove_empty_dir_text)
                .expect("remove directory JSON payload"),
            Value::Null
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

    #[test]
    fn concurrent_mutating_writes_remain_stable_at_high_concurrency() {
        // TRACE: DESIGN-daemon-ui-ipc-cutover
        let server = Arc::new(setup_server());
        let id_seq = Arc::new(AtomicU64::new(1000));
        let workers = 24usize;
        let notes_per_worker = 12usize;

        let mut handles = Vec::with_capacity(workers);
        for worker in 0..workers {
            let server = Arc::clone(&server);
            let id_seq = Arc::clone(&id_seq);
            handles.push(thread::spawn(move || {
                for idx in 0..notes_per_worker {
                    let path = format!("concurrent/w{worker}/n{idx}.md");
                    let create_id = id_seq.fetch_add(1, Ordering::SeqCst);
                    let create = server
                        .handle_request(&json!({
                            "jsonrpc": "2.0",
                            "id": create_id,
                            "method": "tools/call",
                            "params": {
                                "name": "create_note",
                                "arguments": { "path": path, "content": format!("# Start {worker}/{idx}") }
                            }
                        }))
                        .expect("create_note response");
                    assert!(create["result"]["isError"] == json!(false), "{create:?}");

                    let replace_id = id_seq.fetch_add(1, Ordering::SeqCst);
                    let replace = server
                        .handle_request(&json!({
                            "jsonrpc": "2.0",
                            "id": replace_id,
                            "method": "tools/call",
                            "params": {
                                "name": "replace_note",
                                "arguments": { "path": path, "content": format!("# Final {worker}/{idx}") }
                            }
                        }))
                        .expect("replace_note response");
                    assert!(replace["result"]["isError"] == json!(false), "{replace:?}");
                }
            }));
        }

        for handle in handles {
            handle.join().expect("worker join");
        }

        let list = server
            .handle_request(&json!({
                "jsonrpc": "2.0",
                "id": 9001,
                "method": "tools/call",
                "params": {
                    "name": "list_notes",
                    "arguments": {}
                }
            }))
            .expect("list_notes response");
        let text = list["result"]["content"][0]["text"]
            .as_str()
            .expect("list notes text");
        let notes: Vec<Value> = serde_json::from_str(text).expect("list notes json");
        let created_prefix = "concurrent/";
        let created_count = notes
            .iter()
            .filter(|note| {
                note.get("path")
                    .and_then(Value::as_str)
                    .map(|path| path.starts_with(created_prefix))
                    .unwrap_or(false)
            })
            .count();
        assert_eq!(created_count, workers * notes_per_worker);

        let verify = server
            .handle_request(&json!({
                "jsonrpc": "2.0",
                "id": 9002,
                "method": "tools/call",
                "params": {
                    "name": "get_note",
                    "arguments": { "path": "concurrent/w7/n5.md" }
                }
            }))
            .expect("get_note response");
        let verify_text = verify["result"]["content"][0]["text"]
            .as_str()
            .expect("verify note text");
        assert!(verify_text.contains("# Final 7/5"));
    }
}
