# Implementation Plan: Content Loading from Filesystem

## Metadata

- Spec: `docs/specs/component/content-loading-001.md`
- Generated: 2026-02-19
- Approach: sequential

## Summary

- Total tasks: 4
- Size: 1 small, 2 medium, 1 large
- Critical path: All tasks (sequential)

## Note: Implementation Already Exists

The bug fix is already implemented in `src-tauri/src/db.rs:191-232`. However, the workflow artifacts are missing:

- No SPEC markers in code
- No formal tests via bk-tdd
- No verification report via bk-verify

This plan focuses on adding required workflow artifacts.

## Tasks

### Phase 1: Test Development (bk-tdd)

| ID     | Task                                                | Size | Depends | Spec Ref |
| ------ | --------------------------------------------------- | ---- | ------- | -------- |
| CL-001 | Write test: load content from filesystem            | M    | -       | FR-1     |
| CL-002 | Write test: missing file returns NoteNotFound       | S    | -       | FR-2     |
| CL-003 | Write test: IO errors handled gracefully            | M    | -       | FR-3     |
| CL-004 | Write test: content hash and word count consistency | S    | -       | FR-4     |

### Phase 2: Code Markers (bk-implement-rust)

| ID     | Task                                           | Size | Depends                        | Spec Ref               |
| ------ | ---------------------------------------------- | ---- | ------------------------------ | ---------------------- |
| CL-005 | Add SPEC markers to `db.rs:get_note_by_path()` | M    | CL-001, CL-002, CL-003, CL-004 | FR-1, FR-2, FR-3, FR-4 |

### Phase 3: Verification (bk-verify)

| ID     | Task                                        | Size | Depends | Spec Ref |
| ------ | ------------------------------------------- | ---- | ------- | -------- |
| CL-006 | Run bk-verify to generate compliance report | L    | CL-005  | All FRs  |

## Dependency DAG

```
CL-001 →
CL-002 → CL-005 → CL-006
CL-003 →
CL-004 →
```

## Concern Coverage

| Concern | Tasks                  | Verification                                                |
| ------- | ---------------------- | ----------------------------------------------------------- |
| REL     | CL-001, CL-003, CL-004 | Tests: test_loads_content, test_io_errors, test_consistency |
| SEC     | CL-002                 | Test: test_missing_file_error                               |

## Task Details

### CL-001: Write test: load content from filesystem

**Spec Ref:** FR-1
**Acceptance:** Test passes - content loaded from file matches expected content
**Implementation:**

- Create test file with known content
- Call `get_note_by_path()` with vault root
- Assert returned Note.content matches file content

### CL-002: Write test: missing file returns NoteNotFound

**Spec Ref:** FR-2
**Acceptance:** Test passes - NoteNotFound error when file missing
**Implementation:**

- Create note metadata in database
- Delete actual file from filesystem
- Call `get_note_by_path()`
- Assert returns `Err(KnotError::NoteNotFound)`

### CL-003: Write test: IO errors handled gracefully

**Spec Ref:** FR-3
**Acceptance:** Test passes - IO error maps to KnotError::Io with message
**Implementation:**

- Create file with restricted permissions or simulate IO error
- Call `get_note_by_path()`
- Assert returns `Err(KnotError::Io)` with descriptive message

### CL-004: Write test: content hash and word count consistency

**Spec Ref:** FR-4
**Acceptance:** Test passes - hash and word count consistent with loaded content
**Implementation:**

- Load note via `get_note_by_path()`
- Verify content hash matches loaded content
- Verify word count matches loaded content

### CL-005: Add SPEC markers to db.rs:get_note_by_path()

**Spec Ref:** FR-1, FR-2, FR-3, FR-4
**Acceptance:** SPEC markers present at function level, linking to all FRs
**Implementation:**

```rust
/// Load note content from filesystem
/// SPEC: COMP-CONTENT-LOAD-001 FR-1, FR-2, FR-3, FR-4
pub fn get_note_by_path(&self, path: &str, vault_root: &Path) -> Result<Option<crate::note::Note>> {
    // ... existing implementation ...
}
```

### CL-006: Run bk-verify to generate compliance report

**Spec Ref:** All FRs
**Acceptance:** Verification report in `docs/audit/content-loading-verification-2026-02-19.md`
**Implementation:**

- Run `bk-verify --scope=component/database`
- Review compliance matrix
- Ensure all acceptance criteria pass
- Generate verification report

## Test Coverage Plan

| Functional Requirement | Test ID | Test Function                                  |
| ---------------------- | ------- | ---------------------------------------------- |
| FR-1: Load content     | CL-001  | `test_loads_content_from_filesystem`           |
| FR-2: Missing file     | CL-002  | `test_missing_file_returns_not_found`          |
| FR-3: IO errors        | CL-003  | `test_io_errors_handled_gracefully`            |
| FR-4: Consistency      | CL-004  | `test_content_hash_and_word_count_consistency` |

## Success Criteria

- [ ] All tests pass (CL-001 through CL-004)
- [ ] SPEC markers added to implementation code
- [ ] bk-verify reports >90% compliance
- [ ] Verification report generated in `docs/audit/`
- [ ] No regression in existing tests

## Next Steps

- **bk-tdd**: Execute tasks CL-001 through CL-004
- **bk-implement-rust**: Execute task CL-005
- **bk-verify**: Execute task CL-006
