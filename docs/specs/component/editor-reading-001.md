# Editor Reading Experience Refresh

## Metadata
- ID: `COMP-EDITOR-READING-001`
- Scope: `component`
- Status: `implemented`
- Concerns: `[CONF, CAP, REL]`
- Created: `2026-02-20`
- Updated: `2026-02-20`

## Purpose
Improve long-form readability and visual hierarchy by modernizing chrome contrast, introducing switchable editor surfaces, and enforcing predictable text-measure bands.

## Contract

### Functional Requirements
**FR-1**: App chrome and service panels use a dark modern palette with sufficient contrast for controls, labels, and active states.

**FR-2**: Editor surface is switchable between `sepia` and `dark` modes from the main toolbar.

**FR-3**: Editor surface selection persists across sessions.

**FR-4**: Editor measure is assigned deterministically from available content width using bands `45ch`, `54ch`, `62ch`, `70ch`.

**FR-5**: Measured text width must apply to content width (not reduced by inner padding), so `Nch` maps to readable line length as expected.

**FR-6**: Switching selected note remounts editor instance to avoid stale/blank editor content regressions.

### Behavior
**Given** a vault is open and user is in note editor mode  
**When** user toggles `Editor: Sepia` / `Editor: Dark`  
**Then** editor surface tokens switch and remain active after reload.

**Given** content width changes (resizing, panel collapse/expand)  
**When** width crosses configured thresholds  
**Then** `content-area--measure-*` class updates and editor line measure updates accordingly.

**Given** user selects a different note path  
**When** editor view remains active  
**Then** editor remounts for the new note path.

## Design Decisions
| Decision | Rationale | Trade-off |
| --- | --- | --- |
| Use dark chrome + warm accents | Reduce glare and improve depth hierarchy | Requires careful contrast tuning per state |
| Keep editor surfaces independent of shell chrome | Supports mixed reading preferences in same shell | More theme tokens to maintain |
| Compute measure band in app logic (`getEditorMeasureBand`) | Deterministic and testable across runtimes | Additional app-level state/class wiring |
| Add padding-aware width math in editor paper | Ensures `ch` intent maps to actual text measure | Slightly more CSS complexity |

## Traceability Map
| Requirement | Implementation |
| --- | --- |
| FR-1 | `src/styles/global.css`, `src/styles/App.css`, `src/components/Shell/ToolRail.css`, `src/components/Shell/ContextPanel.css`, `src/components/Shell/InspectorRail.css`, `src/components/Sidebar/Sidebar.css`, `src/components/SearchBox/SearchBox.css` |
| FR-2 | `src/App.tsx`, `src/styles/App.css`, `src/components/Editor/Editor.css` |
| FR-3 | `src/App.tsx` (`knot:editor-surface-mode`) |
| FR-4 | `src/lib/editorMeasure.ts`, `src/App.tsx` (`content-area--measure-*`) |
| FR-5 | `src/components/Editor/Editor.css` (`--editor-measure`, padding-adjusted `max-width`) |
| FR-6 | `src/App.tsx` (`<Editor key={currentNote?.path ...} />`) |

## Acceptance Criteria
- [x] Editor mode toggle is visible and switches between sepia/dark.
- [x] Editor mode persists after reload.
- [x] Width band mapping is unit-tested.
- [x] Existing app tests pass with new editor mode behavior.
- [x] Regression test exists for editor remount on note-path change.
- [x] Manual visual verification confirms 65-character probe line fits expected bands in wide layouts.

## Verification Strategy
- Automated: `src/App.test.tsx` (editor mode toggle + band mapping + remount regression).
- Automated: `npm run -s typecheck`.
- Manual: screenshot-based visual checks for contrast and reading width.
