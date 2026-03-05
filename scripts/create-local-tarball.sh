#!/usr/bin/env bash
set -euo pipefail

# SPEC: COMP-LOCAL-INSTALLER-026 FR-1

usage() {
  cat <<'USAGE'
Usage:
  create-local-tarball.sh --version <version> [--arch <arch>] [--output-dir <dir>] [--knot-bin <path>] [--knotd-bin <path>]
USAGE
}

version=""
arch="$(uname -m)"
output_dir="dist"
knot_bin="src-tauri/target/release/knot"
knotd_bin="src-tauri/target/release/knotd"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version) version="${2:-}"; shift 2 ;;
    --arch) arch="${2:-}"; shift 2 ;;
    --output-dir) output_dir="${2:-}"; shift 2 ;;
    --knot-bin) knot_bin="${2:-}"; shift 2 ;;
    --knotd-bin) knotd_bin="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown argument: $1" >&2; usage; exit 1 ;;
  esac
done

if [[ -z "$version" ]]; then
  echo "--version is required" >&2
  usage
  exit 1
fi

if [[ ! -f "$knot_bin" || ! -f "$knotd_bin" ]]; then
  echo "missing binaries: knot=$knot_bin knotd=$knotd_bin" >&2
  exit 1
fi

mkdir -p "$output_dir"
package_name="knot-local-$version-linux-$arch"
workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT

payload_root="$workdir/$package_name"
mkdir -p "$payload_root/bin" "$payload_root/scripts"
cp "$knot_bin" "$payload_root/bin/knot"
cp "$knotd_bin" "$payload_root/bin/knotd"
chmod 755 "$payload_root/bin/knot" "$payload_root/bin/knotd"
cp "scripts/local-installer.sh" "$payload_root/scripts/local-installer.sh"
chmod 755 "$payload_root/scripts/local-installer.sh"

out_path="$output_dir/$package_name.tar.gz"
tar -C "$workdir" -czf "$out_path" "$package_name"
printf '%s\n' "$out_path"
