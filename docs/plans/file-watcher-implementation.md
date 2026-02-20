# Implementation Plan: File System Watcher Completion

## Metadata
- Spec: `docs/specs/component/file-watcher-001.md`
- Generated: `2026-02-19`
- Updated: `2026-02-19`
- Approach: `sequential`

## Summary
- Total tasks: 5
- Size: 2 Small, 3 Medium
- Objective: close compliance gaps for an already-implemented watcher system

## Tasks

| ID | Task | Size | Depends | Spec Ref |
|----|------|------|---------|----------|
| FW-001 | Refresh spec scope and acceptance criteria | S | - | FR-1..FR-7 |
| FW-002 | Fix integration tests to target current `knot` APIs | M | FW-001 | FR-2, FR-3, FR-4, FR-5, FR-6 |
| FW-003 | Add missing watcher SPEC markers in legacy/public vault API | S | FW-001 | FR-1, FR-2, FR-3, FR-4, FR-5, FR-6, FR-7 |
| FW-004 | Validate watcher behavior with focused Rust test runs | M | FW-002, FW-003 | FR-1..FR-7 |
| FW-005 | Publish updated verification report and state updates | M | FW-004 | FR-1..FR-7 |

## Dependency DAG

`FW-001 -> FW-002 -> FW-004 -> FW-005`

`FW-001 -> FW-003 -> FW-004`

## Verification Commands

```bash
cd src-tauri
cargo test --test watcher_integration_test
cargo test watcher::tests::watcher_detects_new_file
cargo test watcher::tests::watcher_detects_modified_file
cargo test watcher::tests::watcher_detects_deleted_file
cargo test watcher::tests::watcher_debounces_rapid_changes
```
