# Implementation Plan: UI Automation Runtime for MCP-Controlled App Inspection

Change-Type: design-update
Trace: DESIGN-ui-automation-runtime-013
Spec: `docs/specs/component/ui-automation-runtime-013.md`
Generated: `2026-03-02`

## Summary
- Total tasks: 7
- Approach: sequential
- Size: 3 small, 4 medium
- Scope: add registry-backed UI automation runtime, MCP tools, screenshot capture, and first-party core registrations

## Tasks

| ID | Task | Size | Depends | Spec Ref |
| --- | --- | --- | --- | --- |
| UAR-001 | Add spec-map and roadmap entries for the new UI automation runtime component | S | - | FR-1, FR-3 |
| UAR-002 | Define registry types, capability metadata, and dispatcher interfaces for actions/views | M | UAR-001 | FR-1, FR-2, FR-9, FR-10 |
| UAR-003 | Add MCP UI automation tools and typed error mapping | M | UAR-002 | FR-3, FR-7, FR-8, FR-9 |
| UAR-004 | Implement runtime-backed screenshot capture returning artifact metadata | M | UAR-002 | FR-4, FR-5 |
| UAR-005 | Register first-party core navigation targets/actions through the registry | M | UAR-002, UAR-003 | FR-2, FR-6, FR-10 |
| UAR-006 | Add TDD coverage for registry behavior, MCP tool calls, and screenshot flow | S | UAR-003, UAR-004, UAR-005 | FR-1..FR-9 |
| UAR-007 | Verify implementation, update audit, and mark spec/roadmap status | S | UAR-006 | FR-1..FR-10 |

## Dependency DAG
`UAR-001 -> UAR-002 -> UAR-003 -> UAR-005 -> UAR-006 -> UAR-007`

`UAR-002 -> UAR-004 -> UAR-006`

## Concern Coverage
| Concern | Tasks | Verification |
| --- | --- | --- |
| REL | UAR-002, UAR-003, UAR-004, UAR-006 | Typed error tests and deterministic registry/runtime coverage |
| CONF | UAR-003, UAR-004, UAR-005, UAR-006 | Semantic action coverage and deferred low-level input guardrails |
| COMP | UAR-002, UAR-005 | Core/plugin metadata contract and migration-friendly dispatcher wiring |
| CAP | UAR-003, UAR-004 | Compact tool payloads and bounded artifact metadata |

## Verification Commands
```bash
cargo test --manifest-path src-tauri/Cargo.toml --lib mcp::tests
cargo test --manifest-path src-tauri/Cargo.toml --lib
cargo check --manifest-path src-tauri/Cargo.toml
npm run typecheck
```

## Exit Criteria
- Registry-backed UI automation tools are discoverable and callable through MCP.
- At least one core navigation flow and one screenshot flow operate through the new path.
- Deferred click/keyboard scope is preserved in public contract and tests.
