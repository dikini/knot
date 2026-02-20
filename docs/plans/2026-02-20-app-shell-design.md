# App Shell Design: Quiet Editorial + shadcn Foundation

## Metadata
- Date: 2026-02-20
- Status: approved
- Theme: Quiet editorial
- Objective: Optimize for long writing and long reading sessions

## Goals
- Prioritize content comfort and sustained focus.
- Keep navigation and tools accessible without persistent visual noise.
- Use shadcn/ui as structural primitives, with a custom Knot visual system.

## Layout Model
- **Primary structure**: Tool rail + contextual panel + content surface.
- **Optional**: Right inspector rail, hidden by default.
- **Collapsibility**:
  - Vertical tool rail: collapsible (expanded labels or icon-only).
  - Contextual left panel: collapsible.
  - Right rail: closed by default, open on demand.

## Tool Rail
- Vertical rail hosts top-level selectors:
  - Notes
  - Search
  - Graph
  - Extensible slots for future tools
- Keyboard switching:
  - Cmd/Ctrl+1: Notes
  - Cmd/Ctrl+2: Search
  - Cmd/Ctrl+3: Graph

## Contextual Panel Behavior
- **Notes mode**:
  - Directory explorer tree view
  - Expand/collapse folders
  - Keyboard-first traversal and selection
- **Search mode**:
  - Query input
  - Result list
  - Lightweight filters/sort controls
- **Graph mode**:
  - Split panel
  - Top: controls/filters/reset
  - Bottom: selected node context (neighbors/backlinks)

## Density and Reading Comfort
- **Default density**: Comfortable
- **Optional**: Adaptive density toggle in settings
- Content area preserves comfortable typography/line length regardless of utility density.

## Typography and Visual Direction
- **Tone**: Quiet editorial (warm, paper-like, low-chrome)
- **Typography strategy**:
  - Content: serif-first reading typography
  - UI chrome: clean sans-serif
- **Contrast strategy**:
  - Chrome is subdued
  - Content has stronger contrast for readability

## Motion and Interaction
- Minimal, purposeful transitions only:
  - Sidebar collapse/expand
  - Mode transitions
  - Right-rail reveal
- Avoid decorative motion in content surface.

## shadcn Integration Rules
- Use shadcn primitives for structure and accessibility:
  - Button, Tooltip, Separator, ScrollArea, Collapsible, Sheet/Drawer
- Override default tokens with Knot tokens:
  - Color scale
  - Typography scale
  - Spacing rhythm
  - Radius/shadow
- Avoid default dashboard styling; preserve distinct Knot identity.

## State Persistence
Persist per-vault shell preferences:
- Active tool mode
- Rail/panel collapsed states
- Contextual panel width
- Right rail visibility
- Density mode

## Accessibility and Ergonomics
- Full keyboard navigation through rail/panel/content.
- Consistent focus outlines and tab order.
- Large enough hit targets in comfortable mode.
- Stable layout behavior to reduce cognitive load during long sessions.

## Success Criteria
- Users can stay in a low-noise shell for extended reading/writing.
- Navigation/context tools remain one interaction away.
- Layout adapts without stealing content focus.
- Design system remains coherent while using shadcn primitives.

## Next Step
- Create detailed implementation plan (component map, state model, rollout steps, test plan).
