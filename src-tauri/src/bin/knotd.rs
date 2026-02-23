use std::path::PathBuf;

use knot::mcp::{run_stdio_server, McpServer};
use knot::runtime::{RuntimeHost, RuntimeMode, VaultLockStatus};
use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum RunMode {
    Serve,
    Status,
    Probe,
    ProbeJson,
    Capabilities,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct KnotdConfig {
    vault_path: PathBuf,
    create: bool,
    run_mode: RunMode,
}

const CAPABILITIES_FLAGS: [&str; 8] = [
    "--vault",
    "--create",
    "--status",
    "--check",
    "--once",
    "--probe-json",
    "--print-capabilities",
    "KNOT_VAULT_PATH",
];

#[derive(Debug, Serialize)]
struct KnotdCapabilitiesPayload {
    mode: &'static str,
    runtime_mode: &'static str,
    run_modes: Vec<&'static str>,
    flags: Vec<&'static str>,
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
            "--check" | "--once" => {
                run_mode = RunMode::Probe;
                idx += 1;
            }
            "--probe-json" => {
                run_mode = RunMode::ProbeJson;
                idx += 1;
            }
            "--print-capabilities" => {
                run_mode = RunMode::Capabilities;
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

    if run_mode == RunMode::Capabilities {
        return Ok(KnotdConfig {
            vault_path: PathBuf::new(),
            create,
            run_mode,
        });
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

#[derive(Debug, Clone, PartialEq, Eq)]
struct ProbeOutcome {
    ok: bool,
    lock_status: &'static str,
    error: Option<String>,
}

fn classify_lock_status_text(result: &Result<(), knot::error::KnotError>) -> &'static str {
    match result {
        Ok(()) => "available",
        Err(err) => match RuntimeHost::classify_open_error(err) {
            VaultLockStatus::Contended => "contended",
            VaultLockStatus::Available => "available",
            VaultLockStatus::Unknown => "unknown",
        },
    }
}

fn probe_outcome(result: &Result<(), knot::error::KnotError>) -> ProbeOutcome {
    ProbeOutcome {
        ok: result.is_ok(),
        lock_status: classify_lock_status_text(result),
        error: result.as_ref().err().map(|e| e.to_string()),
    }
}

fn probe_exit_code(outcome: &ProbeOutcome) -> i32 {
    if outcome.ok { 0 } else { 3 }
}

fn status_payload(config: &KnotdConfig, outcome: &ProbeOutcome) -> KnotdStatusPayload {
    KnotdStatusPayload {
        mode: "status",
        vault_path: config.vault_path.to_string_lossy().to_string(),
        create: config.create,
        ok: outcome.ok,
        lock_status: outcome.lock_status,
        error: outcome.error.clone(),
    }
}

fn probe_output_line(config: &KnotdConfig, outcome: &ProbeOutcome) -> String {
    let error = outcome
        .error
        .clone()
        .unwrap_or_else(|| "none".to_string())
        .replace(' ', "_");
    format!(
        "mode=probe ok={} vault_path={} create={} lock_status={} error={}",
        outcome.ok,
        config.vault_path.to_string_lossy(),
        config.create,
        outcome.lock_status,
        error
    )
}

fn probe_json_payload(config: &KnotdConfig, outcome: &ProbeOutcome) -> KnotdStatusPayload {
    KnotdStatusPayload {
        mode: "probe",
        vault_path: config.vault_path.to_string_lossy().to_string(),
        create: config.create,
        ok: outcome.ok,
        lock_status: outcome.lock_status,
        error: outcome.error.clone(),
    }
}

fn capabilities_payload() -> KnotdCapabilitiesPayload {
    KnotdCapabilitiesPayload {
        mode: "capabilities",
        runtime_mode: "desktop-daemon-capable",
        run_modes: vec!["serve", "status", "probe", "probe-json", "capabilities"],
        flags: CAPABILITIES_FLAGS.to_vec(),
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

    if config.run_mode == RunMode::Capabilities {
        match serde_json::to_string_pretty(&capabilities_payload()) {
            Ok(json) => println!("{json}"),
            Err(err) => {
                eprintln!("Failed to serialize capabilities payload: {err}");
                std::process::exit(5);
            }
        }
        std::process::exit(0);
    }

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
    let outcome = probe_outcome(&init_result);

    if config.run_mode == RunMode::Status {
        let payload = status_payload(&config, &outcome);
        match serde_json::to_string_pretty(&payload) {
            Ok(json) => println!("{json}"),
            Err(err) => {
                eprintln!("Failed to serialize status payload: {err}");
                std::process::exit(5);
            }
        }
        let code = probe_exit_code(&outcome);
        if init_result.is_ok() {
            let _ = rt.block_on(runtime.close());
        }
        std::process::exit(code);
    }

    if config.run_mode == RunMode::Probe {
        println!("{}", probe_output_line(&config, &outcome));
        if init_result.is_ok() {
            let _ = rt.block_on(runtime.close());
            std::process::exit(0);
        }
        std::process::exit(3);
    }

    if config.run_mode == RunMode::ProbeJson {
        let payload = probe_json_payload(&config, &outcome);
        match serde_json::to_string(&payload) {
            Ok(json) => println!("{json}"),
            Err(err) => {
                eprintln!("Failed to serialize probe payload: {err}");
                std::process::exit(5);
            }
        }
        if init_result.is_ok() {
            let _ = rt.block_on(runtime.close());
            std::process::exit(0);
        }
        std::process::exit(3);
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
    use super::{capabilities_payload, parse_config, probe_exit_code, probe_json_payload, probe_outcome, probe_output_line, status_payload, KnotdConfig, RunMode};
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
    fn parse_sets_check_mode_when_flag_present() {
        let cfg = parse_config(
            &args(&["knotd", "--check", "--vault", "/tmp/check-vault"]),
            None,
        )
        .expect("config");
        assert_eq!(cfg.run_mode, RunMode::Probe);
    }

    #[test]
    fn parse_sets_once_mode_when_flag_present() {
        let cfg = parse_config(
            &args(&["knotd", "--once", "--vault", "/tmp/once-vault"]),
            None,
        )
        .expect("config");
        assert_eq!(cfg.run_mode, RunMode::Probe);
    }

    #[test]
    fn parse_sets_probe_json_mode_when_flag_present() {
        let cfg = parse_config(
            &args(&["knotd", "--probe-json", "--vault", "/tmp/probe-json-vault"]),
            None,
        )
        .expect("config");
        assert_eq!(cfg.run_mode, RunMode::ProbeJson);
    }

    #[test]
    fn parse_sets_capabilities_mode_when_flag_present() {
        let cfg = parse_config(&args(&["knotd", "--print-capabilities"]), None).expect("config");
        assert_eq!(cfg.run_mode, RunMode::Capabilities);
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
        let outcome = probe_outcome(&Err(KnotError::Search(
            "Failed to acquire Lockfile: LockBusy".to_string(),
        )));
        let payload = status_payload(&cfg, &outcome);
        assert_eq!(payload.lock_status, "contended");
        assert!(!payload.ok);
    }

    #[test]
    fn probe_output_contains_lock_status() {
        let cfg = KnotdConfig {
            vault_path: PathBuf::from("/tmp/v"),
            create: false,
            run_mode: RunMode::Probe,
        };
        let outcome = probe_outcome(&Err(KnotError::Search("LockBusy".to_string())));
        let line = probe_output_line(&cfg, &outcome);
        assert!(line.contains("lock_status=contended"), "line: {line}");
    }

    #[test]
    fn probe_json_payload_contains_expected_fields() {
        let cfg = KnotdConfig {
            vault_path: PathBuf::from("/tmp/v"),
            create: true,
            run_mode: RunMode::ProbeJson,
        };
        let payload = probe_json_payload(&cfg, &probe_outcome(&Ok(())));
        let value = serde_json::to_value(payload).expect("json value");
        assert_eq!(value["mode"], "probe");
        assert_eq!(value["create"], true);
        assert_eq!(value["ok"], true);
        assert_eq!(value["lock_status"], "available");
        assert!(value.get("error").is_some());
    }

    #[test]
    fn capabilities_payload_lists_probe_modes_and_flags() {
        let payload = capabilities_payload();
        let value = serde_json::to_value(payload).expect("json value");
        assert_eq!(value["mode"], "capabilities");
        assert!(value["run_modes"].to_string().contains("probe-json"));
        assert!(value["flags"].to_string().contains("--print-capabilities"));
    }

    #[test]
    fn probe_exit_code_is_consistent() {
        let ok = probe_outcome(&Ok(()));
        let fail = probe_outcome(&Err(KnotError::Search("LockBusy".to_string())));
        assert_eq!(probe_exit_code(&ok), 0);
        assert_eq!(probe_exit_code(&fail), 3);
    }
}
