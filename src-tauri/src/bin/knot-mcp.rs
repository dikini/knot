use std::path::PathBuf;

use knot::core::VaultManager;
use knot::mcp::{run_stdio_server, McpServer};

fn parse_vault_path() -> Result<PathBuf, String> {
    let mut args = std::env::args().skip(1);
    while let Some(arg) = args.next() {
        if arg == "--vault" {
            let value = args
                .next()
                .ok_or_else(|| "Missing value for --vault".to_string())?;
            return Ok(PathBuf::from(value));
        }
    }

    if let Ok(env_path) = std::env::var("KNOT_VAULT_PATH") {
        if !env_path.trim().is_empty() {
            return Ok(PathBuf::from(env_path));
        }
    }

    Err("Missing vault path. Use --vault <path> or KNOT_VAULT_PATH.".to_string())
}

fn main() {
    let vault_path = match parse_vault_path() {
        Ok(path) => path,
        Err(msg) => {
            eprintln!("{msg}");
            std::process::exit(2);
        }
    };

    let vault = match VaultManager::open(&vault_path) {
        Ok(v) => v,
        Err(err) => {
            eprintln!("Failed to open vault {}: {}", vault_path.display(), err);
            std::process::exit(3);
        }
    };

    let server = McpServer::new(vault);
    if let Err(err) = run_stdio_server(&server, std::io::stdin(), std::io::stdout()) {
        eprintln!("MCP server I/O error: {err}");
        std::process::exit(4);
    }
}
