# Note Metadata Fidelity

## Metadata
- ID: `COMP-NOTE-METADATA-001`
- Scope: `component`
- Status: `implemented`
- Parent: `docs/specs/extracted/note-001.md`
- Concerns: `[REL, CONF]`
- Created: `2026-02-22`
- Updated: `2026-02-22`

## Purpose
Eliminate placeholder note metadata in note payloads so `get_note` and `create_note` return accurate backlink titles and heading positions.

## Contract

### Functional Requirements
**FR-1**: Backlink titles in `NoteData.backlinks[].source_title` MUST be resolved from source note metadata/title, not echoed from `source_path`.

**FR-2**: Heading positions in `NoteData.headings[].position` MUST represent the zero-based byte offset of the heading line start within note content.

**FR-3**: `get_note` and `create_note` MUST use the same heading-position computation behavior for consistency.

**FR-4**: If source note title resolution fails for a backlink, the fallback title MUST be derived from source path filename stem.

### Behavior
**Given** a note with backlinks from `projects/alpha.md` titled `# Alpha`
**When** `get_note` is called for the target note
**Then** backlink `source_title` equals `Alpha`.

**Given** content `# Top\n\nText\n## Child`
**When** headings are returned in `NoteData`
**Then** heading positions map to the heading line starts in the original content.

## Design Decisions
| Decision | Rationale | Trade-off |
|----------|-----------|-----------|
| Resolve backlink titles through vault note lookup | Reuses existing title extraction and stays consistent with note summaries | Additional lookups per backlink |
| Compute heading offsets from raw content scan | Deterministic and independent from markdown parser internals | Must keep scan logic aligned with heading extraction order |
| Fallback to filename stem on lookup failure | Prevents empty/technical path labels in UI | Fallback may not match user-intended title |

## Concern Mapping
| Concern | Requirement | Implementation Strategy |
|---------|-------------|------------------------|
| REL | FR-1, FR-2, FR-3 | Deterministic metadata generation with unit tests |
| CONF | FR-1, FR-4 | User-facing labels match note titles with readable fallback |

## Acceptance Criteria
- [ ] `get_note` returns backlink `source_title` from source note title when available.
- [ ] `get_note` returns backlink `source_title` filename-stem fallback when source note cannot be loaded.
- [ ] `get_note` heading positions are non-placeholder and match byte offsets in content.
- [ ] `create_note` heading positions match the same offset calculation used by `get_note`.
- [ ] Rust unit tests cover backlink title resolution and heading offset computation edge cases.

## Verification Strategy
- Add Rust unit tests in `src-tauri/src/commands/notes.rs` for heading offset and title fallback helpers.
- Run targeted Rust tests for notes command module.

## Related
- Depends on: [`COMP-NOTE-001`]
- Used by: frontend note rendering and backlinks panel
