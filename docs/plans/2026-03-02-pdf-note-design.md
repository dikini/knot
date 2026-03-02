# PDF Note Design

## Context
- Local data point: `test-vault/canonical/knot/set-theoretic-types-2022.pdf`
- Format: PDF 1.5, 61 pages, A4, unencrypted
- Product requirement: render PDFs inside Knot, but do not offer source or edit modes

## Decision
Implement a dedicated `pdf` note type plugin and render it with `react-pdf` / `pdfjs-dist`.

## Why This Path
- The note-type plugin model already exists and cleanly handles view-only binary note types.
- PDF.js is the standard web rendering engine and behaves predictably inside a Tauri webview.
- `react-pdf` is the lightest reasonable integration for the current React editor shell.
- Native webview PDF embedding would be more fragile and less portable.

## UX
- PDF notes open in `view` mode.
- Toolbar disables `meta`, `source`, and `edit` in v1.
- Viewer shows:
  - page number / page count
  - previous / next page
  - zoom in / zoom out
  - fit-to-width reset

## Future Extensions
- surface document metadata in a dedicated PDF metadata view
- searchable text layer
- continuous scrolling and thumbnails
- outline / bookmarks
