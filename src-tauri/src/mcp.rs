//! MCP server implementation for Knot.
//!
//! SPEC: COMP-MCP-SERVER-001 FR-1, FR-2, FR-3, FR-4, FR-5, FR-6, FR-7, FR-8, FR-9, FR-10, FR-11
//! TRACE: DESIGN-mcp-server-core-tools-resources

use crate::core::VaultManager;
use serde_json::{json, Value};
use std::collections::BTreeSet;
use std::io::{self, BufRead, BufReader, Read, Write};
use std::sync::{Arc, Mutex};

const JSONRPC_VERSION: &str = "2.0";
const PROTOCOL_VERSION: &str = "2024-11-05";

pub struct McpServer {
    vault: Arc<Mutex<VaultManager>>,
    server_name: &'static str,
    server_version: &'static str,
}

impl McpServer {
    pub fn new(vault: VaultManager) -> Self {
        Self {
            vault: Arc::new(Mutex::new(vault)),
            server_name: "knot-mcp",
            server_version: env!("CARGO_PKG_VERSION"),
        }
    }

    pub fn handle_request(&self, request: &Value) -> Option<Value> {
        let id = request.get("id").cloned();
        let method = request.get("method").and_then(Value::as_str).unwrap_or("");
        let params = request.get("params").cloned().unwrap_or_else(|| json!({}));

        match method {
            "initialize" => {
                let result = json!({
                    "protocolVersion": PROTOCOL_VERSION,
                    "capabilities": {
                        "tools": { "listChanged": false },
                        "resources": { "subscribe": false, "listChanged": false }
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
            "resources/list" => {
                let response = self.resources_list();
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
                }
            ]
        })
    }

    fn tools_call(&self, params: &Value) -> Result<Value, (i32, String)> {
        let name = params
            .get("name")
            .and_then(Value::as_str)
            .ok_or((-32602, "Missing tool name".to_string()))?;

        let arguments = params.get("arguments").cloned().unwrap_or_else(|| json!({}));

        match name {
            "search_notes" => {
                let query = arguments
                    .get("query")
                    .and_then(Value::as_str)
                    .ok_or((-32602, "Missing argument: query".to_string()))?;
                let limit = arguments
                    .get("limit")
                    .and_then(Value::as_u64)
                    .unwrap_or(20) as usize;

                let guard = self
                    .vault
                    .lock()
                    .map_err(|_| (-32000, "Vault lock poisoned".to_string()))?;
                let results = guard
                    .search(query, limit)
                    .map_err(|e| (-32000, e.to_response_string()))?;

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

                let guard = self
                    .vault
                    .lock()
                    .map_err(|_| (-32000, "Vault lock poisoned".to_string()))?;
                let note = guard
                    .get_note(path)
                    .map_err(|e| (-32000, e.to_response_string()))?;

                let payload = json!({
                    "id": note.id(),
                    "path": note.path(),
                    "title": note.title(),
                    "created_at": note.created_at(),
                    "modified_at": note.modified_at(),
                    "word_count": note.word_count(),
                    "content": note.content(),
                });

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
                let guard = self
                    .vault
                    .lock()
                    .map_err(|_| (-32000, "Vault lock poisoned".to_string()))?;
                let tags = guard
                    .list_tags()
                    .map_err(|e| (-32000, e.to_response_string()))?;

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
                let depth = arguments
                    .get("depth")
                    .and_then(Value::as_u64)
                    .unwrap_or(1) as usize;

                let guard = self
                    .vault
                    .lock()
                    .map_err(|_| (-32000, "Vault lock poisoned".to_string()))?;

                let nodes = guard.graph_neighbors(path, depth);
                let mut edge_set = BTreeSet::<(String, String)>::new();
                for node in &nodes {
                    for target in guard.graph().get_forward_links(node) {
                        if nodes.contains(&target) {
                            edge_set.insert((node.clone(), target));
                        }
                    }
                }
                let edges = edge_set
                    .into_iter()
                    .map(|(source, target)| json!({"source": source, "target": target}))
                    .collect::<Vec<_>>();

                let payload = json!({
                    "nodes": nodes,
                    "edges": edges,
                });

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
            _ => Err((-32601, format!("Unknown tool: {name}"))),
        }
    }

    fn resources_list(&self) -> Result<Value, (i32, String)> {
        let guard = self
            .vault
            .lock()
            .map_err(|_| (-32000, "Vault lock poisoned".to_string()))?;

        let resources = guard
            .list_notes()
            .map_err(|e| (-32000, e.to_response_string()))?
            .into_iter()
            .map(|note| {
                json!({
                    "uri": note_uri(&note.path),
                    "name": note.title,
                    "description": note.path,
                    "mimeType": "text/markdown",
                })
            })
            .collect::<Vec<_>>();

        Ok(json!({ "resources": resources }))
    }

    fn resources_read(&self, params: &Value) -> Result<Value, (i32, String)> {
        let uri = params
            .get("uri")
            .and_then(Value::as_str)
            .ok_or((-32602, "Missing uri".to_string()))?;

        let path = parse_note_uri(uri).map_err(|e| (-32602, e))?;
        let guard = self
            .vault
            .lock()
            .map_err(|_| (-32000, "Vault lock poisoned".to_string()))?;
        let note = guard
            .get_note(&path)
            .map_err(|e| (-32000, e.to_response_string()))?;

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

pub fn run_stdio_server<R: Read, W: Write>(server: &McpServer, input: R, mut output: W) -> io::Result<()> {
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
    let payload = serde_json::to_vec(value)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidData, e))?;

    write!(output, "Content-Length: {}\r\n\r\n", payload.len())?;
    output.write_all(&payload)?;
    output.flush()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::VaultManager;
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
            .save_note("programming/python.md", "# Python\n\nPython note with #python.")
            .expect("save python");

        McpServer::new(vault)
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

        assert_eq!(response["result"]["protocolVersion"], json!(PROTOCOL_VERSION));
        assert!(response["result"]["capabilities"]["tools"].is_object());
        assert!(response["result"]["capabilities"]["resources"].is_object());
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
        let search_text = search["result"]["content"][0]["text"].as_str().expect("search text");
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
        let tags_text = tags["result"]["content"][0]["text"].as_str().expect("tags text");
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
        let graph_text = graph["result"]["content"][0]["text"].as_str().expect("graph text");
        let parsed_graph: Value = serde_json::from_str(graph_text).expect("graph json");
        assert!(parsed_graph.get("nodes").is_some());
        assert!(parsed_graph.get("edges").is_some());
    }

    #[test]
    fn resources_list_and_read_round_trip() {
        let server = setup_server();

        let list_response = server
            .handle_request(&json!({
                "jsonrpc": "2.0",
                "id": 4,
                "method": "resources/list",
                "params": {}
            }))
            .expect("resources/list response");

        let resources = list_response["result"]["resources"]
            .as_array()
            .expect("resources array");
        assert!(!resources.is_empty());

        let uri = resources[0]["uri"].as_str().expect("uri");
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
}
