# Storybook App Stability 022

## Metadata

- ID: `COMP-STORYBOOK-STABILITY-022`
- Scope: `component`
- Status: `implemented`
- Parent: `COMP-STORYBOOK-DX-001`, `COMP-UI-QA-DX-001`, `COMP-UI-AUTOMATION-RUNTIME-013`
- Concerns: `[REL, COMP, CONF]`
- Trace: `DESIGN-storybook-app-stability-022`
- Created: `2026-03-03`
- Updated: `2026-03-03`

## Purpose

Bring the Storybook/App verification lane back to a clean stable state by removing Tauri runtime leakage from browser stories, making the `App` listener setup resilient to unavailable runtime hooks, and keeping the coverage inventory aligned with the actual story surface.

## Functional Requirements

- FR-1: `App` MUST handle failure to register the UI automation Tauri listener without surfacing unhandled runtime rejections during browser or Storybook execution.
- FR-2: Storybook App stories MUST provide safe defaults for mount-time Tauri API and event dependencies used by `App`.
- FR-3: Storybook preview setup MUST provide a browser-safe Tauri core shim so unmocked command paths fail soft instead of crashing the Storybook renderer.
- FR-4: The Storybook coverage inventory audit MUST match the current set of story exports enforced by `qa:storybook-matrix`.
- FR-5: Verification artifacts for this workstream MUST record the red and green validation commands for the Storybook Vitest lane and the coverage matrix gate.

## Behavior

**Given** Storybook renders `App` in a browser runtime without Tauri event internals  
**When** the UI automation listener cannot register  
**Then** `App` logs the registration failure and continues rendering without an unhandled rejection.

**Given** Storybook App stories mount the shell  
**When** `App` loads keymap settings, UI automation settings, registry sync, or state sync effects  
**Then** the stories use explicit mocked responses instead of hitting real Tauri internals.

**Given** the repository runs `npm run -s qa:storybook-matrix`  
**When** the current story files are scanned  
**Then** the committed inventory document reports the same story export count and export names.

## Design Decisions

| Decision                                                                                    | Rationale                                                                          | Trade-off                                                                         |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Catch listener-registration failures in `App` instead of disabling the effect outside Tauri | Preserves the real automation path in unit tests and native runtime                | Browser lanes still need explicit mock defaults                                   |
| Add a preview-level Tauri core shim                                                         | Prevents browser-only Storybook environments from crashing on missed command mocks | Can hide accidental missing mocks unless story-level expectations remain explicit |
| Keep App story mocks local to `App.stories.tsx`                                             | Makes the mount-time contract obvious where it is needed                           | Some duplication remains if more shell stories are added elsewhere                |
| Refresh the inventory doc rather than weakening the validator                               | Keeps `qa:storybook-matrix` as a useful drift detector                             | Inventory still requires manual maintenance until generated                       |

## Concern Mapping

| Concern | Requirement            | Implementation Strategy                                                            |
| ------- | ---------------------- | ---------------------------------------------------------------------------------- |
| REL     | FR-1, FR-2, FR-4, FR-5 | Resilient listener setup, deterministic story mocks, and green matrix verification |
| COMP    | FR-2, FR-4             | Storybook runtime contract and inventory remain aligned with the codebase          |
| CONF    | FR-3, FR-5             | Preview shim and explicit verification artifact keep browser workflow reproducible |

## Acceptance Criteria

- [ ] `src/App.test.tsx` includes a regression test covering failed UI automation listener registration.
- [ ] Storybook App stories no longer produce unhandled Tauri `listen` or `invoke` errors during `storybook:test:vitest`.
- [ ] `.storybook/preview.ts` provides a browser-safe Tauri core shim for Storybook execution.
- [ ] `docs/audit/storybook-design-coverage-inventory-2026-02-22.md` reports the current story export total and names so `qa:storybook-matrix` passes.
- [ ] A verification report records both the failing baseline commands and the passing verification commands.

## Verification Strategy

- `npm run test -- --run src/App.test.tsx`
- `npm run -s storybook:test:vitest`
- `npm run -s qa:storybook-matrix`
- `npm run typecheck`

## Related

- Depends on: `COMP-STORYBOOK-DX-001`, `COMP-UI-QA-DX-001`, `COMP-UI-AUTOMATION-RUNTIME-013`
- Used by: Storybook browser verification, App shell stories, local UI quality workflow
