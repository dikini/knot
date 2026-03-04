# Knot Tool CLI 025 Implementation Plan

Change-Type: design-update
Trace: DESIGN-knot-tool-cli-025
Spec: `docs/specs/component/knot-tool-cli-025.md`
Generated: `2026-03-04`

## Metadata
- Approach: `sequential`

## Summary
- Total tasks: `7`
- Size mix: `3 small, 4 medium, 0 large`
- Critical path: `KTC-001 -> KTC-002 -> KTC-003 -> KTC-004 -> KTC-006`

## Tasks

### Phase 1: Command Surface and Parsing
| ID | Task | Size | Depends | Spec Ref |
| --- | --- | --- | --- | --- |
| KTC-001 | Add failing launcher tests for `tool` parse paths (`tool`, `tool --help`, `tool <command>`, payload flags, invalid forms) | M | - | FR-1, FR-2, FR-8, FR-9 |
| KTC-002 | Extend launcher enums/parser/help contract in `src-tauri/src/launcher.rs` for `tool` namespace and curated help text | M | KTC-001 | FR-1, FR-3, FR-4, FR-9 |

### Phase 2: Execution and Introspection
| ID | Task | Size | Depends | Spec Ref |
| --- | --- | --- | --- | --- |
| KTC-003 | Add tool-call transport helper (build MCP `tools/call`, parse JSON args, map failures to stable exit codes) | M | KTC-002 | FR-1, FR-2, FR-7, FR-8 |
| KTC-004 | Implement `knot tool <command> --help` introspection path with dynamic `tools/list` lookup and fallback metadata | M | KTC-003 | FR-5, FR-6 |
| KTC-005 | Add tests for unknown tool, invalid payload JSON, and daemon-unreachable diagnostics | S | KTC-003 | FR-7, FR-8 |

### Phase 3: Regression and Docs
| ID | Task | Size | Depends | Spec Ref |
| --- | --- | --- | --- | --- |
| KTC-006 | Wire `tool` mode into `handle_launcher_command` and verify no behavior regressions for existing launcher modes | S | KTC-004 | FR-9 |
| KTC-007 | Update operator docs (`docs/testing/linux-appimage-packaging.md`) with `knot tool` usage and script examples | S | KTC-006 | FR-3, FR-4, FR-7 |

## Dependency DAG
`KTC-001 -> KTC-002 -> KTC-003 -> KTC-004 -> KTC-006 -> KTC-007`  
`KTC-003 -> KTC-005`

## Concern Coverage
| Concern | Tasks | Verification |
| --- | --- | --- |
| REL | KTC-003, KTC-004, KTC-005, KTC-006 | CLI/transport tests, failure-mode assertions |
| CONF | KTC-002, KTC-004, KTC-007 | Help/introspection output tests, docs checks |
| COMP | KTC-001, KTC-006 | Regression tests for prior launcher command behavior |

## Verification Commands
- `cargo test --manifest-path src-tauri/Cargo.toml launcher::tests -- --nocapture`
- `cargo test --manifest-path src-tauri/Cargo.toml knotd_client::tests -- --nocapture`
- `cargo check --manifest-path src-tauri/Cargo.toml`
