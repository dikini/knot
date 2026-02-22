# Frontend/UI Components

## Metadata
- ID: `COMP-FRONTEND-001`
- Source: `extracted`
- Component: `frontend`
- Depth: `standard`
- Extracted: `2026-02-19`
- Updated: `2026-02-22`
- Concerns: [CAP, REL]

## Source Reference
- Codebase: `src/`
- Entry Points:
  - `App.tsx` (shell orchestration, view/tool state, vault lifecycle integration)
  - `lib/api.ts` (typed Tauri client)
  - `lib/store.ts` (Zustand app/editor/shell state)
  - `components/Editor/` (ProseMirror-based edit/source/view modes)
  - `components/Sidebar/` (vault switcher + explorer tree + note navigation)
  - `components/SearchBox/` and `components/GraphView/` (integrated feature surfaces)
- Lines Analyzed: ~2200

## Confidence Assessment
| Requirement | Confidence | Evidence | Needs Review |
|-------------|------------|----------|--------------|
| FR-1: Vault management UI | high | `src/App.tsx`, `src/components/VaultSwitcher` | no |
| FR-2: Note list/explorer navigation | high | `src/components/Sidebar/index.tsx` | no |
| FR-3: ProseMirror editor surface | high | `src/components/Editor/index.tsx` | no |
| FR-4: Type-safe API client | high | `src/lib/api.ts` | no |
| FR-5: Global state management | high | `src/lib/store.ts` | no |
| FR-6: Keyboard shortcuts | high | `src/components/Editor/index.tsx`, `src/App.tsx` | no |

## Contract

### Functional Requirements

**FR-1**: Vault management UI (open/create/close/switch/status)  
- Evidence: `src/App.tsx`, `src/components/VaultSwitcher/index.tsx`, `src/lib/api.ts`  
- Implemented:
  - Open/create vault flows (dialog + recent vault switching)
  - Current vault state display and close flow
  - Error/loading surfacing via shared state and toasts

**FR-2**: Note list and explorer-based navigation  
- Evidence: `src/components/Sidebar/index.tsx`, `src/lib/store.ts`  
- Implemented:
  - Explorer tree load/refresh/listen flows
  - Note selection and load
  - Unsaved-change guard integration when switching notes
  - Folder/note create/rename/delete paths through typed API calls

**FR-3**: ProseMirror-based editor surface with mode-aware UX  
- Evidence: `src/components/Editor/index.tsx`, `src/editor/*`  
- Implemented:
  - Source/edit/view mode switching
  - Markdown editing with dirty-state tracking and save integration
  - Selection toolbar + block insert controls
  - Wikilink suggestion/insert/follow flows
  - Markdown rendering lane with mermaid rendering support in view mode

**FR-4**: Type-safe API client for frontend-to-Tauri commands  
- Evidence: `src/lib/api.ts`  
- Implemented:
  - Vault operations (open/create/close/info/recent/sync/unsaved-state)
  - Note + explorer operations (CRUD + directory/tree)
  - Search and graph operations
  - Typed invoke wrappers and centralized error normalization

**FR-5**: Global state management with Zustand  
- Evidence: `src/lib/store.ts`  
- Implemented:
  - `VaultState` for vault/note/shell/load/error state
  - `EditorState` for content/dirty/cursor state
  - Async action layer for open/close/load/save flows
  - Shell UI preferences and panel/tool toggles

**FR-6**: Keyboard shortcuts for core frontend workflows  
- Evidence: `src/components/Editor/index.tsx`, `src/App.tsx`  
- Implemented:
  - Save shortcut (`Ctrl/Cmd+S`) in editor workflows
  - Shell tool mode switching (`Ctrl/Cmd+1/2/3`) for notes/search/graph
  - Additional mode-specific interactions covered by editor-mode specs

### Interface (TypeScript)

```typescript
// From src/types/vault.ts
interface VaultInfo { path: string; name: string; note_count: number; last_modified: number }
interface NoteSummary { id: string; path: string; title: string; created_at: number; modified_at: number; word_count: number }
interface NoteData { id: string; path: string; title: string; content: string; created_at: number; modified_at: number; word_count: number; headings: Heading[]; backlinks: Backlink[] }

// From src/lib/store.ts
type ShellToolMode = "notes" | "search" | "graph";
type ShellDensityMode = "comfortable" | "adaptive";
interface ShellState {
  toolMode: ShellToolMode;
  isToolRailCollapsed: boolean;
  isContextPanelCollapsed: boolean;
  isInspectorRailOpen: boolean;
  contextPanelWidth: number;
  densityMode: ShellDensityMode;
  showTextLabels: boolean;
}

// From src/lib/api.ts
// Vault + UI
openVault(path), createVault(path), openVaultDialog(), createVaultDialog(), closeVault(),
getVaultInfo(), isVaultOpen(), getRecentVaults(), getRecentNotes(limit), syncExternalChanges(), setUnsavedChanges(dirty)
// Notes + explorer
listNotes(), getNote(path), saveNote(path, content), createNote(path, content?), renameNote(oldPath, newPath), deleteNote(path),
getExplorerTree(), setFolderExpanded(path, expanded), createDirectory(path), renameDirectory(oldPath, newPath), deleteDirectory(path, recursive)
// Search + graph
searchNotes(query, limit?), searchSuggestions(query, limit?), getGraphLayout(width, height)
```

### Behavior

**Given** no vault is open  
**When** user opens/creates a vault  
**Then** vault state hydrates and notes/explorer load.

**Given** a note is selected  
**When** user edits content  
**Then** editor dirty state and unsaved backend flag are synchronized.

**Given** unsaved note content exists  
**When** user switches note or vault  
**Then** guard flow prompts save/discard before transition.

**Given** user uses shell shortcuts  
**When** `Ctrl/Cmd+1/2/3` is pressed with a vault open  
**Then** active tool mode changes to notes/search/graph.

## Design Decisions (Inferred)

| Decision | Evidence | Confidence |
|----------|----------|------------|
| React with hook-first composition | `src/App.tsx` | high |
| Zustand as state boundary | `src/lib/store.ts` | high |
| ProseMirror editor core with mode layering | `src/components/Editor/index.tsx` | high |
| Typed Tauri IPC wrapper | `src/lib/api.ts` | high |
| Feature specialization via component specs | SPEC markers in frontend modules | high |

## Uncertainties

- [ ] None significant for current extracted scope; feature-specific evolution is tracked in designed component specs.

## Acceptance Criteria (Derived from Code)

- [x] Vault can be opened/created/switched from UI flows.
- [x] Vault and note navigation state are rendered and synchronized.
- [x] Editor loads selected note content and tracks dirty state.
- [x] Save and unsaved-change guards are wired through frontend and API boundary.
- [x] Search and graph surfaces are reachable through shell controls.
- [x] Core keyboard shortcuts (`Ctrl/Cmd+S`, `Ctrl/Cmd+1/2/3`) work in frontend workflows.
- [x] Error handling and loading states are surfaced through stores/UI.

## Related
- Extracted from: `src/`
- Depends on: `COMP-VAULT-001`, `COMP-NOTE-001`, `COMP-SEARCH-001`, `COMP-GRAPH-001`
- Complemented by designed specs:
  - `COMP-EDITOR-MODES-001`
  - `COMP-EDITOR-WYSIWYM-002`
  - `COMP-SEARCH-UI-001`
  - `COMP-GRAPH-UI-001`
  - `COMP-TOOL-RAIL-CONTEXT-001`
