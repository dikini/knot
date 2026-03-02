# Verification Report: Note Type Plugins and Image Notes

## Metadata
- Spec: `docs/specs/component/note-types-012.md`
- Plan: `docs/plans/note-types-012-plan.md`
- Date: `2026-03-02`
- Scope: `COMP-NOTE-TYPES-012`
- Result: `verified`

## Summary
- Compliance: `100% (11/11 functional requirements)`
- Outcome: image note support is implemented through the note-type registry, explorer visibility is configurable, unknown files are handled explicitly, and daemon-mode startup now rehydrates vault-scoped asset access correctly.

## Requirement Coverage
| Requirement | Status | Evidence |
| --- | --- | --- |
| FR-1 | verified | Backend registry in `src-tauri/src/note_type.rs`; typed note payload propagation in `src-tauri/src/commands/notes.rs`, `src-tauri/src/state.rs`, `src-tauri/src/mcp.rs` |
| FR-2 | verified | `file_visibility` setting added in `src-tauri/src/config.rs`, surfaced in `src/components/Settings/SettingsPane.tsx`, typed in `src/lib/api.ts` |
| FR-3 | verified | Visible file scanning and filtering in `src-tauri/src/core/vault.rs`; default config is `all_files` |
| FR-4 | verified | Unknown note fallback in `src/components/Editor/index.tsx`; dimmed explorer styling in `src/components/Sidebar/index.tsx` and `src/components/Sidebar/Sidebar.css` |
| FR-5 | verified | Non-markdown badges emitted from backend and rendered in sidebar components/tests |
| FR-6 | verified | Image support implemented through `ImageNoteTypePlugin` in `src-tauri/src/note_type.rs` |
| FR-7 | verified | Image extension coverage in `src-tauri/src/note_type.rs` |
| FR-8 | verified | Read-only image rendering path in `src/components/Editor/index.tsx`; validated manually and by editor tests |
| FR-9 | verified | Mode gating and forced `view` mode for image notes in `src/components/Editor/index.tsx` and `src/components/Editor/index.test.tsx` |
| FR-10 | verified | Structured metadata/media fields in `src/types/vault.ts` and `src-tauri/src/state.rs` |
| FR-11 | verified | Markdown behavior retained in backend/frontend flow; targeted tests remained green |

## Verification Evidence
### Frontend
```bash
npx vitest run src/components/Sidebar/index.test.tsx src/components/Editor/index.test.tsx src/lib/api.test.ts src/App.test.tsx
npm run typecheck
```

Result:
- `4` test files passed
- `120` tests passed
- TypeScript typecheck passed

Notes:
- Existing warning-only output remains in `src/App.test.tsx` (`act(...)` warnings) and some editor test stderr, but there were no test failures.

### Backend
```bash
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml mcp::tests::tools_call_get_note_returns_image_payload_for_non_markdown_files -- --nocapture
cargo test --manifest-path src-tauri/Cargo.toml rename_note_moves_image_without_utf8_error -- --nocapture
cargo test --manifest-path src-tauri/Cargo.toml list_notes_includes_non_markdown_files_as_synthetic_notes -- --nocapture
cargo test --manifest-path src-tauri/Cargo.toml app_state_tracks_current_asset_scope_path -- --nocapture
```

Result:
- Cargo check passed
- All targeted Rust tests passed

## Bugs Resolved During Verification
- Explorer badge hidden by long filenames: fixed in sidebar flex layout/styling.
- Daemon explorer payload missing typed fields: fixed in `src-tauri/src/mcp.rs`.
- Renaming/moving binary notes caused UTF-8 read errors: fixed in `src-tauri/src/core/vault.rs`.
- Image notes could restore stale `meta` mode: fixed in `src/components/Editor/index.tsx`.
- Daemon-backed image selection failed because `get_note` was markdown-only: fixed in `src-tauri/src/mcp.rs`.
- Image rendering initially failed because Tauri asset protocol was not enabled/scoped: fixed in `src-tauri/tauri.conf.json` and vault lifecycle scope sync in `src-tauri/src/commands/vault.rs`.
- Daemon/UI startup regression for already-open vaults: fixed by syncing asset scope in `get_vault_info`.

## Residual Risks
- Asset scope is now correctly constrained to the current vault, but this behavior depends on the UI process receiving all vault lifecycle events through the existing command paths.
- The verification coverage is targeted rather than full-suite; unrelated warnings remain in some frontend tests.

## Conclusion
`COMP-NOTE-TYPES-012` is verified and ready to be treated as the completed baseline for future non-markdown note types.
