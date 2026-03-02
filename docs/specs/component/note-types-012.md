# Note Type Plugins and Non-Markdown Vault Content

## Metadata
- ID: `COMP-NOTE-TYPES-012`
- Scope: `component`
- Status: `verified`
- Parent: `COMP-NOTE-001`, `COMP-EXPLORER-TREE-001`, `COMP-EDITOR-MODES-001`, `COMP-SETTINGS-PANE-001`
- Concerns: `[CONF, REL, COMP, CAP]`
- Created: `2026-03-02`
- Updated: `2026-03-02`

## Purpose
Extend Knot's note model beyond markdown by introducing plugin-backed note types, starting with images, while preserving the existing markdown authoring flow and creating a stable path for future file-backed note types.

## Contract

### Functional Requirements
**FR-1**: The backend MUST expose a note-type registry that resolves vault files to a note type by extension, with markdown as a built-in note type and plugin-backed note types layered on top.

**FR-2**: The explorer tree MUST support a vault setting for file visibility policy with these values:
- `all_files`
- `known_only`

**FR-3**: The default file visibility policy MUST be `all_files`, and under that policy the explorer MUST show every non-dotted file in the vault.

**FR-4**: Files with unknown note types MUST render dimmed in the explorer and MUST open a read-only fallback surface in the main pane that states the file type is unknown.

**FR-5**: Explorer note rows for all non-markdown note types MUST render a right-aligned mnemonic badge of up to four uppercase letters derived from the resolved file type, for example `PNG`, `JPEG`, `GIF`, `WEBM`.

**FR-6**: Image note type support MUST be implemented through the note-type plugin path rather than special-cased markdown logic.

**FR-7**: The image note type MUST recognize common image formats at minimum: `png`, `jpg`, `jpeg`, `gif`, `webp`, `bmp`, `svg`, `tif`, `tiff`.

**FR-8**: When an image file is selected, the note pane MUST render the image in read-only view mode, scaled to fit the available content width while preserving aspect ratio.

**FR-9**: For image note types, `source` and `edit` modes MUST be visibly inactive/disabled, and metadata mode MUST remain available with an empty metadata surface for this revision.

**FR-10**: Non-markdown note types MUST carry structured metadata in the backend/frontend note contract, even when the metadata payload is empty for this revision.

**FR-11**: Existing markdown note behavior, editor mode behavior, and markdown note serialization MUST remain unchanged.

### Behavior
**Given** a vault contains `photo.png`  
**When** the explorer visibility policy is `all_files`  
**Then** the file appears in the explorer with a `PNG` badge and opens as a read-only image note.

**Given** a vault contains `archive.bin`  
**When** the explorer visibility policy is `all_files`  
**Then** the file appears dimmed in the explorer and opens an unknown-file fallback surface.

**Given** a vault contains `archive.bin`  
**When** the explorer visibility policy is `known_only`  
**Then** the file does not appear in the explorer.

**Given** an image note is open  
**When** the user inspects the mode controls  
**Then** view mode is active, source and edit are inactive, and no rich-text editor is mounted for that note.

## Design Decisions
| Decision | Rationale | Trade-off |
| --- | --- | --- |
| Introduce a note-type registry inside the backend instead of full WASM-rendered UI plugins | Matches the current architecture and creates a stable extension seam quickly | Does not yet allow arbitrary plugin-defined frontend UI |
| Keep markdown as a built-in registered note type | Preserves existing note flows while aligning them to the new abstraction | Some dual-path migration work is needed in the backend |
| Represent unknown files explicitly instead of hiding them by default | Keeps the vault filesystem legible and makes failures understandable | Explorer becomes slightly noisier until users switch to `known_only` |
| Badge only non-markdown note rows | Preserves the current lightweight markdown explorer appearance | Mixed explorer rows become visually heterogeneous |
| Keep image notes read-only for v1 | Delivers immediate value without inventing an image editor | Users cannot modify image content or metadata in-app yet |

## Concern Mapping
| Concern | Requirement | Implementation Strategy |
| --- | --- | --- |
| CONF | FR-2, FR-3, FR-4, FR-5, FR-8, FR-9 | Deterministic visibility policy, dimmed unknown-file fallback, and explicit mode gating keep behavior predictable |
| REL | FR-1, FR-6, FR-10, FR-11 | Central registry and typed note payloads avoid scattered file-type checks and preserve markdown behavior |
| COMP | FR-1, FR-6, FR-11 | Markdown remains backward compatible while the registry allows future note types without breaking existing contracts |
| CAP | FR-3, FR-8 | Filter at backend tree construction and render images with bounded container-fit styling rather than expensive transforms |

## Acceptance Criteria
- [x] Backend note contracts distinguish note type, mode availability, and typed metadata.
- [x] Explorer visibility policy persists through vault settings and defaults to `all_files`.
- [x] Explorer tree includes non-dotted unknown files under `all_files` and excludes them under `known_only`.
- [x] Unknown files render dimmed in the explorer and open a read-only fallback panel.
- [x] Image files appear as image notes with mnemonic badges and render scaled in the note pane.
- [x] Image notes do not activate source/edit authoring surfaces.
- [x] Markdown notes continue to behave exactly as before.

## Verification Strategy
- Rust unit/integration tests for note-type resolution, explorer visibility filtering, and typed note payload loading.
- Frontend component tests for explorer badges/dim styling and editor mode gating for image/unknown notes.
- Targeted app tests for end-to-end note selection behavior across markdown, image, and unknown files.
- `npm run typecheck` and targeted Vitest suites; Rust tests for vault and note command paths.

## Related
- Depends on: `COMP-EXPLORER-TREE-001`, `COMP-EDITOR-MODES-001`, `COMP-SETTINGS-PANE-001`
- Used by: vault note discovery, note loading commands, explorer tree rendering, editor shell
