# Icon-First Common Chrome

## Metadata
- ID: `COMP-ICON-CHROME-001`
- Scope: `component`
- Status: `implemented`
- Concerns: `[CONF, REL, CAP]`
- Created: `2026-02-20`
- Updated: `2026-02-20`

## Purpose
Convert common shell/editor/graph chrome from text-heavy controls to icon-first controls with short noun tooltips, while preserving accessibility and adding a user preference to show labels.

## Contract

### Functional Requirements
**FR-1**: Left tool rail uses icons with short noun tooltips and accessible names.

**FR-2**: Editor and graph toolbars use icon-first controls with short noun tooltips.

**FR-3**: A user preference controls `icon-only` vs `icon + text labels` rendering for common controls.

**FR-4**: Label preference persists per vault shell state.

**FR-5**: Icon controls remain keyboard accessible (`aria-label`, focusable, button semantics).

## Design Decisions
| Decision | Rationale | Trade-off |
| --- | --- | --- |
| Use `lucide-react` | Consistent icon style and coverage | Adds dependency |
| Shared `IconButton` primitive | Consistent tooltip/label behavior | Small abstraction layer |
| Default `icon-only` | Matches compact tool-first UX goal | Discoverability depends on tooltip quality |
| Keep short noun tooltips | Fast scanning and low noise | Less explanatory than verb labels |

## Acceptance Criteria
- [x] Tool rail buttons are icon-first and show short noun tooltip labels.
- [x] Common editor/graph controls are icon-first.
- [x] Label preference toggle exists and updates UI.
- [x] Preference persists and hydrates via shell state storage.
- [x] Existing interaction tests remain passing with updated control semantics.

## Verification Strategy
- Component tests for tool rail and graph/editor controls.
- App-level tests for shell preference persistence.
- Typecheck/lint/test verification.
