# Local User Installer (026) Implementation Plan

Change-Type: design-update
Trace: DESIGN-local-user-installer-026
Spec: `docs/specs/component/local-user-installer-026.md`
Generated: `2026-03-05`

## Metadata
- Approach: `sequential`

## Summary
- Total tasks: `4`
- Size: `2 small, 2 medium`
- Critical path: `LUI-001 -> LUI-002 -> LUI-003 -> LUI-004`

## Tasks

| ID | Task | Size | Depends | Spec Ref |
|----|------|------|---------|----------|
| LUI-001 | Add failing tests for installer manifest safety and idempotent uninstall semantics | M | - | FR-4, FR-5, FR-6, FR-7; AC-3, AC-4, AC-5 |
| LUI-002 | Implement user-local install/uninstall shell scaffold using manifest-driven deletion and root overrides | M | LUI-001 | FR-3, FR-4, FR-5, FR-6, FR-7 |
| LUI-003 | Implement tarball packaging script for local distribution payload | S | LUI-002 | FR-1; AC-1 |
| LUI-004 | Implement self-extracting installer generator script embedding tarball payload and dispatching install/uninstall | S | LUI-003 | FR-2; AC-2 |

## Dependency DAG
`LUI-001 -> LUI-002 -> LUI-003 -> LUI-004`

## Concern Coverage
| Concern | Tasks | Verification |
|---------|-------|--------------|
| REL | LUI-001, LUI-002 | Automated tests for exact-path manifest deletion + uninstall idempotency |
| CONF | LUI-002, LUI-004 | Deterministic command interface (`install|uninstall`) |
| COMP | LUI-003, LUI-004 | POSIX shell packaging and extraction flow |

## Verification Commands
- `npx vitest run src/local-installer.test.ts`
- `bash scripts/create-local-tarball.sh --version 0.1.0-test --output-dir /tmp/knot-dist-test`
- `bash scripts/create-self-extracting-installer.sh --version 0.1.0-test --output-dir /tmp/knot-dist-test`
