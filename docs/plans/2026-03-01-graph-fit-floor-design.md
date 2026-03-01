# Design: Graph Fit Floor, Non-Overlapping Pills, and Scrollable Overflow
Change-Type: design-update
Trace: DESIGN-graph-fit-floor

## Status
- Date: `2026-03-01`
- Scope: `GraphView`, graph layout, settings/config
- State: `approved`

## Problem
The current graph behavior still compromises readability in dense layouts:
- pill nodes can overlap or be packed too tightly
- the graph is implicitly forced into the visible panel
- fit behavior is undefined because there is no canonical `100%` visual scale
- when the graph cannot fit cleanly, users lose structure instead of gaining clear overflow cues

## Decision
Adopt a hybrid fit-with-floor model.

- Define a canonical graph scale where `100%` means fixed graph label typography and pill padding.
- Perform node spacing and collision behavior against that canonical scale.
- Prefer fitting the graph into the viewport, but never below a readability floor.
- Initial readability floor default: `70%`.
- If the graph cannot fit above that floor, keep the readable zoom and allow the graph surface to overflow.
- Show scrollbars on the graph viewport when overflow exists.
- Make the readability floor configurable through app settings and persisted in TOML config.

## Interaction Model
- `100%` is a stable graph scale, not a best-effort panel fit.
- Initial zoom is computed from graph bounds and viewport size.
- If computed fit zoom is `>= readability_floor`, open fitted.
- If computed fit zoom is `< readability_floor`, open at `readability_floor` and expose overflow.
- Reset returns to the computed initial framing for the current graph and viewport, not a hardcoded zoom.

## Layout Model
- Pill geometry is based on canonical text metrics and padding.
- Collision detection must prioritize non-overlap over forced fit.
- Layout is allowed to produce bounds larger than the visible graph panel.
- Edge endpoints continue to terminate on the nearest pill boundary.

## Viewport Model
- GraphView becomes a scrollable viewport over a larger graph surface.
- Scrollbars are intentional visual cues that graph content extends beyond the panel.
- Pan and zoom remain available, but viewport overflow is no longer hidden.

## Configuration
- Add a graph readability floor setting with default `70%`.
- Persist the value in settings TOML.
- Expose the setting in the app settings UI.
- The value affects initial fit framing only; it does not change canonical node typography.

## Testing
- Frontend tests:
  - initial fit respects readability floor
  - overflow viewport exposes scrollable graph surface when needed
  - reset returns to computed initial framing
  - dense layouts do not render overlapping pill targets in controlled fixtures
- Backend/layout tests:
  - graph bounds can exceed the visible viewport when collision-safe spacing requires it
  - layout maintains non-overlapping canonical pill spacing for dense fixtures

## Trade-offs
- Large graphs may open partially out of view more often.
- Scrollbars add visible chrome, but they communicate graph extent honestly.
- Collision-aware spacing may require larger graph surfaces and more movement than the current bounded layout.
