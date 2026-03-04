//! knotd daemon MCP socket client for UI command routing.
//!
//! TRACE: DESIGN-knotd-ui-daemon-integration

use crate::error::KnotError;
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use serde_json::{json, Value};
use std::io::{BufRead, BufReader, Write};
use std::os::unix::net::UnixStream;
use std::sync::atomic::{AtomicU64, Ordering};

static NEXT_REQUEST_ID: AtomicU64 = AtomicU64::new(1000);

fn socket_path() -> String {
    std::env::var("KNOTD_SOCKET_PATH").unwrap_or_else(|_| "/tmp/knotd.sock".to_string())
}

fn next_id() -> u64 {
    NEXT_REQUEST_ID.fetch_add(1, Ordering::Relaxed)
}

fn read_framed_message<R: BufRead>(reader: &mut R) -> Result<String, KnotError> {
    let mut content_length: Option<usize> = None;
    let mut line = String::new();
    loop {
        line.clear();
        let read = reader.read_line(&mut line)?;
        if read == 0 {
            return Err(KnotError::Other(
                "Connection closed while reading MCP response headers".to_string(),
            ));
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

    let len =
        content_length.ok_or_else(|| KnotError::Other("Missing Content-Length".to_string()))?;
    let mut body = vec![0_u8; len];
    reader.read_exact(&mut body)?;
    String::from_utf8(body).map_err(|e| KnotError::Other(format!("Invalid UTF-8 payload: {e}")))
}

fn write_framed_message<W: Write>(writer: &mut W, value: &Value) -> Result<(), KnotError> {
    let payload = serde_json::to_vec(value)?;
    write!(writer, "Content-Length: {}\r\n\r\n", payload.len())?;
    writer.write_all(&payload)?;
    writer.flush()?;
    Ok(())
}

fn call_jsonrpc(method: &str, params: Value) -> Result<Value, KnotError> {
    let path = socket_path();
    let mut stream = UnixStream::connect(&path).map_err(|e| {
        KnotError::Other(format!(
            "Failed to connect to knotd at {}: {}. Is knotd running?",
            path, e
        ))
    })?;
    stream.set_read_timeout(Some(std::time::Duration::from_secs(10)))?;
    stream.set_write_timeout(Some(std::time::Duration::from_secs(10)))?;

    let request = json!({
        "jsonrpc": "2.0",
        "id": next_id(),
        "method": method,
        "params": params
    });

    write_framed_message(&mut stream, &request)?;
    let mut reader = BufReader::new(stream);
    let raw = read_framed_message(&mut reader)?;
    let response: Value = serde_json::from_str(&raw)?;
    if let Some(err) = response.get("error") {
        let message = err
            .get("message")
            .and_then(Value::as_str)
            .unwrap_or("knotd RPC error");
        return Err(KnotError::Other(message.to_string()));
    }
    response
        .get("result")
        .cloned()
        .ok_or_else(|| KnotError::Other("Missing result in knotd response".to_string()))
}

pub fn call_tool(name: &str, arguments: Value) -> Result<Value, KnotError> {
    let result = call_jsonrpc(
        "tools/call",
        json!({
            "name": name,
            "arguments": arguments
        }),
    )?;
    let text = result
        .get("content")
        .and_then(Value::as_array)
        .and_then(|a| a.first())
        .and_then(|v| v.get("text"))
        .and_then(Value::as_str)
        .ok_or_else(|| KnotError::Other(format!("Tool {name} returned no text payload")))?;

    serde_json::from_str(text).map_err(|e| {
        KnotError::Other(format!(
            "Tool {name} returned non-JSON payload: {e}: {}",
            text.chars().take(180).collect::<String>()
        ))
    })
}

pub fn call_tool_typed<T: DeserializeOwned>(name: &str, arguments: Value) -> Result<T, KnotError> {
    let value = call_tool(name, arguments)?;
    serde_json::from_value(value)
        .map_err(|e| KnotError::Other(format!("Failed to decode tool {name} payload: {e}")))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolSchema {
    #[serde(rename = "type", default)]
    pub schema_type: Option<String>,
    #[serde(default)]
    pub properties: Value,
    #[serde(default)]
    pub required: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ToolDescriptor {
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(rename = "inputSchema")]
    pub input_schema: ToolSchema,
}

pub fn list_tools() -> Result<Vec<ToolDescriptor>, KnotError> {
    let result = call_jsonrpc("tools/list", json!({}))?;
    let tools = result.get("tools").cloned().unwrap_or_else(|| json!([]));
    serde_json::from_value(tools)
        .map_err(|e| KnotError::Other(format!("Failed to decode tools/list payload: {e}")))
}
