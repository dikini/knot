#!/usr/bin/env bash
set -euo pipefail

# SPEC: COMP-LOCAL-INSTALLER-026 FR-3 FR-4 FR-5 FR-6 FR-7

usage() {
  cat <<'USAGE'
Usage:
  local-installer.sh install --version <version> --source-dir <payload-dir>
  local-installer.sh uninstall [--version <version>]

Environment overrides:
  KNOT_INSTALL_ROOT (default: ~/.local/opt)
  KNOT_BIN_DIR      (default: ~/.local/bin)
  KNOT_SHARE_DIR    (default: ~/.local/share)
USAGE
}

command="${1:-}"
if [[ -z "$command" ]]; then
  usage
  exit 1
fi
shift || true

version=""
source_dir=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version)
      version="${2:-}"
      shift 2
      ;;
    --source-dir)
      source_dir="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

install_root="${KNOT_INSTALL_ROOT:-$HOME/.local/opt}"
bin_dir="${KNOT_BIN_DIR:-$HOME/.local/bin}"
share_dir="${KNOT_SHARE_DIR:-$HOME/.local/share}"
app_root="$install_root/knot"
manifest_dir="$share_dir/knot"

resolve_current_version() {
  local knot_link="$bin_dir/knot"
  if [[ ! -L "$knot_link" ]]; then
    return 1
  fi
  local target
  target="$(readlink "$knot_link")"
  if [[ "$target" != /* ]]; then
    target="$(cd "$(dirname "$knot_link")" && cd "$(dirname "$target")" && pwd)/$(basename "$target")"
  fi
  # Expected: <install_root>/knot/<version>/bin/knot
  basename "$(dirname "$(dirname "$target")")"
}

maybe_rmdir() {
  local dir="$1"
  if [[ -d "$dir" ]]; then
    rmdir "$dir" 2>/dev/null || true
  fi
}

do_install() {
  if [[ -z "$version" || -z "$source_dir" ]]; then
    echo "install requires --version and --source-dir" >&2
    exit 1
  fi

  local source_knot="$source_dir/bin/knot"
  local source_knotd="$source_dir/bin/knotd"
  if [[ ! -f "$source_knot" || ! -f "$source_knotd" ]]; then
    echo "source payload missing required binaries under $source_dir/bin" >&2
    exit 1
  fi

  local version_root="$app_root/$version"
  local target_bin_dir="$version_root/bin"
  local target_knot="$target_bin_dir/knot"
  local target_knotd="$target_bin_dir/knotd"
  local manifest_path="$manifest_dir/manifest-$version.txt"

  mkdir -p "$target_bin_dir" "$bin_dir" "$manifest_dir"

  cp "$source_knot" "$target_knot"
  cp "$source_knotd" "$target_knotd"
  chmod 755 "$target_knot" "$target_knotd"

  ln -sfn "$target_knot" "$bin_dir/knot"
  ln -sfn "$target_knotd" "$bin_dir/knotd"

  {
    printf '%s\n' "$target_knot"
    printf '%s\n' "$target_knotd"
    printf '%s\n' "$bin_dir/knot"
    printf '%s\n' "$bin_dir/knotd"
  } > "$manifest_path"

  echo "installed knot $version into $version_root"
}

do_uninstall() {
  if [[ -z "$version" ]]; then
    if ! version="$(resolve_current_version)"; then
      echo "no version specified and no current knot symlink found; nothing to uninstall"
      exit 0
    fi
  fi

  local version_root="$app_root/$version"
  local manifest_path="$manifest_dir/manifest-$version.txt"

  if [[ ! -f "$manifest_path" ]]; then
    echo "manifest missing for version $version; nothing to uninstall"
    exit 0
  fi

  while IFS= read -r path; do
    [[ -z "$path" ]] && continue
    if [[ -L "$path" || -f "$path" ]]; then
      rm -f -- "$path"
    fi
  done < "$manifest_path"

  rm -f -- "$manifest_path"

  maybe_rmdir "$version_root/bin"
  maybe_rmdir "$version_root"
  maybe_rmdir "$app_root"
  maybe_rmdir "$manifest_dir"
  maybe_rmdir "$share_dir"

  echo "uninstalled knot $version"
}

case "$command" in
  install)
    do_install
    ;;
  uninstall)
    do_uninstall
    ;;
  *)
    echo "unknown command: $command" >&2
    usage
    exit 1
    ;;
esac
