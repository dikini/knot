# Knotd Dev Lifecycle Plan
Change-Type: design-update

## Metadata
- Plan ID: `PLAN-KNOTD-DEV-LIFECYCLE-011`
- Spec: `docs/specs/component/knotd-dev-lifecycle-011.md`
- Trace: `DESIGN-knotd-dev-lifecycle`
- Created: `2026-02-27`
- Updated: `2026-02-27`
- Updated: `2026-03-03`
- Approach: `sequential`

## Summary
- Total tasks: `6`
- Size: `3 small, 3 medium, 0 large`
- Critical path: `KDL-001 -> KDL-002 -> KDL-003 -> KDL-004 -> KDL-005 -> KDL-006`

## Tasks

### Phase 1: Test Harness
| ID | Task | Size | Depends | Spec Ref |
| --- | --- | --- | --- | --- |
| KDL-001 | Add targeted bridge reconnect unit tests for backoff, wait mode, and `SIGHUP` wakeup | M | - | FR-6, FR-7, FR-8, FR-9 |

### Phase 2: Bridge Recovery
| ID | Task | Size | Depends | Spec Ref |
| --- | --- | --- | --- | --- |
| KDL-002 | Refactor `scripts/knotd-mcp-bridge.mjs` to keep stdin/socket forwarding alive across reconnect loops and signal-driven wakeup | M | KDL-001 | FR-6, FR-7, FR-8 |

### Phase 3: Dev Lifecycle Scripts
| ID | Task | Size | Depends | Spec Ref |
| --- | --- | --- | --- | --- |
| KDL-003 | Add aggressive repo-managed `scripts/dev-up.sh` and `scripts/dev-down.sh` with runtime dir, pid/log files, socket cleanup, and bridge `SIGHUP` signaling | M | KDL-002 | FR-1, FR-2, FR-3, FR-4, FR-5 |

### Phase 4: Verification and Documentation
| ID | Task | Size | Depends | Spec Ref |
| --- | --- | --- | --- | --- |
| KDL-004 | Wire npm shortcuts, document the workflow, and produce verification artifacts | S | KDL-003 | AC-1, AC-2, AC-3, AC-4, AC-5 |

### Phase 5: Local CI Daemon Smoke
| ID | Task | Size | Depends | Spec Ref |
| --- | --- | --- | --- | --- |
| KDL-005 | Add targeted orchestration tests for `ci:local` daemon smoke defaults, provisioning, skip messaging, and teardown behavior | M | KDL-004 | FR-10, FR-11, FR-12, FR-13, FR-14 |
| KDL-006 | Refactor `scripts/run-ci-local.sh` and supporting helpers to self-provision required daemon smoke with deterministic cleanup and aligned socket defaults | M | KDL-005 | FR-10, FR-11, FR-12, FR-13, FR-14, AC-6, AC-7 |

## Dependency DAG

```text
KDL-001 -> KDL-002 -> KDL-003 -> KDL-004 -> KDL-005 -> KDL-006
```

## Concern Coverage
| Concern | Tasks | Verification |
| --- | --- | --- |
| REL | KDL-001, KDL-002, KDL-003, KDL-005, KDL-006 | Bridge reconnect tests, lifecycle smoke checks, required daemon triage bootstrap |
| CONF | KDL-003, KDL-004, KDL-005, KDL-006 | Deterministic runtime dir, aligned socket defaults, explicit skip semantics |
| CAP | KDL-002, KDL-006 | Bounded backoff and bounded local CI lifecycle orchestration |
