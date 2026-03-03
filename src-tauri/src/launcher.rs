//! Linux launcher and installation helpers for AppImage/operator flows.
//!
//! TRACE: DESIGN-linux-appimage-packaging

use crate::error::{KnotError, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{self, BufRead, BufReader, Write};
#[cfg(unix)]
use std::os::unix::net::UnixStream;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::time::{Duration, Instant};

const LAUNCHER_CONFIG_FILE: &str = "knot.toml";
const SERVICE_ENV_FILE: &str = "knotd.env";
const CODEX_CONFIG_FILE: &str = ".codex/config.toml";
const CODEX_MCP_BEGIN_MARKER: &str = "# >>> knot-vault-mcp >>>";
const CODEX_MCP_END_MARKER: &str = "# <<< knot-vault-mcp <<<";

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LauncherMode {
    Ui,
    Knotd { service_mode: bool },
    Up,
    Down,
    Mcp(LauncherMcpCommand),
    Service(LauncherServiceCommand),
    Help,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LauncherMcpCommand {
    Bridge,
    Status,
    SocketPath,
    CodexInstall,
    CodexUninstall,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LauncherServiceCommand {
    Install { dry_run: bool },
    Uninstall { purge: bool },
    Start,
    Stop,
    Restart,
    Status,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum UiRuntimeMode {
    Embedded,
    #[default]
    DaemonIpc,
}

#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
pub struct LauncherConfig {
    #[serde(default)]
    pub appimage_path: Option<PathBuf>,
    #[serde(default)]
    pub vault_path: Option<PathBuf>,
    #[serde(default)]
    pub socket_path: Option<PathBuf>,
    #[serde(default)]
    pub log_dir: Option<PathBuf>,
    #[serde(default)]
    pub ui_mode: UiRuntimeMode,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct LauncherPaths {
    pub config_root: PathBuf,
    pub state_root: PathBuf,
    pub runtime_root: PathBuf,
    pub config_path: PathBuf,
    pub env_path: PathBuf,
    pub wrapper_path: PathBuf,
    pub unit_path: PathBuf,
    pub codex_config_path: PathBuf,
    pub log_dir: PathBuf,
    pub socket_path: PathBuf,
}

#[derive(Debug, Clone, Default)]
pub struct LauncherEnv {
    pub home_dir: Option<PathBuf>,
    pub config_dir: Option<PathBuf>,
    pub state_dir: Option<PathBuf>,
    pub runtime_dir: Option<PathBuf>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InstallArtifacts {
    pub wrapper_script: String,
    pub env_file: String,
    pub unit_file: String,
}

pub fn parse_launcher_args(args: &[String]) -> Result<LauncherMode> {
    let mode = match args.get(1).map(String::as_str) {
        None => LauncherMode::Ui,
        Some("ui") => LauncherMode::Ui,
        Some("knotd") => LauncherMode::Knotd {
            service_mode: args.iter().any(|arg| arg == "--service"),
        },
        Some("up") => LauncherMode::Up,
        Some("down") => LauncherMode::Down,
        Some("mcp") => match args.get(2).map(String::as_str) {
            Some("bridge") => LauncherMode::Mcp(LauncherMcpCommand::Bridge),
            Some("status") => LauncherMode::Mcp(LauncherMcpCommand::Status),
            Some("socket-path") => LauncherMode::Mcp(LauncherMcpCommand::SocketPath),
            Some("codex") => match args.get(3).map(String::as_str) {
                Some("install") => LauncherMode::Mcp(LauncherMcpCommand::CodexInstall),
                Some("uninstall") => LauncherMode::Mcp(LauncherMcpCommand::CodexUninstall),
                Some(other) => {
                    return Err(KnotError::Config(format!("unknown mcp codex command: {other}")))
                }
                None => LauncherMode::Mcp(LauncherMcpCommand::CodexInstall),
            },
            Some(other) => return Err(KnotError::Config(format!("unknown mcp command: {other}"))),
            None => LauncherMode::Mcp(LauncherMcpCommand::Status),
        },
        Some("service") => match args.get(2).map(String::as_str) {
            Some("install") => LauncherMode::Service(LauncherServiceCommand::Install {
                dry_run: args.iter().any(|arg| arg == "--dry-run"),
            }),
            Some("uninstall") => LauncherMode::Service(LauncherServiceCommand::Uninstall {
                purge: args.iter().any(|arg| arg == "--purge"),
            }),
            Some("start") => LauncherMode::Service(LauncherServiceCommand::Start),
            Some("stop") => LauncherMode::Service(LauncherServiceCommand::Stop),
            Some("restart") => LauncherMode::Service(LauncherServiceCommand::Restart),
            Some("status") | None => LauncherMode::Service(LauncherServiceCommand::Status),
            Some(other) => {
                return Err(KnotError::Config(format!(
                    "unknown service command: {other}"
                )))
            }
        },
        Some("--help") | Some("-h") | Some("help") => LauncherMode::Help,
        Some(other) => {
            return Err(KnotError::Config(format!(
                "unknown launcher command: {other}"
            )))
        }
    };
    Ok(mode)
}

pub fn resolve_launcher_paths(env: &LauncherEnv) -> Result<LauncherPaths> {
    let home_dir = env
        .home_dir
        .clone()
        .or_else(dirs::home_dir)
        .ok_or_else(|| KnotError::Config("Could not determine home directory".to_string()))?;
    let config_base = env
        .config_dir
        .clone()
        .or_else(dirs::config_dir)
        .ok_or_else(|| KnotError::Config("Could not determine config directory".to_string()))?;
    let state_base = env
        .state_dir
        .clone()
        .or_else(dirs::state_dir)
        .unwrap_or_else(|| home_dir.join(".local/state"));
    let runtime_base = env.runtime_dir.clone().or_else(dirs::runtime_dir);

    let config_root = config_base.join("knot");
    let state_root = state_base.join("knot");
    let runtime_root = runtime_base
        .map(|path| path.join("knot"))
        .unwrap_or_else(|| state_root.join("run"));
    Ok(LauncherPaths {
        config_path: config_root.join(LAUNCHER_CONFIG_FILE),
        env_path: config_root.join(SERVICE_ENV_FILE),
        wrapper_path: home_dir.join(".local/bin/knot"),
        unit_path: config_base.join("systemd/user/knotd.service"),
        codex_config_path: home_dir.join(CODEX_CONFIG_FILE),
        log_dir: state_root.join("log"),
        socket_path: runtime_root.join("knotd.sock"),
        config_root,
        state_root,
        runtime_root,
    })
}

pub fn render_install_artifacts(
    config: &LauncherConfig,
    appimage_path: &Path,
    paths: &LauncherPaths,
) -> Result<InstallArtifacts> {
    let wrapper_script = format!(
        "#!/usr/bin/env sh\nexec \"{}\" \"$@\"\n",
        appimage_path.display()
    );
    let mut env_lines = Vec::new();
    if let Some(vault_path) = config.vault_path.as_ref() {
        env_lines.push(format!("KNOT_VAULT_PATH={}", vault_path.display()));
    }
    env_lines.push(format!("KNOTD_SOCKET_PATH={}", paths.socket_path.display()));
    let env_file = format!("{}\n", env_lines.join("\n"));
    let unit_file = format!(
        "[Unit]\nDescription=Knot daemon\nAfter=default.target\n\n[Service]\nType=simple\nEnvironmentFile=%h/.config/knot/knotd.env\nExecStart=%h/.local/bin/knot knotd --service\nRestart=on-failure\nRestartSec=2\nWorkingDirectory={}\n\n[Install]\nWantedBy=default.target\n",
        paths.state_root.display()
    );
    Ok(InstallArtifacts {
        wrapper_script,
        env_file,
        unit_file,
    })
}

pub fn stale_appimage_message(config: &LauncherConfig) -> Option<String> {
    let path = config.appimage_path.as_ref()?;
    if path.exists() {
        return None;
    }
    Some(format!(
        "Configured AppImage path is stale: {}. Rerun `knot service install` to refresh installed paths.",
        path.display()
    ))
}

pub fn load_launcher_config(paths: &LauncherPaths) -> Result<LauncherConfig> {
    if !paths.config_path.exists() {
        return Ok(LauncherConfig::default());
    }
    let content = fs::read_to_string(&paths.config_path)?;
    Ok(toml::from_str(&content)?)
}

pub fn save_launcher_config(paths: &LauncherPaths, config: &LauncherConfig) -> Result<()> {
    fs::create_dir_all(&paths.config_root)?;
    let content = toml::to_string_pretty(config)?;
    fs::write(&paths.config_path, content)?;
    Ok(())
}

pub fn apply_env_overrides(mut config: LauncherConfig, paths: &LauncherPaths) -> LauncherConfig {
    if let Ok(path) = std::env::var("KNOT_APPIMAGE_PATH") {
        if !path.trim().is_empty() {
            config.appimage_path = Some(PathBuf::from(path));
        }
    }
    if let Ok(path) = std::env::var("KNOT_VAULT_PATH") {
        if !path.trim().is_empty() {
            config.vault_path = Some(PathBuf::from(path));
        }
    }
    if let Ok(path) = std::env::var("KNOTD_SOCKET_PATH") {
        if !path.trim().is_empty() {
            config.socket_path = Some(PathBuf::from(path));
        }
    }
    if let Ok(path) = std::env::var("KNOT_LOG_DIR") {
        if !path.trim().is_empty() {
            config.log_dir = Some(PathBuf::from(path));
        }
    }
    if let Ok(mode) = std::env::var("KNOT_UI_RUNTIME_MODE") {
        config.ui_mode = match mode.trim() {
            "daemon_ipc" => UiRuntimeMode::DaemonIpc,
            "embedded" => UiRuntimeMode::Embedded,
            _ => UiRuntimeMode::DaemonIpc,
        };
    }
    if matches!(config.ui_mode, UiRuntimeMode::Embedded)
        && std::env::var("KNOT_UI_RUNTIME_MODE").is_err()
    {
        config.ui_mode = UiRuntimeMode::DaemonIpc;
    }
    if config.socket_path.is_none() {
        config.socket_path = Some(paths.socket_path.clone());
    }
    if config.log_dir.is_none() {
        config.log_dir = Some(paths.log_dir.clone());
    }
    config
}

pub fn launcher_config_and_paths() -> Result<(LauncherConfig, LauncherPaths)> {
    let env = LauncherEnv::default();
    let paths = resolve_launcher_paths(&env)?;
    let config = apply_env_overrides(load_launcher_config(&paths)?, &paths);
    Ok((config, paths))
}

pub fn ensure_vault_path(config: &LauncherConfig) -> Result<&Path> {
    config.vault_path.as_deref().ok_or_else(|| {
        KnotError::Config(
            "Vault path is not configured. Set `vault_path` in ~/.config/knot/knot.toml or export KNOT_VAULT_PATH.".to_string(),
        )
    })
}

pub fn socket_path(config: &LauncherConfig, paths: &LauncherPaths) -> PathBuf {
    config
        .socket_path
        .clone()
        .unwrap_or_else(|| paths.socket_path.clone())
}

pub fn command_help() -> &'static str {
    "knot - AppImage launcher\n\nUsage:\n  knot [ui]\n  knot knotd [--service]\n  knot up\n  knot down\n  knot mcp bridge\n  knot mcp status\n  knot mcp socket-path\n  knot mcp codex install|uninstall\n  knot service install [--dry-run]\n  knot service uninstall [--purge]\n  knot service start|stop|restart|status\n"
}

pub fn install_service(
    config: &mut LauncherConfig,
    paths: &LauncherPaths,
    appimage_path: &Path,
    dry_run: bool,
) -> Result<InstallArtifacts> {
    ensure_vault_path(config)?;
    config.appimage_path = Some(appimage_path.to_path_buf());
    config.socket_path = Some(socket_path(config, paths));
    config.log_dir = Some(
        config
            .log_dir
            .clone()
            .unwrap_or_else(|| paths.log_dir.clone()),
    );

    let artifacts = render_install_artifacts(config, appimage_path, paths)?;
    if dry_run {
        return Ok(artifacts);
    }

    fs::create_dir_all(&paths.config_root)?;
    fs::create_dir_all(&paths.state_root)?;
    fs::create_dir_all(&paths.log_dir)?;
    fs::create_dir_all(paths.wrapper_path.parent().unwrap_or(&paths.state_root))?;
    fs::create_dir_all(paths.unit_path.parent().unwrap_or(&paths.config_root))?;

    save_launcher_config(paths, config)?;
    fs::write(&paths.env_path, &artifacts.env_file)?;
    fs::write(&paths.unit_path, &artifacts.unit_file)?;
    fs::write(&paths.wrapper_path, &artifacts.wrapper_script)?;
    make_executable(&paths.wrapper_path)?;

    run_systemctl_user(["daemon-reload"])?;
    Ok(artifacts)
}

pub fn uninstall_service(paths: &LauncherPaths, purge: bool) -> Result<()> {
    if paths.unit_path.exists() {
        let _ = run_systemctl_user(["disable", "--now", "knotd.service"]);
        fs::remove_file(&paths.unit_path)?;
    }
    if paths.wrapper_path.exists() {
        fs::remove_file(&paths.wrapper_path)?;
    }
    if paths.env_path.exists() {
        fs::remove_file(&paths.env_path)?;
    }
    let _ = run_systemctl_user(["daemon-reload"]);

    if purge {
        if paths.config_path.exists() {
            fs::remove_file(&paths.config_path)?;
        }
        if paths.state_root.exists() {
            let _ = fs::remove_dir_all(&paths.state_root);
        }
    }
    Ok(())
}

pub fn run_systemctl_user<I, S>(args: I) -> Result<()>
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    let mut command = Command::new("systemctl");
    command.arg("--user");
    for arg in args {
        command.arg(arg.as_ref());
    }
    let status = command.status()?;
    if status.success() {
        Ok(())
    } else {
        Err(KnotError::Other(format!(
            "systemctl --user command failed with status {status}"
        )))
    }
}

pub fn current_appimage_or_exe() -> Result<PathBuf> {
    if let Ok(path) = std::env::var("APPIMAGE") {
        if !path.trim().is_empty() {
            return Ok(PathBuf::from(path));
        }
    }
    std::env::current_exe().map_err(KnotError::from)
}

pub fn resolve_knotd_binary() -> Result<PathBuf> {
    if let Ok(path) = std::env::var("KNOT_LAUNCHER_KNOTD_BIN") {
        if !path.trim().is_empty() {
            return Ok(PathBuf::from(path));
        }
    }

    let current_exe = std::env::current_exe()?;
    let exe_dir = current_exe
        .parent()
        .ok_or_else(|| KnotError::Other("Could not determine executable directory".to_string()))?;
    let target = option_env!("TARGET").unwrap_or("x86_64-unknown-linux-gnu");
    let candidates = [
        exe_dir.join("knotd"),
        exe_dir.join(format!("knotd-{target}")),
        exe_dir.join("../lib/knotd"),
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("target/debug/knotd"),
        PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("target/release/knotd"),
    ];

    candidates
        .into_iter()
        .find(|path| path.exists())
        .ok_or_else(|| KnotError::Other("Could not locate bundled knotd binary".to_string()))
}

pub fn is_socket_reachable(path: &Path) -> bool {
    std::os::unix::net::UnixStream::connect(path).is_ok()
}

pub fn wait_for_socket(path: &Path, timeout: Duration) -> Result<()> {
    let deadline = Instant::now() + timeout;
    while Instant::now() < deadline {
        if is_socket_reachable(path) {
            return Ok(());
        }
        std::thread::sleep(Duration::from_millis(150));
    }
    Err(KnotError::Other(format!(
        "Timed out waiting for knotd socket at {}",
        path.display()
    )))
}

pub fn spawn_knotd(config: &LauncherConfig, paths: &LauncherPaths) -> Result<Child> {
    let knotd_bin = resolve_knotd_binary()?;
    let socket_path = socket_path(config, paths);
    let vault_path = ensure_vault_path(config)?;

    fs::create_dir_all(&paths.runtime_root)?;
    fs::create_dir_all(&paths.log_dir)?;
    let stdout_log = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(paths.log_dir.join("knotd.log"))?;
    let stderr_log = stdout_log.try_clone()?;

    let child = Command::new(knotd_bin)
        .arg("--listen-unix")
        .arg(&socket_path)
        .arg("--vault")
        .arg(vault_path)
        .stdout(Stdio::from(stdout_log))
        .stderr(Stdio::from(stderr_log))
        .spawn()?;
    Ok(child)
}

pub fn service_status_summary(config: &LauncherConfig, paths: &LauncherPaths) -> String {
    if let Some(message) = stale_appimage_message(config) {
        return message;
    }
    let socket = socket_path(config, paths);
    if is_socket_reachable(&socket) {
        format!("knotd reachable at {}", socket.display())
    } else {
        format!(
            "knotd is not reachable at {}. Use `knot service start` or `knot up`.",
            socket.display()
        )
    }
}

pub fn down_summary(paths: &LauncherPaths) -> Result<String> {
    if paths.unit_path.exists() {
        run_systemctl_user(["stop", "knotd.service"])?;
        return Ok("Stopped knotd.service".to_string());
    }

    Ok(
        "No managed knotd service is installed. Ad hoc daemon sessions stop when the UI exits."
            .to_string(),
    )
}

pub fn mcp_status_summary(config: &LauncherConfig, paths: &LauncherPaths) -> String {
    let socket = socket_path(config, paths);
    if is_socket_reachable(&socket) {
        format!("knotd MCP reachable at {}", socket.display())
    } else {
        format!(
            "knotd MCP is not reachable at {}. Start knotd first via `knot service start` or `knot up`.",
            socket.display()
        )
    }
}

pub fn render_codex_mcp_block(command_path: &Path) -> String {
    format!(
        "{begin}\n[mcp_servers.knot_vault]\ncommand = {command:?}\nargs = [\"mcp\", \"bridge\"]\nstartup_timeout_sec = 60\n{end}\n",
        begin = CODEX_MCP_BEGIN_MARKER,
        command = command_path.display().to_string(),
        end = CODEX_MCP_END_MARKER
    )
}

fn remove_managed_codex_block(content: &str) -> String {
    let mut lines = Vec::new();
    let mut in_block = false;

    for line in content.lines() {
        if line.trim() == CODEX_MCP_BEGIN_MARKER {
            in_block = true;
            continue;
        }
        if in_block {
            if line.trim() == CODEX_MCP_END_MARKER {
                in_block = false;
            }
            continue;
        }
        lines.push(line);
    }

    let mut next = lines.join("\n");
    if content.ends_with('\n') {
        next.push('\n');
    }
    next
}

pub fn install_codex_mcp(paths: &LauncherPaths, command_path: &Path) -> Result<String> {
    let existing = if paths.codex_config_path.exists() {
        fs::read_to_string(&paths.codex_config_path)?
    } else {
        String::new()
    };

    let without_managed = remove_managed_codex_block(&existing);
    let mut next = without_managed.trim_end().to_string();
    if !next.is_empty() {
        next.push_str("\n\n");
    }
    next.push_str(&render_codex_mcp_block(command_path));
    next.push('\n');

    if let Some(parent) = paths.codex_config_path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(&paths.codex_config_path, next)?;
    Ok(format!(
        "Installed Codex MCP config for knot_vault in {}",
        paths.codex_config_path.display()
    ))
}

pub fn uninstall_codex_mcp(paths: &LauncherPaths) -> Result<String> {
    if !paths.codex_config_path.exists() {
        return Ok(format!(
            "No Codex MCP config found at {}",
            paths.codex_config_path.display()
        ));
    }
    let existing = fs::read_to_string(&paths.codex_config_path)?;
    let next = remove_managed_codex_block(&existing);
    fs::write(&paths.codex_config_path, next.trim_start_matches('\n'))?;
    Ok(format!(
        "Removed managed Codex MCP config for knot_vault from {}",
        paths.codex_config_path.display()
    ))
}

pub fn codex_command_path(paths: &LauncherPaths) -> Result<PathBuf> {
    if let Ok(path) = std::env::var("APPIMAGE") {
        if !path.trim().is_empty() {
            return Ok(PathBuf::from(path));
        }
    }
    if paths.wrapper_path.exists() {
        return Ok(paths.wrapper_path.clone());
    }
    current_appimage_or_exe()
}

fn read_stdio_message<R: BufRead>(input: &mut R) -> io::Result<Option<String>> {
    let buffer = input.fill_buf()?;
    if buffer.is_empty() {
        return Ok(None);
    }

    let prefix = String::from_utf8_lossy(buffer);
    if prefix.starts_with("Content-Length:") {
        let mut content_length = None;
        loop {
            let mut line = String::new();
            let read = input.read_line(&mut line)?;
            if read == 0 {
                return Ok(None);
            }
            let trimmed = line.trim_end_matches(['\r', '\n']);
            if trimmed.is_empty() {
                break;
            }
            if let Some((name, value)) = trimmed.split_once(':') {
                if name.eq_ignore_ascii_case("Content-Length") {
                    content_length = Some(value.trim().parse::<usize>().map_err(|_| {
                        io::Error::new(io::ErrorKind::InvalidData, "Invalid Content-Length")
                    })?);
                }
            }
        }

        let length = content_length.ok_or_else(|| {
            io::Error::new(io::ErrorKind::InvalidData, "Missing Content-Length")
        })?;
        let mut body = vec![0_u8; length];
        input.read_exact(&mut body)?;
        return String::from_utf8(body)
            .map(Some)
            .map_err(|err| io::Error::new(io::ErrorKind::InvalidData, err));
    }

    let mut line = String::new();
    let read = input.read_line(&mut line)?;
    if read == 0 {
        return Ok(None);
    }
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return Ok(Some(String::new()));
    }
    Ok(Some(trimmed.to_string()))
}

fn write_framed_message<W: Write>(output: &mut W, payload: &str) -> io::Result<()> {
    write!(output, "Content-Length: {}\r\n\r\n", payload.len())?;
    output.write_all(payload.as_bytes())?;
    output.flush()
}

#[cfg(unix)]
pub fn run_mcp_bridge(config: &LauncherConfig, paths: &LauncherPaths) -> Result<i32> {
    let socket = socket_path(config, paths);
    let mut stream = UnixStream::connect(&socket).map_err(|err| {
        KnotError::Other(format!(
            "Failed to connect to knotd MCP socket at {}: {}",
            socket.display(),
            err
        ))
    })?;
    stream
        .set_read_timeout(Some(Duration::from_secs(300)))
        .map_err(KnotError::from)?;

    let mut socket_reader = BufReader::new(stream.try_clone().map_err(KnotError::from)?);
    let mut stdin = BufReader::new(io::stdin().lock());
    let mut stdout = io::stdout().lock();

    while let Some(message) = read_stdio_message(&mut stdin).map_err(KnotError::from)? {
        if message.is_empty() {
            continue;
        }
        write_framed_message(&mut stream, &message).map_err(KnotError::from)?;
        let response = crate::mcp::read_framed_message(&mut socket_reader)
            .map_err(KnotError::from)?
            .ok_or_else(|| KnotError::Other("knotd MCP socket closed".to_string()))?;
        writeln!(stdout, "{response}").map_err(KnotError::from)?;
        stdout.flush().map_err(KnotError::from)?;
    }

    Ok(0)
}

#[cfg(not(unix))]
pub fn run_mcp_bridge(_config: &LauncherConfig, _paths: &LauncherPaths) -> Result<i32> {
    Err(KnotError::Other(
        "MCP bridge is only supported on Unix-like platforms".to_string(),
    ))
}

pub fn ui_should_use_daemon(config: &LauncherConfig) -> bool {
    matches!(config.ui_mode, UiRuntimeMode::DaemonIpc)
}

#[cfg(unix)]
fn make_executable(path: &Path) -> Result<()> {
    let mut permissions = fs::metadata(path)?.permissions();
    permissions.set_mode(0o755);
    fs::set_permissions(path, permissions)?;
    Ok(())
}

#[cfg(not(unix))]
fn make_executable(_path: &Path) -> Result<()> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        apply_env_overrides, command_help, down_summary, parse_launcher_args,
        remove_managed_codex_block, render_codex_mcp_block, render_install_artifacts,
        resolve_launcher_paths, stale_appimage_message, LauncherConfig, LauncherEnv,
        LauncherMcpCommand, LauncherMode, LauncherServiceCommand, UiRuntimeMode,
    };
    use std::path::PathBuf;
    use std::sync::{Mutex, OnceLock};

    fn sample_env() -> LauncherEnv {
        LauncherEnv {
            home_dir: Some(PathBuf::from("/home/tester")),
            config_dir: Some(PathBuf::from("/home/tester/.config")),
            state_dir: Some(PathBuf::from("/home/tester/.local/state")),
            runtime_dir: Some(PathBuf::from("/run/user/1000")),
        }
    }

    struct EnvGuard {
        key: &'static str,
        original: Option<String>,
    }

    impl EnvGuard {
        fn clear(key: &'static str) -> Self {
            let original = std::env::var(key).ok();
            std::env::remove_var(key);
            Self { key, original }
        }

        fn set(key: &'static str, value: &str) -> Self {
            let original = std::env::var(key).ok();
            std::env::set_var(key, value);
            Self { key, original }
        }
    }

    impl Drop for EnvGuard {
        fn drop(&mut self) {
            if let Some(value) = &self.original {
                std::env::set_var(self.key, value);
            } else {
                std::env::remove_var(self.key);
            }
        }
    }

    fn env_lock() -> &'static Mutex<()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(|| Mutex::new(()))
    }

    #[test]
    fn launcher_tdd_parses_up_and_service_install_modes() {
        assert_eq!(
            parse_launcher_args(&["knot".into(), "up".into()]).expect("parse up"),
            LauncherMode::Up
        );
        assert_eq!(
            parse_launcher_args(&["knot".into(), "down".into()]).expect("parse down"),
            LauncherMode::Down
        );
        assert_eq!(
            parse_launcher_args(&["knot".into(), "service".into(), "install".into()]).expect("parse service install"),
            LauncherMode::Service(LauncherServiceCommand::Install { dry_run: false })
        );
        assert_eq!(
            parse_launcher_args(&["knot".into(), "mcp".into(), "bridge".into()]).expect("parse mcp bridge"),
            LauncherMode::Mcp(LauncherMcpCommand::Bridge)
        );
        assert_eq!(
            parse_launcher_args(&["knot".into(), "mcp".into(), "codex".into(), "install".into()]).expect("parse mcp codex install"),
            LauncherMode::Mcp(LauncherMcpCommand::CodexInstall)
        );
    }

    #[test]
    fn launcher_tdd_resolves_xdg_paths_with_runtime_socket_preference() {
        let paths = resolve_launcher_paths(&sample_env()).expect("paths");

        assert_eq!(paths.config_root, PathBuf::from("/home/tester/.config/knot"));
        assert_eq!(paths.state_root, PathBuf::from("/home/tester/.local/state/knot"));
        assert_eq!(paths.runtime_root, PathBuf::from("/run/user/1000/knot"));
        assert_eq!(paths.socket_path, PathBuf::from("/run/user/1000/knot/knotd.sock"));
        assert_eq!(paths.wrapper_path, PathBuf::from("/home/tester/.local/bin/knot"));
        assert_eq!(
            paths.unit_path,
            PathBuf::from("/home/tester/.config/systemd/user/knotd.service")
        );
    }

    #[test]
    fn launcher_tdd_renders_wrapper_env_and_unit_files_for_systemd_install() {
        let paths = resolve_launcher_paths(&sample_env()).expect("paths");
        let config = LauncherConfig {
            appimage_path: Some(PathBuf::from("/opt/Knot.AppImage")),
            vault_path: Some(PathBuf::from("/vaults/main")),
            socket_path: None,
            log_dir: None,
            ui_mode: UiRuntimeMode::DaemonIpc,
        };

        let artifacts =
            render_install_artifacts(&config, PathBuf::from("/opt/Knot.AppImage").as_path(), &paths)
                .expect("artifacts");

        assert!(artifacts.wrapper_script.contains("exec \"/opt/Knot.AppImage\" \"$@\""));
        assert!(artifacts.env_file.contains("KNOT_VAULT_PATH=/vaults/main"));
        assert!(artifacts.env_file.contains("KNOTD_SOCKET_PATH=/run/user/1000/knot/knotd.sock"));
        assert!(artifacts.unit_file.contains("EnvironmentFile=%h/.config/knot/knotd.env"));
        assert!(artifacts.unit_file.contains("ExecStart=%h/.local/bin/knot knotd --service"));
        assert!(artifacts.unit_file.contains("Restart=on-failure"));
    }

    #[test]
    fn launcher_tdd_reports_actionable_stale_appimage_diagnostics() {
        let config = LauncherConfig {
            appimage_path: Some(PathBuf::from("/missing/Knot.AppImage")),
            vault_path: None,
            socket_path: None,
            log_dir: None,
            ui_mode: UiRuntimeMode::Embedded,
        };

        let message = stale_appimage_message(&config).expect("message");
        assert!(message.contains("/missing/Knot.AppImage"));
        assert!(message.contains("knot service install"));
    }

    #[test]
    fn launcher_tdd_defaults_linux_desktop_ui_to_daemon_ipc_mode() {
        let _lock = env_lock().lock().expect("env lock");
        let _guard = EnvGuard::clear("KNOT_UI_RUNTIME_MODE");
        let paths = resolve_launcher_paths(&sample_env()).expect("paths");
        let config = apply_env_overrides(LauncherConfig::default(), &paths);

        assert_eq!(config.ui_mode, UiRuntimeMode::DaemonIpc);
        assert_eq!(
            config.socket_path,
            Some(PathBuf::from("/run/user/1000/knot/knotd.sock"))
        );
    }

    #[test]
    fn launcher_tdd_allows_explicit_embedded_override_for_low_risk_debugging() {
        let _lock = env_lock().lock().expect("env lock");
        let _guard = EnvGuard::set("KNOT_UI_RUNTIME_MODE", "embedded");
        let paths = resolve_launcher_paths(&sample_env()).expect("paths");
        let config = apply_env_overrides(LauncherConfig::default(), &paths);

        assert_eq!(config.ui_mode, UiRuntimeMode::Embedded);
    }

    #[test]
    fn launcher_tdd_help_lists_down_command() {
        assert!(command_help().contains("knot down"));
        assert!(command_help().contains("knot mcp bridge"));
    }

    #[test]
    fn launcher_tdd_down_explains_non_service_ad_hoc_behavior() {
        let paths = resolve_launcher_paths(&sample_env()).expect("paths");
        let message = down_summary(&paths).expect("down summary");

        assert!(message.contains("No managed knotd service"));
        assert!(message.contains("UI exits"));
    }

    #[test]
    fn launcher_tdd_renders_codex_block_using_wrapper_command_shape() {
        let block = render_codex_mcp_block(PathBuf::from("/home/tester/.local/bin/knot").as_path());
        assert!(block.contains("[mcp_servers.knot_vault]"));
        assert!(block.contains("command = \"/home/tester/.local/bin/knot\""));
        assert!(block.contains("args = [\"mcp\", \"bridge\"]"));
    }

    #[test]
    fn launcher_tdd_replaces_existing_managed_codex_block() {
        let existing = r#"
model = "gpt-5"

# >>> knot-vault-mcp >>>
[mcp_servers.knot_vault]
command = "node"
args = ["/old/bridge.mjs"]
startup_timeout_sec = 60
# <<< knot-vault-mcp <<<

[mcp_servers.playwright]
command = "npx"
"#;
        let next = remove_managed_codex_block(existing);
        assert!(!next.contains("/old/bridge.mjs"));
        assert!(next.contains("model = \"gpt-5\""));
        assert!(next.contains("[mcp_servers.playwright]"));
    }
}
