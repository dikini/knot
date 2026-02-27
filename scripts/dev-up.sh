#!/usr/bin/env bash
set -euo pipefail

# TRACE: DESIGN-knotd-dev-lifecycle

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="${KNOT_DEV_RUN_DIR:-$ROOT_DIR/.run/knotd-dev}"
SOCKET_PATH="${KNOTD_SOCKET_PATH:-$RUN_DIR/knotd.sock}"
VAULT_PATH="${KNOT_DEV_VAULT_PATH:-$ROOT_DIR/test-vault/canonical}"
KNOTD_PID_FILE="$RUN_DIR/knotd.pid"
UI_PID_FILE="$RUN_DIR/ui.pid"
KNOTD_LOG="$RUN_DIR/knotd.log"
UI_LOG="$RUN_DIR/ui.log"
KNOTD_BIN="${KNOT_DEV_KNOTD_BIN:-$ROOT_DIR/src-tauri/target/debug/knotd}"

mkdir -p "$RUN_DIR"

check_command() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "[dev-up] missing dependency: $1" >&2
    exit 1
  }
}

wait_for_socket() {
  local socket_path="$1"
  local attempts=50
  local delay=0.2

  for ((i = 0; i < attempts; i += 1)); do
    if node -e '
      const net = require("node:net");
      const socketPath = process.argv[1];
      const socket = net.createConnection({ path: socketPath });
      const finish = (code) => {
        socket.removeAllListeners();
        try { socket.destroy(); } catch {}
        process.exit(code);
      };
      socket.once("connect", () => finish(0));
      socket.once("error", () => finish(1));
      setTimeout(() => finish(1), 250);
    ' "$socket_path" >/dev/null 2>&1; then
      return 0
    fi
    sleep "$delay"
  done

  return 1
}

kill_pid_file() {
  local pid_file="$1"
  local label="$2"
  if [[ ! -f "$pid_file" ]]; then
    return 0
  fi

  local pid
  pid="$(cat "$pid_file" 2>/dev/null || true)"
  rm -f "$pid_file"
  if [[ -z "$pid" ]]; then
    return 0
  fi

  if kill -0 "$pid" >/dev/null 2>&1; then
    kill "$pid" >/dev/null 2>&1 || true
    for _ in {1..20}; do
      if ! kill -0 "$pid" >/dev/null 2>&1; then
        echo "[dev-up] stopped stale $label pid=$pid"
        return 0
      fi
      sleep 0.1
    done
    kill -9 "$pid" >/dev/null 2>&1 || true
    echo "[dev-up] killed stale $label pid=$pid"
  fi
}

kill_matching_knotd() {
  if ! command -v pgrep >/dev/null 2>&1; then
    return 0
  fi

  local pids
  pids="$(pgrep -f "knotd.*--listen-unix $SOCKET_PATH" || true)"
  if [[ -z "$pids" ]]; then
    return 0
  fi

  while read -r pid; do
    [[ -z "$pid" ]] && continue
    kill "$pid" >/dev/null 2>&1 || true
    sleep 0.1
    kill -9 "$pid" >/dev/null 2>&1 || true
    echo "[dev-up] killed matching knotd pid=$pid socket=$SOCKET_PATH"
  done <<<"$pids"
}

signal_bridges() {
  if ! command -v pgrep >/dev/null 2>&1; then
    echo "[dev-up] bridge signal skipped: pgrep unavailable"
    return 0
  fi

  local bridge_script="$ROOT_DIR/scripts/knotd-mcp-bridge.mjs"
  local pids
  pids="$(pgrep -f "$bridge_script" || true)"
  if [[ -z "$pids" ]]; then
    echo "[dev-up] no bridge process found"
    return 0
  fi

  while read -r pid; do
    [[ -z "$pid" ]] && continue
    kill -HUP "$pid" >/dev/null 2>&1 || true
    echo "[dev-up] signaled bridge pid=$pid with SIGHUP"
  done <<<"$pids"
}

if [[ "${1:-}" == "--check" ]]; then
  check_command cargo
  check_command node
  check_command npm
  echo "[dev-up] check ok"
  echo "[dev-up] run_dir=$RUN_DIR"
  echo "[dev-up] socket=$SOCKET_PATH"
  echo "[dev-up] vault=$VAULT_PATH"
  exit 0
fi

check_command cargo
check_command node
check_command npm

kill_pid_file "$UI_PID_FILE" "ui"
kill_pid_file "$KNOTD_PID_FILE" "knotd"
kill_matching_knotd
rm -f "$SOCKET_PATH"

if [[ "${KNOT_DEV_SKIP_BUILD:-0}" != "1" ]]; then
  echo "[dev-up] building knotd"
  cargo build --manifest-path "$ROOT_DIR/src-tauri/Cargo.toml" --bin knotd >/dev/null
fi

echo "[dev-up] starting knotd"
nohup "$KNOTD_BIN" --listen-unix "$SOCKET_PATH" --vault "$VAULT_PATH" >"$KNOTD_LOG" 2>&1 &
KNOTD_PID=$!
echo "$KNOTD_PID" >"$KNOTD_PID_FILE"

if ! wait_for_socket "$SOCKET_PATH"; then
  echo "[dev-up] knotd did not become ready; see $KNOTD_LOG" >&2
  exit 1
fi

echo "[dev-up] starting ui"
(
  cd "$ROOT_DIR"
  nohup env \
    KNOT_UI_RUNTIME_MODE=daemon_ipc \
    KNOTD_SOCKET_PATH="$SOCKET_PATH" \
    npm run tauri-dev >"$UI_LOG" 2>&1 &
  echo $! >"$UI_PID_FILE"
)
UI_PID="$(cat "$UI_PID_FILE")"

signal_bridges

echo "[dev-up] started knotd pid=$KNOTD_PID"
echo "[dev-up] started ui pid=$UI_PID"
echo "[dev-up] socket=$SOCKET_PATH"
echo "[dev-up] vault=$VAULT_PATH"
echo "[dev-up] knotd_log=$KNOTD_LOG"
echo "[dev-up] ui_log=$UI_LOG"
