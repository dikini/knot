# Debian Packaging Scaffold 027 Plan

Change-Type: design-update
Trace: DESIGN-debian-packaging-scaffold-027
Spec: `docs/specs/component/debian-packaging-scaffold-027.md`
Generated: `2026-03-05`

## Metadata
- Approach: `sequential`

## Tasks
| ID | Task | Size | Depends | Spec Ref |
|----|------|------|---------|----------|
| DPS-001 | Add failing tests for binary and source packaging scripts | M | - | FR-1, FR-3, FR-4, FR-5 |
| DPS-002 | Add Debian packaging template scaffolding (`packaging/debian`) for knot + knotd | S | DPS-001 | FR-3 |
| DPS-003 | Implement binary `.deb` generation script | M | DPS-002 | FR-1, FR-2, FR-5 |
| DPS-004 | Implement Debian source package generation script | M | DPS-003 | FR-4, FR-5 |
| DPS-005 | Verify outputs and write audit report | S | DPS-004 | AC-1, AC-2, AC-3 |
