# YouTube Note Type

## Metadata
- ID: `COMP-YOUTUBE-NOTE-TYPE-015`
- Scope: `component`
- Status: `draft`
- Parent: `COMP-NOTE-TYPES-012`, `COMP-EDITOR-MODES-001`, `COMP-AUTHORING-FLOWS-001`
- Concerns: `[REL, CONF, COMP, CAP]`
- Created: `2026-03-02`
- Updated: `2026-03-02`

## Purpose
Add a markdown-capable YouTube note type that imports a YouTube video into a note using the video transcript as editable body content while rendering video-specific chrome in view and edit modes.

## Contract

### Functional Requirements
**FR-1**: The backend MUST recognize files ending in `.youtube.md` as a dedicated `youtube` note type.

**FR-2**: A YouTube note MUST remain markdown-capable and expose `meta`, `source`, `edit`, and `view` modes.

**FR-3**: The app MUST support creating a YouTube note from a YouTube URL through a dedicated sidebar action.

**FR-4**: The app MUST support creating a YouTube note by dragging an external YouTube URL onto the explorer root, a folder row, or a note row.

**FR-5**: YouTube note creation MUST not download the video locally.

**FR-6**: Created YouTube notes MUST store the video URL, video ID, embed URL, thumbnail URL, title, description, transcript language, and transcript source in frontmatter metadata.

**FR-7**: The main markdown body of a created YouTube note MUST contain the transcript text and remain fully editable.

**FR-8**: View mode for a YouTube note MUST render an embedded YouTube player above the markdown body.

**FR-9**: Edit mode for a YouTube note MUST render a thumbnail header card instead of a live player.

**FR-10**: Explorer rows for YouTube notes MUST render a `YT` badge and behave as known note types.

**FR-11**: If a usable transcript cannot be obtained, YouTube note creation MUST fail with a clear typed error instead of creating a partial note.

**FR-12**: Existing markdown, image, and unknown note behavior MUST remain unchanged.

## Design Decisions
| Decision | Rationale | Trade-off |
| --- | --- | --- |
| Use `.youtube.md` suffix rather than content-only detection | Keeps note-type resolution cheap and explorer-safe | File names are slightly more specialized |
| Store YouTube metadata in frontmatter and transcript in markdown body | Reuses existing note/editor/search model | Imported notes are larger than simple link notes |
| Fetch watch-page metadata/captions directly with HTTP | Avoids API keys and external CLIs | More fragile than official APIs |
| Fail when no transcript exists | Matches the product requirement that transcript populates the main body | Some videos cannot be imported |

## Concern Mapping
| Concern | Requirement | Implementation Strategy |
| --- | --- | --- |
| REL | FR-3, FR-4, FR-6, FR-11, FR-12 | Central import path with typed errors, deterministic suffix-based note typing, and regression coverage around existing note types |
| CONF | FR-2, FR-8, FR-9, FR-10 | Explicit mode availability and mode-specific rendering rules keep behavior predictable |
| COMP | FR-1, FR-6, FR-12 | Extend the note-type registry and note payload without breaking markdown/image contracts |
| CAP | FR-5, FR-7 | Import only metadata/transcript and keep transcript as plain markdown text rather than rich embedded editing data |

## Acceptance Criteria
- [ ] `.youtube.md` files resolve to `youtube` note type with full authoring modes.
- [ ] Sidebar action creates a YouTube note from a pasted URL.
- [ ] External YouTube URL drop creates a YouTube note in the resolved explorer destination.
- [ ] Created notes contain expected frontmatter metadata and transcript markdown body.
- [ ] View mode shows an embedded player above the note body.
- [ ] Edit mode shows a thumbnail card instead of the embedded player.
- [ ] Transcript-unavailable imports fail without creating a note.
- [ ] Existing markdown/image note tests continue to pass.

## Verification Strategy
- Rust unit tests for URL parsing, suffix resolution, transcript parsing, and note content generation.
- Frontend tests for sidebar action/drag-drop creation flows and editor rendering.
- `npm run typecheck`, targeted Vitest suites, `cargo check`, and Rust unit tests.
