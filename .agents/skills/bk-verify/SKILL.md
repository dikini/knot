---
name: bk-verify
description: Audit implementation against specifications. Use for pre-commit checks, PR reviews, release readiness, and compliance verification.
triggers:
  - "verify implementation"
  - "audit spec compliance"
  - "check against spec"
  - "compliance check"
  - "pre-commit check"
---

# bk-verify: Verification & Compliance Audit

## Purpose
Automatically verify that implementation matches specifications via traceability markers.

## When to Use
- Before release (`--scope=full`)
- During development (`--scope=component`)
- PR review
- After completing tasks

## Inputs
```yaml
scope: enum                 # Required: file | module | crate | component | full
spec_path: path             # Optional: Verify specific spec only
output_format: enum         # Optional: summary | detailed (default: summary)
incremental: bool           # Optional: Only verify changed files (default: false)
since: string               # Optional: Git ref for incremental (e.g., HEAD~5)
```

## Workflow

### 0.5. Validate Marker IDs (Critical - Catch Hallucinations)

Before building compliance matrix, validate all marker IDs are real:

**Load valid IDs**:
```bash
# From docs/specs/concern-registry.yaml
concerns=$(yq '.concerns | keys[]' docs/specs/concern-registry.yaml)

# From spec files (extract SPEC-XXX-NNN patterns)
specs=$(grep -rh "^\s*-\s*ID:\s*SPEC-" docs/specs/ | sed 's/.*SPEC-/SPEC-/')

# From task files
specs=$(grep -rh "^\s*id:\s*TS-" docs/plans/ | sed 's/.*TS-/TS-/')
```

**Scan and validate markers in scope**:
```bash
for file in $(find $scope -name "*.rs"); do
  markers=$(grep -oP '(SPEC|CONCERN|TASK)-[A-Z0-9_-]+' "$file")
  for marker in $markers; do
    if ! in_valid_list "$marker"; then
      if is_placeholder "$marker"; then
        echo "⚠️  Placeholder: $marker in $file"
      else
        echo "❌ HALLUCINATION: $marker in $file (not found in docs/)"
        # Suggest similar valid IDs
        suggest_similar "$marker"
      fi
    fi
  done
done
```

**Hallucination handling**:
- **Error**: Unknown marker that looks like real ID (e.g., `SPEC-CACHE-999` when only `SPEC-CACHE-001` exists)
- **Warning**: Known placeholder (`SPEC-PENDING`, `SPEC-TBD`, etc.)
- **Block verification**: If hallucinations found, stop and require fix

**Example output**:
```
[Validating markers]
  Scanning: src/cache/mod.rs
    ✅ SPEC-CACHE-001 (valid)
    ✅ TASK-TS-003 (valid)
  Scanning: src/scheduler.rs
    ❌ HALLUCINATION: SPEC-SCHEDULER-999 (not found)
      Did you mean: SPEC-SCHEDULER-001?
    ⚠️  Placeholder: SPEC-PENDING (allowed but should resolve)

Result: 1 hallucination found. Fix before proceeding.
```

### 1. Discovery

Scan scope for:
- **Specs**: `docs/specs/**/*.md` files
- **Markers**: `// SPEC-*`, `// CONCERN-*`, `// TASK-*` in code (already validated)
- **Tests**: `#[test]` functions with markers

### 2. Build Compliance Matrix

| Spec | Requirement | Implementation | Tests | Status |
|------|-------------|----------------|-------|--------|
| COMP-CACHE-001 | FR-1: Cache trait | `src/cache/mod.rs:45` | `test_cache_trait` | ✅ Full |
| COMP-CACHE-001 | FR-2: TTL | `src/cache/ttl.rs:23` | `test_ttl_eviction` | ✅ Full |
| COMP-CACHE-001 | REL-001 | `src/cache/retry.rs:12` | - | ⚠️ Untested |
| COMP-CACHE-001 | SEC-001 | - | - | ❌ Missing |

### 3. Gap Detection

| Status | Icon | Definition |
|--------|------|------------|
| Full | ✅ | Spec requirement implemented and tested |
| Partial | ⚠️ | Implemented but gaps (e.g., untested) |
| Untested | 🔍 | Implemented but no test coverage |
| Missing | ❌ | Not implemented |
| Orphan | 📝 | Code marker but no spec requirement |

**Severity** (added):
- **Critical**: Security, reliability gaps
- **Warning**: Untested code, missing docs
- **Info**: Missing tests for edge cases

### 4. Report

Generate report in requested format:
- **Summary** (default): Console output with compliance stats and critical gaps
- **Detailed**: Full compliance matrix saved to `docs/audit/<scope>-verification-<date>.md`
- **JSON**: Machine-readable for CI/CD integration

See [references/output-formats.md](references/output-formats.md) for format details and examples.

### 5. Incremental Mode

Verify only changed files:
```bash
bk-verify --scope=crate --incremental --since=HEAD~5

# Checks only:
# - Files modified in last 5 commits
# - Specs those files relate to
# - Tests for those specs

Result: Faster feedback during development
```

## Heuristic Fallback

If no markers found, attempt heuristic matching:
```
Spec requirement: "Cache::get method"
↓
Search code for: "fn get", "trait Cache"
↓
If found: Report as "Possibly implemented (no marker)"
↓
Recommend: Add markers for tracking
```

## Output

1. Console (summary or detailed)
2. `docs/audit/<scope>-verification-<date>.md` - Detailed report
3. JSON (if `--output=json`): `<scope>-verification.json`

## Example

### Normal Flow (Passing)

```bash
bk-verify --scope=component/cache

[Validating markers]
  Scanning: src/cache/mod.rs
    ✅ SPEC-CACHE-001 (valid)
    ✅ TASK-TS-003 (valid)
  Scanning: src/cache/ttl.rs
    ✅ SPEC-FR-2.2 (valid)
  Result: All markers valid

[Discovering]
  Specs: 1 (COMP-CACHE-001)
  Requirements: 12
  Code markers: 45
  Test markers: 18

[Building compliance matrix]
  ✅ FR-1: Cache trait definition (src/cache/mod.rs:12)
  ✅ FR-2: TTL support (src/cache/ttl.rs:34)
  ⚠️ FR-3: Memory limits (src/cache/backend.rs:56) [No test]
  ❌ SEC-001: Auth boundary (Not found)

[Gap analysis]
  Critical (1): SEC-001 missing
  Warning (1): FR-3 untested
  Info (0): None

Compliance: 83% (10/12)
Recommendation: Address SEC-001 before release

Report: docs/audit/cache-verification-2026-02-18.md
```

### Hallucination Detected (Blocking)

```bash
bk-verify --scope=component/scheduler

[Validating markers]
  Scanning: src/scheduler.rs
    ✅ SPEC-SCHEDULER-001 (valid)
    ❌ HALLUCINATION: SPEC-SCHEDULER-999 in src/scheduler.rs:45
      Found: // SPEC-SCHEDULER-999: Priority queue
      Not found in docs/specs/
      Did you mean: SPEC-SCHEDULER-001?
    ⚠️  Placeholder: SPEC-PENDING in src/scheduler.rs:67

Result: 1 hallucination found. Verification BLOCKED.

Fix required:
  1. Check correct spec ID in docs/specs/
  2. Replace SPEC-SCHEDULER-999 with real ID
  3. Or use placeholder: SPEC-PENDING, SPEC-TBD
  4. Re-run bk-verify

[Verification aborted]
```

## Integration with Implementation

### With bk-implement-rust

`bk-implement-rust` runs marker validation at Step 4.5. `bk-verify` runs it again at Step 0.5:

- **Implementation time**: Catches hallucinations immediately (fast feedback)
- **Verification time**: Re-validates in case markers added/changed since implementation

**Both should pass** before shipping.

## CI Integration

```yaml
# .github/workflows/verify.yml
- name: Verify Spec Compliance
  run: |
    bk-verify --scope=full --output=json --incremental --since=main
    # Fails if:
    # - Hallucinated markers found (critical)
    # - Critical gaps found (security, reliability)
```

## Future Enhancements

This skill provides **sufficient** traceability with hallucination detection. Future enhancements (not required):

- AST-based parsing for more accurate marker extraction
- Confidence scoring instead of binary pass/fail
- Historical trend tracking
- Test quality verification (beyond marker presence)

## Next Steps

- **Address gaps**: Create tasks for missing work
- **bk-implement-rust**: Implement missing requirements
- **bk-ship**: If verification passes
