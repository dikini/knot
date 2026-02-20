# Lightweight Traceability Policy

## Metadata
- ID: `COMP-TRACE-LITE-001`
- Scope: `component`
- Status: `implemented`
- Concerns: `[COMP, REL]`
- Created: `2026-02-20`
- Updated: `2026-02-20`

## Purpose
Provide a lightweight way to distinguish design updates from bug fixes and keep each change traceable without adding heavyweight process overhead.

## Contract

### Functional Requirements
**FR-1**: Plan files touched in a change must declare a `Change-Type` header with one of: `design-update`, `bug-fix`, `hybrid`.

**FR-2**: Staged changes must include at least one trace ID token: `DESIGN-<slug>` or `BUG-<slug>`.

**FR-3**: Plan files touched in a change must include at least one trace ID token.

**FR-4**: A pre-commit hook must enforce FR-1..FR-3 against staged content and block commits on violations.

### Design Decisions
| Decision | Rationale | Trade-off |
| --- | --- | --- |
| Enforce only two key signals (`Change-Type`, trace ID) | Keeps adoption friction low | Less strict than full matrix enforcement |
| Validate staged content only | Targets actual pending commit | Does not retroactively fix old files |
| Use native git hook path (`.githooks`) | No new dependency/hook framework | Requires one-time local hook path setup |

## Acceptance Criteria
- [x] Validator reports an error when staged additions have no trace ID.
- [x] Validator reports an error when touched plan files miss `Change-Type`.
- [x] Validator passes when trace ID and `Change-Type` are present.
- [x] `.githooks/pre-commit` runs validator for each commit attempt.

## Verification Strategy
- Unit tests for validator decision logic.
- Manual execution on staged state via `npm run -s traceability:check-staged`.
- Audit report in `docs/audit/traceability-lite-verification-2026-02-20.md`.
