use std::path::PathBuf;

use knot::mcp::{run_stdio_server, McpServer};
use knot::runtime::{RuntimeHost, RuntimeMode};

#[derive(Debug, Clone, PartialEq, Eq)]
struct KnotdConfig {
    vault_path: PathBuf,
    create: bool,
}

fn parse_config(args: &[String], env_vault: Option<String>) -> Result<KnotdConfig, String> {
    let mut create = false;
    let mut cli_vault: Option<PathBuf> = None;

    let mut idx = 1;
    while idx < args.len() {
        match args[idx].as_str() {
            "--create" => {
                create = true;
                idx += 1;
            }
            "--vault" => {
                let value = args
                    .get(idx + 1)
                    .ok_or_else(|| "Missing value for --vault".to_string())?;
                cli_vault = Some(PathBuf::from(value));
                idx += 2;
            }
            _ => {
                idx += 1;
            }
        }
    }

    let vault_path = if let Some(path) = cli_vault {
        path
    } else if let Some(value) = env_vault {
        if value.trim().is_empty() {
            return Err("Missing vault path. Use --vault <path> or KNOT_VAULT_PATH.".to_string());
        }
        PathBuf::from(value)
    } else {
        return Err("Missing vault path. Use --vault <path> or KNOT_VAULT_PATH.".to_string());
    };

    Ok(KnotdConfig { vault_path, create })
}

fn main() {
    let args = std::env::args().collect::<Vec<_>>();
    let env_vault = std::env::var("KNOT_VAULT_PATH").ok();
    let config = match parse_config(&args, env_vault) {
        Ok(cfg) => cfg,
        Err(msg) => {
            eprintln!("{msg}");
            std::process::exit(2);
        }
    };

    let runtime = RuntimeHost::new(RuntimeMode::DesktopDaemonCapable);
    let rt = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .expect("tokio runtime");

    if let Err(err) = rt.block_on(async {
        if config.create {
            runtime.create_new(&config.vault_path).await
        } else {
            runtime.open_existing(&config.vault_path).await
        }
    }) {
        eprintln!(
            "Failed to initialize runtime for vault {}: {}",
            config.vault_path.display(),
            err
        );
        std::process::exit(3);
    }

    let server = McpServer::from_runtime(&runtime);
    if let Err(err) = run_stdio_server(&server, std::io::stdin(), std::io::stdout()) {
        eprintln!("knotd MCP server I/O error: {err}");
        std::process::exit(4);
    }
}

#[cfg(test)]
mod tests {
    use super::parse_config;
    use std::path::PathBuf;

    fn args(parts: &[&str]) -> Vec<String> {
        parts.iter().map(|s| s.to_string()).collect::<Vec<_>>()
    }

    #[test]
    fn parse_prefers_flag_vault_over_env() {
        let cfg = parse_config(
            &args(&["knotd", "--vault", "/tmp/flag-vault"]),
            Some("/tmp/env-vault".to_string()),
        )
        .expect("config");
        assert_eq!(cfg.vault_path, PathBuf::from("/tmp/flag-vault"));
    }

    #[test]
    fn parse_uses_env_when_flag_missing() {
        let cfg = parse_config(&args(&["knotd"]), Some("/tmp/env-vault".to_string()))
            .expect("config");
        assert_eq!(cfg.vault_path, PathBuf::from("/tmp/env-vault"));
    }

    #[test]
    fn parse_sets_create_when_flag_present() {
        let cfg = parse_config(
            &args(&["knotd", "--create", "--vault", "/tmp/new-vault"]),
            None,
        )
        .expect("config");
        assert!(cfg.create);
    }

    #[test]
    fn parse_fails_when_vault_missing() {
        let err = parse_config(&args(&["knotd"]), None).expect_err("missing path should fail");
        assert!(
            err.contains("--vault") || err.contains("KNOT_VAULT_PATH"),
            "unexpected error: {err}"
        );
    }
}
