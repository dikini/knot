# PDF Note Type

## Metadata
- ID: `COMP-PDF-NOTE-TYPE-016`
- Scope: `component`
- Status: `draft`
- Parent: `COMP-NOTE-TYPES-012`, `COMP-EDITOR-MODES-001`
- Concerns: `[REL, CONF, COMP, CAP]`
- Created: `2026-03-02`
- Updated: `2026-03-02`

## Purpose
Add a dedicated `pdf` note type that renders vault PDF files inside Knot with a native note surface while explicitly disabling unsupported authoring modes.

## Contract

### Functional Requirements
**FR-1**: The backend MUST recognize `.pdf` files as a dedicated `pdf` note type through the note-type plugin registry.

**FR-2**: PDF notes MUST be view-only in v1. `source` and `edit` modes MUST be disabled.

**FR-3**: The frontend MUST render PDF notes inside the editor surface using a PDF viewer rather than treating them as unknown files.

**FR-4**: PDF notes MUST expose deterministic pagination and zoom controls suitable for long documents.

**FR-5**: Explorer rows for PDF notes MUST render a `PDF` badge and behave as known note types.

**FR-6**: Existing markdown, YouTube, image, and unknown note behavior MUST remain unchanged.

**FR-7**: The current vault fixture `knot/set-theoretic-types-2022.pdf` MUST render successfully as a real PDF note data point.

**FR-8**: The design MUST leave room for future PDF metadata extensions without requiring a renderer rewrite.

## Design Decisions
| Decision | Rationale | Trade-off |
| --- | --- | --- |
| Use a dedicated `pdf` note type instead of fallback unknown-file rendering | Keeps PDF behavior explicit, testable, and extensible | Adds one more specialized note type |
| Use `react-pdf` on top of `pdfjs-dist` | Most practical React/Tauri integration path over Mozilla PDF.js | Adds frontend dependencies and worker setup |
| Keep PDF notes view-only in v1 | Matches current product scope and avoids fake editing affordances | Metadata editing is deferred |
| Render one page at a time with zoom + page navigation | Predictable performance for long PDFs like the 61-page fixture | Less browseable than full continuous-scroll viewer |

## Concern Mapping
| Concern | Requirement | Implementation Strategy |
| --- | --- | --- |
| REL | FR-1, FR-4, FR-6, FR-7 | Typed note-type resolution, stable viewer controls, and regression tests against existing note types |
| CONF | FR-2, FR-3, FR-4 | View-only mode availability and a dedicated PDF viewer surface inside the existing editor shell |
| COMP | FR-1, FR-5, FR-6, FR-8 | Registry-based plugin integration and shared note payload/media plumbing |
| CAP | FR-3, FR-4, FR-7 | PDF.js-backed rendering with fit-to-width and bounded page rendering rather than full-document DOM inflation |

## Acceptance Criteria
- [ ] `.pdf` files resolve to `pdf` note type with view-only mode availability.
- [ ] Explorer rows display a `PDF` badge for known PDF files.
- [ ] PDF notes render with visible page output and basic pagination/zoom controls.
- [ ] `source` and `edit` mode controls are disabled for PDF notes.
- [ ] The current `set-theoretic-types-2022.pdf` fixture renders as a PDF note.
- [ ] Existing markdown, YouTube, image, and unknown note tests continue to pass.

## Verification Strategy
- Rust tests for `.pdf` note-type resolution and known-file discovery.
- Frontend tests for disabled modes and PDF viewer rendering.
- `npm run typecheck`, targeted Vitest suites, and `cargo test` / `cargo check`.
