# Note Metadata Front Matter

Change-Type: design-update
Trace: DESIGN-note-metadata-frontmatter-011

## Metadata
- ID: `COMP-NOTE-METADATA-FRONTMATTER-011`
- Scope: `component`
- Status: `implemented`
- Concerns: `[CONF, REL, COMP]`
- Created: `2026-03-01`
- Updated: `2026-03-01`

## Purpose
Add standard YAML front matter note metadata with a dedicated Meta editor mode so managed metadata can be edited safely without exposing raw front matter in the body-focused edit and view experiences.

## Contract

### Functional Requirements
**FM-001**: Notes shall support YAML front matter at the top of the markdown document using standard `---` fenced front matter conventions.

**FM-002**: The application shall expose managed metadata fields for `description`, `author`, `email`, `tags`, and `version`.

**FM-003**: The application shall preserve unknown front matter keys when loading and saving notes, unless the user explicitly removes them from the extra YAML field.

**FM-004**: The editor toolbar shall expose a `Meta` mode to the left of `Source`, and Meta mode shall render a form for the managed metadata plus a free-form extra YAML field for custom mappings.

**FM-005**: Meta mode shall validate the extra YAML field as YAML mapping content only and block persistence while invalid.

**FM-006**: Edit and View modes shall operate on the markdown body only and shall not render front matter as note content.

### Behavior
**Given** a note with YAML front matter and markdown body
**When** the note opens in Edit or View mode
**Then** only the markdown body is shown as note content.

**Given** a note with existing unknown front matter keys
**When** the user edits managed metadata and saves
**Then** the unknown keys remain in the serialized front matter.

**Given** the user enters invalid YAML in the extra metadata field
**When** they attempt to save from Meta mode
**Then** the editor shows a validation error and does not persist the note.

## Design Decisions
| Decision | Rationale | Trade-off |
|----------|-----------|-----------|
| Use YAML front matter as the canonical metadata format | Matches common markdown conventions and user request | Requires explicit body/front matter splitting in the editor |
| Keep Source mode raw and make Edit/View body-only | Preserves a power-user raw mode while keeping WYSIWYM modes clean | Mode behavior becomes intentionally asymmetric |
| Represent extra metadata as raw YAML mappings | Safest way to preserve and edit unknown metadata keys | Invalid YAML must be handled explicitly in UI |

## Concern Mapping
| Concern | Requirement | Implementation Strategy |
|---------|-------------|-------------------------|
| CONF | FM-002, FM-004 | Dedicated Meta form with explicit managed fields |
| REL | FM-003, FM-005, FM-006 | Lossless merge rules for unknown keys and validation before save |
| COMP | FM-001, FM-006 | Standard YAML front matter persisted in raw source markdown |

## Acceptance Criteria
- [ ] Front matter parsing/serialization preserves unknown metadata keys and leaves body markdown intact.
- [ ] Meta mode appears before Source and shows managed fields plus extra YAML.
- [ ] Invalid extra YAML blocks save with visible validation feedback.
- [ ] Edit/View modes omit front matter and operate only on the markdown body.

## Verification Strategy
- Unit tests for front matter split/merge/validation.
- Editor component tests for Meta mode, save behavior, and body-only Edit/View rendering.
- `npm run typecheck`
- `npm run -s qa:docsync -- --against=HEAD`
