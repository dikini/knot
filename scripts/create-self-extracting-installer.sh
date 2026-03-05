#!/usr/bin/env bash
set -euo pipefail

# SPEC: COMP-LOCAL-INSTALLER-026 FR-2

usage() {
  cat <<'USAGE'
Usage:
  create-self-extracting-installer.sh --version <version> [--arch <arch>] [--output-dir <dir>] [--tarball <path>]
USAGE
}

version=""
arch="$(uname -m)"
output_dir="dist"
tarball=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version) version="${2:-}"; shift 2 ;;
    --arch) arch="${2:-}"; shift 2 ;;
    --output-dir) output_dir="${2:-}"; shift 2 ;;
    --tarball) tarball="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown argument: $1" >&2; usage; exit 1 ;;
  esac
done

if [[ -z "$version" ]]; then
  echo "--version is required" >&2
  usage
  exit 1
fi

mkdir -p "$output_dir"
if [[ -z "$tarball" ]]; then
  tarball="$output_dir/knot-local-$version-linux-$arch.tar.gz"
fi
if [[ ! -f "$tarball" ]]; then
  echo "tarball not found: $tarball" >&2
  exit 1
fi

installer_path="$output_dir/knot-installer-$version-linux-$arch.sh"

cat > "$installer_path" <<'SCRIPT'
#!/usr/bin/env bash
set -euo pipefail

VERSION="__VERSION__"
ARCH="__ARCH__"

usage() {
  cat <<'USAGE'
Usage:
  knot-installer.sh install|uninstall [installer args]
USAGE
}

cmd="${1:-}"
if [[ -z "$cmd" ]]; then
  usage
  exit 1
fi
shift || true

case "$cmd" in
  install|uninstall)
    ;;
  -h|--help)
    usage
    exit 0
    ;;
  *)
    echo "unknown command: $cmd" >&2
    usage
    exit 1
    ;;
esac

tmpdir="$(mktemp -d)"
cleanup() { rm -rf "$tmpdir"; }
trap cleanup EXIT

payload_line="$(awk '/^__KNOT_PAYLOAD_TAR_GZ__$/ { print NR + 1; exit 0; }' "$0")"
if [[ -z "$payload_line" ]]; then
  echo "embedded payload marker missing" >&2
  exit 1
fi

tail -n +"$payload_line" "$0" | base64 -d > "$tmpdir/payload.tar.gz"
tar -xzf "$tmpdir/payload.tar.gz" -C "$tmpdir"

payload_root="$tmpdir/knot-local-$VERSION-linux-$ARCH"
installer="$payload_root/scripts/local-installer.sh"
if [[ ! -x "$installer" ]]; then
  echo "payload installer missing: $installer" >&2
  exit 1
fi

if [[ "$cmd" == "install" ]]; then
  exec bash "$installer" install --version "$VERSION" --source-dir "$payload_root" "$@"
fi
exec bash "$installer" uninstall --version "$VERSION" "$@"

exit 0
__KNOT_PAYLOAD_TAR_GZ__
SCRIPT

sed -i "s/__VERSION__/$version/g; s/__ARCH__/$arch/g" "$installer_path"
base64 "$tarball" >> "$installer_path"
chmod 755 "$installer_path"
printf '%s\n' "$installer_path"
