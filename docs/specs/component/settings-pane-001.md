# Settings Pane and Manual Vault Reindex

## Metadata
- ID: `COMP-SETTINGS-PANE-001`
- Scope: `component`
- Status: `draft`
- Concerns: `[CONF, REL, CAP]`
- Created: `2026-02-23`
- Updated: `2026-03-01`

## Purpose
Provide an explicit settings surface with section navigation and a manual full vault reindex action so users can recover from out-of-sync vault state without restarting or using hidden commands.

## Contract

### Functional Requirements
**FR-1**: The right-side rail must expose a settings affordance pinned at the very bottom of its icon stack.

**FR-2**: Activating the settings affordance must open the right inspector rail in `settings` mode.

**FR-3**: The settings view must include section navigation and switchable section content within the same panel.

**FR-4**: The settings view must include a `Reindex vault` action that triggers a full vault filesystem-to-metadata reindex procedure.

**FR-5**: Reindex completion must surface user feedback for both success and failure states.

**FR-6**: Existing configurable frontend settings must be grouped and exposed in thematic sections:
- Appearance: editor surface mode, icon/text label preference.
- Layout: shell density mode, context panel width.
- Maintenance: reindex action and operational status.

**FR-7**: Existing backend vault configuration fields must be exposed in a `Vault` section:
- Vault identity and plugin toggle.
- Sync settings (`enabled`, `peers`).
- Editor settings (`font_size`, `tab_size`).

**FR-8**: Settings updates that map to persisted configuration must update the authoritative storage path already used by that setting (frontend localStorage or backend vault config).

**FR-9**: The Layout settings section must expose an app-level graph readability floor control persisted through the existing TOML-backed app config path.
- Default value: `70`.
- The value represents the minimum initial/reset zoom percentage for graph auto-fit.
- Changing the value must persist immediately through the current app-level TOML settings policy.

### Behavior
**Given** a vault is open  
**When** user opens settings and clicks `Reindex vault`  
**Then** the app runs a full reindex and reports result without requiring app restart.

**Given** user switches settings sections  
**When** a section item is selected  
**Then** only that section content is shown and navigation state remains in the panel.

## Design Decisions
| Decision | Rationale | Trade-off |
| --- | --- | --- |
| Reuse right inspector rail for settings host | Avoids introducing another global panel and fits current shell model | Inspector rail becomes multi-mode instead of simple static details |
| Settings section list inside rail body | Scales with additional settings while keeping chrome stable | Reduced horizontal space for section content |
| Expose both frontend and vault config in one pane | Matches user expectation for one settings destination | Requires frontend + backend command wiring |
| Add explicit manual full reindex action | Supports recovery when watcher/open-path sync misses metadata updates | Potentially heavier operation on large vaults |
| Reuse existing app-config TOML policy for graph readability floor | Avoids introducing a second app-level settings mechanism | Some layout settings remain split across localStorage and TOML |

## Concern Mapping
| Concern | Requirement | Implementation Strategy |
| --- | --- | --- |
| CONF | FR-1, FR-2, FR-3, FR-6, FR-7 | Deterministic panel mode + sectioned IA with clear labels |
| REL | FR-4, FR-5, FR-8 | Idempotent reindex command and explicit success/error handling |
| CAP | FR-4, FR-6 | Keep reindex explicit/manual; avoid continuous heavy scans |

## Acceptance Criteria
- [ ] Right-side bottom settings icon exists and opens settings mode.
- [ ] Settings pane supports section navigation with visible active section.
- [ ] Reindex action calls backend full reindex and reports result via toast/state.
- [ ] Appearance/layout settings are visible and editable.
- [ ] Vault config settings are visible and editable.
- [ ] Persisted settings survive reload/open for both frontend and vault config-backed fields.
- [ ] Layout settings expose graph readability floor and persist it through app-config TOML with default `70`.

## Verification Strategy
- Unit tests for inspector/settings mode interactions.
- App tests for section switching and reindex trigger behavior.
- API wrapper tests for new settings and reindex commands.
- Typecheck + lint + targeted Storybook checks for updated UI components.
