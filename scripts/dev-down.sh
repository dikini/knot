#!/usr/bin/env bash
set -euo pipefail

# TRACE: DESIGN-knotd-dev-lifecycle

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_DIR="${KNOT_DEV_RUN_DIR:-$ROOT_DIR/.run/knotd-dev}"
SOCKET_PATH="${KNOTD_SOCKET_PATH:-$RUN_DIR/knotd.sock}"
KNOTD_PID_FILE="$RUN_DIR/knotd.pid"
UI_PID_FILE="$RUN_DIR/ui.pid"

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
        echo "[dev-down] stopped $label pid=$pid"
        return 0
      fi
      sleep 0.1
    done
    kill -9 "$pid" >/dev/null 2>&1 || true
    echo "[dev-down] killed $label pid=$pid"
  else
    echo "[dev-down] stale $label pid file removed pid=$pid"
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
    echo "[dev-down] killed matching knotd pid=$pid socket=$SOCKET_PATH"
  done <<<"$pids"
}

mkdir -p "$RUN_DIR"

kill_pid_file "$UI_PID_FILE" "ui"
kill_pid_file "$KNOTD_PID_FILE" "knotd"
kill_matching_knotd
rm -f "$SOCKET_PATH"

echo "[dev-down] socket cleared: $SOCKET_PATH"
echo "[dev-down] runtime dir: $RUN_DIR"
