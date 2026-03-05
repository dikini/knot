# Verification: COMP-LOCAL-INSTALLER-026

- Date: 2026-03-05
- Scope: user-local installer/uninstaller scaffold and packaging scripts
- Spec: `docs/specs/component/local-user-installer-026.md`

## Commands Run

```bash
npx vitest run src/local-installer.test.ts
```

Result: pass (`2` tests).

```bash
tmpd=$(mktemp -d)
printf '#!/usr/bin/env sh\necho knot\n' > "$tmpd/knot"
printf '#!/usr/bin/env sh\necho knotd\n' > "$tmpd/knotd"
chmod +x "$tmpd/knot" "$tmpd/knotd"
bash scripts/create-local-tarball.sh --version 0.1.0-test --arch x86_64 --output-dir "$tmpd/dist" --knot-bin "$tmpd/knot" --knotd-bin "$tmpd/knotd"
bash scripts/create-self-extracting-installer.sh --version 0.1.0-test --arch x86_64 --output-dir "$tmpd/dist" --tarball "$tmpd/dist/knot-local-0.1.0-test-linux-x86_64.tar.gz"
ls -la "$tmpd/dist"
```

Result: pass; both artifacts produced and executable installer emitted.

## Compliance Matrix

| Requirement | Status | Evidence |
|-------------|--------|----------|
| FR-1 tarball payload | pass | `scripts/create-local-tarball.sh`; packaging smoke output path |
| FR-2 self-extracting installer | pass | `scripts/create-self-extracting-installer.sh`; installer output path |
| FR-3 install layout + symlinks | pass | `src/local-installer.test.ts` install assertions |
| FR-4 manifest writing | pass | `src/local-installer.test.ts` manifest assertions |
| FR-5 manifest-only deletion safety | pass | `src/local-installer.test.ts` keeps untracked `keep.txt` |
| FR-6 idempotent uninstall | pass | `src/local-installer.test.ts` second uninstall call succeeds |
| FR-7 root overrides | pass | tests run with `KNOT_INSTALL_ROOT`, `KNOT_BIN_DIR`, `KNOT_SHARE_DIR` |

## Acceptance Criteria

| AC | Status | Evidence |
|----|--------|----------|
| AC-1 | pass | tarball exists: `knot-local-0.1.0-test-linux-x86_64.tar.gz` |
| AC-2 | pass | installer exists: `knot-installer-0.1.0-test-linux-x86_64.sh` |
| AC-3 | pass | install test verifies files + symlinks + manifest |
| AC-4 | pass | uninstall + repeated uninstall pass |
| AC-5 | pass | untracked file preserved after uninstall |

## Gaps

- No signed release artifact workflow yet (out of scope for scaffold).
- No distro package integration in this workstream.
