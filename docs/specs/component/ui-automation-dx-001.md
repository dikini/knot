# UI Automation DX for Knot (Playwright + Tauri)

## Metadata
- ID: `COMP-UI-AUTOMATION-DX-001`
- Scope: `component`
- Status: `implemented`
- Parent: `COMP-FRONTEND-001`, `COMP-TOOLCHAIN-001`
- Concerns: `[REL, CAP, COMP, CONF]`
- Created: `2026-02-22`
- Updated: `2026-02-22`

## Purpose
Define a practical UI verification strategy that enables fast Playwright-driven design/behavior checks while preserving Tauri-native confidence checks for Linux/WebKitGTK and other platform-specific runtime paths.

## Contract

### Functional Requirements
**FR-1**: The project MUST provide a browser-first Playwright lane that runs quickly against Vite and supports deterministic frontend behavior checks through a Tauri IPC mock bridge.

**FR-2**: The browser-first lane MUST be usable by local developers and MCP-based verification workflows without requiring a running native Tauri shell.

**FR-3**: The project MUST provide a Tauri-native smoke lane focused on shell/runtime integration risks (startup, bridge availability, and basic app-surface availability).

**FR-4**: The Tauri-native smoke lane MUST be intentionally narrow and operationally lightweight, avoiding duplication of broad browser-lane behavior coverage.

**FR-5**: The protocol-attach approach against embedded WebKitGTK devtools/inspector MUST be documented as future R&D and not required for current delivery.

**FR-6**: All lanes MUST have explicit usage documentation and command entrypoints so contributors can run the intended verification flow consistently.

### Approach Matrix
| Approach | Scope | Current Status | Notes |
| --- | --- | --- | --- |
| `A1` Browser-first Playwright + Tauri bridge mock | Primary design/behavior validation | Implement now | Fast feedback, MCP-friendly |
| `A2` Tauri-native smoke lane | Runtime/shell confidence checks | Implement now | Narrow smoke focus, low duplication |
| `A3` Embedded protocol attach (WebKitGTK inspector path) | Direct automation against native embedded webview protocol | Future R&D | Deferred to unidentified future stage |

### Behavior
**Given** a contributor wants rapid UI verification
**When** they run the browser-first lane
**Then** they can validate main user flows and visual behavior without native runtime coupling.

**Given** a contributor wants confidence in native shell/runtime wiring
**When** they run the native smoke lane
**Then** they can verify startup/runtime invariants with a focused smoke sequence.

**Given** protocol-level WebKitGTK attach is discussed
**When** planning current work
**Then** it remains explicitly out-of-scope and tracked as future R&D only.

## Design Decisions
| Decision | Rationale | Trade-off |
| --- | --- | --- |
| Make browser-first lane the primary UI gate | Maximizes speed and reliability for frequent iteration | Not a full native-shell proxy |
| Keep native lane smoke-only | Preserves signal on shell/runtime issues with low maintenance | Reduced breadth vs full E2E |
| Defer WebKitGTK protocol attach | High uncertainty and higher maintenance burden today | Direct embedded automation postponed |

## Acceptance Criteria
- [x] Browser-first Playwright lane is configured with deterministic Tauri IPC mocking.
- [x] At least one browser-lane flow verifies startup and core surface behavior.
- [x] Tauri-native smoke lane command and checklist are present and runnable.
- [x] Future R&D note for protocol-attach path is documented with explicit out-of-scope statement.
- [x] Documentation references both implemented lanes and intended usage.

## Verification Strategy
- Execute browser-lane Playwright tests.
- Execute native smoke lane command (or dry-run check path).
- Run frontend quality gates (`typecheck`, `lint`) after test-infra changes.

## Related
- Depends on: `COMP-TOOLCHAIN-001`
- Used by: UI verification workflow, MCP-assisted QA, release smoke checks
