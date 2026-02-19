# bk-verify Output Formats

Reference for understanding verification reports.

## Summary Format (Default)

```
Verification Summary: <scope>
====================================
Specs: <count> | Requirements: <count>

Compliance:
  ✅ Full: <count> (<percentage>%)
  ⚠️ Untested: <count> (<percentage>%)
  ❌ Missing: <count> (<percentage>%)
  🔍 Orphan: <count> (<percentage>%)

Critical Gaps (<count>):
  1. ❌ SPEC-<ID>: <description>
  2. ⚠️ SPEC-<ID>: <description>

Recommendation: <action>
```

### Status Icons

| Icon | Status | Meaning |
|------|--------|---------|
| ✅ | Full | Requirement implemented and tested |
| ⚠️ | Partial/Untested | Implemented but gaps (e.g., no tests) |
| 🔍 | Untested | Implemented but no test coverage |
| ❌ | Missing | Not implemented |
| 📝 | Orphan | Code marker exists but no spec requirement |

### Severity Levels

| Severity | Indicates | Examples |
|----------|-----------|----------|
| **Critical** | Security, reliability gaps | Missing auth, unbounded operations |
| **Warning** | Quality issues | Untested code, missing docs |
| **Info** | Minor gaps | Missing edge case tests |

## Detailed Format

Full compliance matrix saved to: `docs/audit/<scope>-verification-<date>.md`

```markdown
# Verification Report: <Scope>

**Date**: <date>
**Scope**: <scope>

## Compliance Matrix

### <SPEC-ID>: <Spec Name>

#### <Requirement ID>: <Requirement Description>
- **Status**: ✅ Full | ⚠️ Partial | ❌ Missing
- **Spec**: <path>:<line>
- **Implementation**:
  - `<file>:<line>` - <description>
- **Tests**:
  - `<test-name>` ✅
  - `<test-name>` ✅
- **Gap**: <if partial/missing, describe gap>
- **Action**: <recommended fix>

## Gap Analysis

### Critical (<count>)
1. <SPEC-ID> - <description>
   - **Missing**: <what's not implemented>
   - **Action**: <specific task>

### Warning (<count>)
1. <SPEC-ID> - <description>
   - **Issue**: <what's wrong>
   - **Action**: <specific task>

### Info (<count>)
1. <SPEC-ID> - <description>
   - **Note**: <minor issue>
   - **Action**: <optional improvement>

## Recommendations

<Overall assessment>

- **Block release**: <if critical gaps>
- **Fix before release**: <if warnings>
- **Optional**: <if info only>
```

## JSON Format

For CI/CD integration, use `--output=json`:

```json
{
  "scope": "component/cache",
  "timestamp": "2026-02-18T10:30:00Z",
  "specs_checked": 1,
  "requirements_total": 12,
  "compliance": {
    "full": 10,
    "untested": 1,
    "missing": 1,
    "orphan": 0
  },
  "compliance_percentage": 83,
  "gaps": [
    {
      "spec_id": "COMP-CACHE-001",
      "requirement_id": "SEC-001",
      "severity": "critical",
      "status": "missing",
      "description": "Auth boundary not implemented",
      "action": "Add auth check before cache access"
    },
    {
      "spec_id": "COMP-CACHE-001",
      "requirement_id": "FR-3",
      "severity": "warning",
      "status": "untested",
      "description": "Memory limits untested",
      "implementation": "src/cache/backend.rs:56",
      "action": "Add test_memory_limit_enforcement"
    }
  ],
  "recommendation": "Address 1 critical gap before release"
}
```

## Incremental Output

When using `--incremental --since=<commit>`:

```
Incremental Verification (since HEAD~5)
========================================
Files changed: 3
  - src/cache/backend.rs
  - src/cache/ttl.rs
  - tests/cache_tests.rs

Related specs: 1 (COMP-CACHE-001)
Requirements checked: 5 (subset)

Changes:
  ✅ FR-2 (TTL support): Still compliant
  ⚠️ FR-3 (Memory limits): New implementation, no test
  ✅ Tests updated

New gaps: 1 warning
Recommendation: Add test for FR-3
```

## Console Color Codes

When output to terminal (not shown in this reference):
- ✅ Green
- ⚠️ Yellow
- ❌ Red
- 🔍 Cyan
- 📝 Gray

When piped or in CI, colors are automatically stripped.
