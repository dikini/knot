# Knotd MCP Operations Verification (2026-02-23)

Spec: `docs/specs/component/knotd-mcp-ops-008.md`
Plan: `docs/plans/knotd-mcp-ops-008-plan.md`
Trace: `DESIGN-knotd-mcp-ops`

## Commands
- `npm run -s knotd:mcp:smoke`
- `cargo test --manifest-path src-tauri/Cargo.toml --bin knotd -- --nocapture`
- `cargo check --manifest-path src-tauri/Cargo.toml --bin knotd`
- `node scripts/setup-codex-knotd-mcp.mjs`

## Results
- knotd smoke script: PASS
- knotd bin tests: PASS (18/18)
- knotd bin compile check: PASS
- setup script idempotency: PASS

## Requirement Coverage
| Requirement | Evidence | Status |
| --- | --- | --- |
| FR-1 knot_vault uses knotd launcher | `scripts/setup-codex-knotd-mcp.mjs`, `~/.codex/config.toml` managed block | ✅ |
| FR-2 probe-json preflight before serve | `scripts/knotd-mcp-codex.mjs` | ✅ |
| FR-3 setup automation for codex config | `scripts/setup-codex-knotd-mcp.mjs` + npm scripts | ✅ |
| FR-4 ops smoke coverage | `scripts/knotd-mcp-smoke.mjs`, `npm run knotd:mcp:smoke` | ✅ |
| FR-5 help/version checks | `knotd --help/--version` support in `src-tauri/src/bin/knotd.rs` + smoke assertions | ✅ |
| FR-6 docs workflow guidance | `docs/testing/knotd-mcp.md` | ✅ |
