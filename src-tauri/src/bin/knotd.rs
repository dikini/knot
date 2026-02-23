use std::path::PathBuf;

use knot::mcp::{run_stdio_server, McpServer};
use knot::runtime::{RuntimeHost, RuntimeMode, VaultLockStatus};
use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum RunMode {
    Serve,
    Status,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct KnotdConfig {
    vault_path: PathBuf,
    create: bool,
    run_mode: RunMode,
}

fn parse_config(args: &[String], env_vault: Option<String>) -> Result<KnotdConfig, String> {
    let mut create = false;
    let mut run_mode = RunMode::Serve;
    let mut cli_vault: Option<PathBuf> = None;

    let mut idx = 1;
    while idx < args.len() {
        match args[idx].as_str() {
            "--create" => {
                create = true;
                idx += 1;
            }
            "--status" => {
                run_mode = RunMode::Status;
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

    Ok(KnotdConfig {
        vault_path,
        create,
        run_mode,
    })
}

#[derive(Debug, Serialize)]
struct KnotdStatusPayload {
    mode: &'static str,
    vault_path: String,
    create: bool,
    ok: bool,
    lock_status: &'static str,
    error: Option<String>,
}

fn status_payload(config: &KnotdConfig, result: &Result<(), knot::error::KnotError>) -> KnotdStatusPayload {
    match result {
        Ok(()) => KnotdStatusPayload {
            mode: "status",
            vault_path: config.vault_path.to_string_lossy().to_string(),
            create: config.create,
            ok: true,
            lock_status: "available",
            error: None,
        },
        Err(err) => {
            let lock_status = match RuntimeHost::classify_open_error(err) {
                VaultLockStatus::Contended => "contended",
                VaultLockStatus::Available => "available",
                VaultLockStatus::Unknown => "unknown",
            };
            KnotdStatusPayload {
                mode: "status",
                vault_path: config.vault_path.to_string_lossy().to_string(),
                create: config.create,
                ok: false,
                lock_status,
                error: Some(err.to_string()),
            }
        }
    }
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

    let init_result = rt.block_on(async {
        if config.create {
            runtime.create_new(&config.vault_path).await
        } else {
            runtime.open_existing(&config.vault_path).await
        }
    });

    if config.run_mode == RunMode::Status {
        let payload = status_payload(&config, &init_result);
        match serde_json::to_string_pretty(&payload) {
            Ok(json) => println!("{json}"),
            Err(err) => {
                eprintln!("Failed to serialize status payload: {err}");
                std::process::exit(5);
            }
        }
        let code = if init_result.is_ok() { 0 } else { 3 };
        if init_result.is_ok() {
            let _ = rt.block_on(runtime.close());
        }
        std::process::exit(code);
    }

    if let Err(err) = init_result {
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
    use super::{parse_config, status_payload, KnotdConfig, RunMode};
    use knot::error::KnotError;
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
    fn parse_sets_status_mode_when_flag_present() {
        let cfg = parse_config(
            &args(&["knotd", "--status", "--vault", "/tmp/status-vault"]),
            None,
        )
        .expect("config");
        assert_eq!(cfg.run_mode, RunMode::Status);
    }

    #[test]
    fn parse_defaults_to_serve_mode() {
        let cfg = parse_config(&args(&["knotd", "--vault", "/tmp/vault"]), None).expect("config");
        assert_eq!(cfg.run_mode, RunMode::Serve);
    }

    #[test]
    fn parse_fails_when_vault_missing() {
        let err = parse_config(&args(&["knotd"]), None).expect_err("missing path should fail");
        assert!(
            err.contains("--vault") || err.contains("KNOT_VAULT_PATH"),
            "unexpected error: {err}"
        );
    }

    #[test]
    fn status_payload_marks_contended_lock() {
        let cfg = KnotdConfig {
            vault_path: PathBuf::from("/tmp/v"),
            create: false,
            run_mode: RunMode::Status,
        };
        let payload = status_payload(
            &cfg,
            &Err(KnotError::Search(
                "Failed to acquire Lockfile: LockBusy".to_string(),
            )),
        );
        assert_eq!(payload.lock_status, "contended");
        assert!(!payload.ok);
    }
}
