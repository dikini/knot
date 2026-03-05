#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  release-local-artifacts.sh --version <version> [--arch <arch>] [--output-dir <dir>] [--skip-build]

Builds and emits:
  1) local tarball
  2) self-extracting installer
  3) knot + knotd binary .deb packages
  4) Debian source package artifacts
USAGE
}

version=""
arch="$(dpkg --print-architecture 2>/dev/null || uname -m)"
output_dir="dist"
skip_build="0"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version) version="${2:-}"; shift 2 ;;
    --arch) arch="${2:-}"; shift 2 ;;
    --output-dir) output_dir="${2:-}"; shift 2 ;;
    --skip-build) skip_build="1"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown argument: $1" >&2; usage; exit 1 ;;
  esac
done

if [[ -z "$version" ]]; then
  echo "--version is required" >&2
  usage
  exit 1
fi

knot_bin="src-tauri/target/release/knot"
knotd_bin="src-tauri/target/release/knotd"

if [[ "$skip_build" != "1" ]]; then
  cargo build --release --manifest-path src-tauri/Cargo.toml --bin knot --bin knotd
fi

[[ -f "$knot_bin" ]] || { echo "missing binary: $knot_bin" >&2; exit 1; }
[[ -f "$knotd_bin" ]] || { echo "missing binary: $knotd_bin" >&2; exit 1; }

mkdir -p "$output_dir"

bash scripts/create-local-tarball.sh \
  --version "$version" \
  --arch "$arch" \
  --output-dir "$output_dir" \
  --knot-bin "$knot_bin" \
  --knotd-bin "$knotd_bin"

tarball="$output_dir/knot-local-$version-linux-$arch.tar.gz"

bash scripts/create-self-extracting-installer.sh \
  --version "$version" \
  --arch "$arch" \
  --output-dir "$output_dir" \
  --tarball "$tarball"

bash scripts/create-deb-packages.sh \
  --version "$version" \
  --arch "$arch" \
  --output-dir "$output_dir" \
  --knot-bin "$knot_bin" \
  --knotd-bin "$knotd_bin"

bash scripts/create-deb-source.sh \
  --version "$version" \
  --output-dir "$output_dir"

echo "release artifacts generated in: $output_dir"
ls -1 "$output_dir" | sed -n '1,200p'
