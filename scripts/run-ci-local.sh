#!/usr/bin/env bash
set -euo pipefail

# Trace: DESIGN-local-ci-runner-2026-02-22
# Trace: BUG-local-ci-playwright-deps-2026-02-22
# Trace: BUG-local-ci-base-ref-resolution-2026-02-22
# Trace: DESIGN-daemon-ui-ipc-cutover

RUN_UI=1
RUN_STORYBOOK=1
RUN_NATIVE=1
DO_INSTALL=1
DO_PLAYWRIGHT_INSTALL=1
PLAYWRIGHT_WITH_DEPS=0
NATIVE_LAUNCH=1
RUN_DAEMON_SMOKE=1
REQUIRE_DAEMON_SMOKE=0

usage() {
  cat <<'EOF'
Run Knot CI workflows locally.

Usage:
  bash scripts/run-ci-local.sh [options]

Options:
  --skip-ui                    Skip UI quality workflow checks
  --skip-storybook             Skip Storybook build workflow checks
  --skip-native                Skip native smoke workflow checks
  --skip-install               Skip npm ci
  --skip-playwright-install    Skip playwright browser install
  --playwright-with-deps       Install playwright with system deps (may require sudo)
  --skip-native-launch         Skip native launch-smoke step
  --skip-daemon-smoke         Skip daemon socket smoke checks
  --require-daemon-smoke      Fail if daemon socket smoke cannot run
  -h, --help                   Show this help

Equivalent workflows:
  .github/workflows/ui-quality.yml
  .github/workflows/storybook.yml
  .github/workflows/native-smoke.yml
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-ui)
      RUN_UI=0
      ;;
    --skip-storybook)
      RUN_STORYBOOK=0
      ;;
    --skip-native)
      RUN_NATIVE=0
      ;;
    --skip-install)
      DO_INSTALL=0
      ;;
    --skip-playwright-install)
      DO_PLAYWRIGHT_INSTALL=0
      ;;
    --playwright-with-deps)
      PLAYWRIGHT_WITH_DEPS=1
      ;;
    --skip-native-launch)
      NATIVE_LAUNCH=0
      ;;
    --skip-daemon-smoke)
      RUN_DAEMON_SMOKE=0
      ;;
    --require-daemon-smoke)
      REQUIRE_DAEMON_SMOKE=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 2
      ;;
  esac
  shift
done

run_step() {
  local label="$1"
  shift
  echo ""
  echo "==> ${label}"
  "$@"
}

if [[ "$DO_INSTALL" -eq 1 ]]; then
  run_step "Install dependencies (npm ci)" npm ci
fi

# ui-doc-sync expects BASE_REF to exist locally; auto-resolve a safe default.
if [[ -z "${BASE_REF:-}" ]]; then
  if git rev-parse --verify --quiet origin/main >/dev/null; then
    export BASE_REF="origin/main"
  elif git rev-parse --verify --quiet main >/dev/null; then
    export BASE_REF="main"
  elif git rev-parse --verify --quiet HEAD~1 >/dev/null; then
    export BASE_REF="HEAD~1"
  fi
fi

if [[ -n "${BASE_REF:-}" ]]; then
  echo "Using BASE_REF=${BASE_REF}"
fi

if [[ "$RUN_UI" -eq 1 ]]; then
  if [[ "$DO_PLAYWRIGHT_INSTALL" -eq 1 ]]; then
    if npx playwright install --list | grep -q "chromium-"; then
      echo "Playwright chromium already present; skipping browser install."
    else
      if [[ "$PLAYWRIGHT_WITH_DEPS" -eq 1 ]]; then
        run_step "Install Playwright browser+deps (chromium)" npx playwright install --with-deps chromium
      else
        run_step "Install Playwright browser (chromium)" npx playwright install chromium
      fi
    fi
  fi
  run_step "Validate UI doc/evidence sync" npm run -s qa:docsync
  run_step "Validate Storybook coverage matrix" npm run -s qa:storybook-matrix
  run_step "Run UI quality gate" npm run -s qa:ci
fi

if [[ "$RUN_STORYBOOK" -eq 1 ]]; then
  run_step "Build Storybook" npm run -s storybook:build
fi

if [[ "$RUN_NATIVE" -eq 1 ]]; then
  run_step "Native smoke preflight check" npm run -s test:e2e:tauri -- --check

  if [[ "$NATIVE_LAUNCH" -eq 1 ]]; then
    if command -v xvfb-run >/dev/null 2>&1; then
      run_step \
        "Native launch smoke (xvfb-run)" \
        env TAURI_SMOKE_CMD="xvfb-run -a npm run tauri dev -- --no-watch" \
        npm run -s test:e2e:tauri -- --launch-smoke --timeout=420
    else
      echo "xvfb-run not found; running native launch smoke without xvfb-run."
      run_step \
        "Native launch smoke (no xvfb-run)" \
        env TAURI_SMOKE_CMD="npm run tauri dev -- --no-watch" \
        npm run -s test:e2e:tauri -- --launch-smoke --timeout=420
    fi
  fi
fi

if [[ "$RUN_DAEMON_SMOKE" -eq 1 ]]; then
  run_step "UI daemon-mode smoke (App handlers + startup attach retry)" npm run -s ui:daemon:smoke

  SOCKET_PATH="${KNOTD_SOCKET_PATH:-/tmp/knotd.sock}"
  if [[ -S "${SOCKET_PATH}" ]]; then
    run_step "knotd daemon socket smoke (open/new/close over MCP)" npm run -s knotd:daemon:smoke
  else
    if [[ "$REQUIRE_DAEMON_SMOKE" -eq 1 ]]; then
      echo "Daemon smoke required but socket not found: ${SOCKET_PATH}" >&2
      exit 1
    fi
    echo "Skipping knotd daemon socket smoke; socket not found: ${SOCKET_PATH}"
    echo "Start knotd first or pass --require-daemon-smoke to fail when missing."
  fi
fi

echo ""
echo "Local CI run completed."
