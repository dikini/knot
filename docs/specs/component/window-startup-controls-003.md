# Window Startup Visibility Reliability

## Metadata
- ID: `COMP-WINDOW-STARTUP-003`
- Scope: `component`
- Status: `implemented`
- Parent: `COMP-UI-LAYOUT-002`
- Concerns: `[CONF, REL]`
- Created: `2026-02-21`
- Updated: `2026-02-21`

## Purpose
Prevent startup white-flash regressions while ensuring the app cannot remain permanently hidden if frontend initialization signaling fails.

## Contract

### Functional Requirements
**FR-1**: Main window must start hidden and become visible when frontend signals readiness (`frontend://ready`).

**FR-2**: Startup flow must include a backend fallback show timeout so the app cannot remain invisible if the ready event fails.

**FR-3**: App must not add custom in-content window controls; native OS window controls remain the source of truth.

**FR-4**: Frontend ready signaling must no-op safely in browser/non-Tauri contexts.

**FR-5**: Existing content mode toggle behavior (`editor <-> graph`) must remain unchanged.

### Behavior
**Given** app launches on desktop
**When** frontend emits `frontend://ready`
**Then** backend shows the hidden main window.

**Given** frontend does not emit ready event in time
**When** fallback timeout elapses
**Then** backend still shows main window.

**Given** non-Tauri runtime
**When** frontend ready helper is called
**Then** it returns without throwing.

## Design Decisions
| Decision | Rationale | Trade-off |
| --- | --- | --- |
| Event-driven startup visibility + timeout fallback | Eliminates white flash and avoids permanent hidden window failure mode | Adds one startup signal and timeout path |
| Keep native window controls only (no custom controls) | Avoids duplicate controls and keeps OS ownership of minimize/fullscreen/close affordances | Cannot compensate in-app for platform-specific native-control quirks |
| Utility wrapper for startup ready emit | Keeps runtime detection and startup signaling testable | One extra abstraction layer |

## Acceptance Criteria
- [x] Window starts hidden and becomes visible via ready event.
- [x] Window becomes visible via fallback timeout when ready event is missed.
- [x] No custom in-content window control buttons are added.
- [x] Non-Tauri runtime does not throw for startup helper calls.
- [x] Existing mode-toggle tests remain passing.

## Verification Strategy
- Rust compile check for startup visibility setup.
- Frontend unit tests for startup helper module.
- App tests confirm existing mode toggle behavior remains intact.

## Related
- Used by: `src-tauri/src/main.rs`, `src-tauri/tauri.conf.json`, `src/main.tsx`, `src/lib/windowControls.ts`
