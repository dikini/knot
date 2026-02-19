# Frontend/UI Components

## Metadata
- ID: `COMP-FRONTEND-001`
- Source: `extracted`
- Component: `frontend`
- Depth: `standard`
- Extracted: `2026-02-19`
- Concerns: [CAP, REL]

## Source Reference
- Codebase: `src/`
- Entry Points:
  - `App.tsx` (Main app component)
  - `lib/api.ts` (Tauri API client)
  - `lib/store.ts` (Zustand state management)
  - `components/Editor/` (ProseMirror editor)
  - `components/Sidebar/` (Navigation)
- Lines Analyzed: ~800

## Confidence Assessment
| Requirement | Confidence | Evidence | Needs Review |
|-------------|------------|----------|--------------|
| FR-1: Vault management UI | high | Implementation | no |
| FR-2: Note list display | high | Implementation | no |
| FR-3: Note editor | medium | Basic implementation | yes |
| FR-4: API client | high | Implementation | no |
| FR-5: State management | high | Implementation | no |
| FR-6: Keyboard shortcuts | medium | Partial implementation | yes |

## Contract

### Functional Requirements

**FR-1**: Vault management UI (open, close, display info)
- Evidence: `App.tsx:8-109`
- Confidence: high
- Features:
  - Input field for vault path
  - Open vault button
  - Close vault button
  - Display vault name, path, note count, last modified
  - Error display banner
  - Loading indicators

**FR-2**: Note list in sidebar
- Evidence: `components/Sidebar/index.tsx` (assumed from glob), `App.tsx:47`
- Confidence: high
- Uses: `useVaultStore.noteList`

**FR-3**: ProseMirror-based note editor
- Evidence: `components/Editor/index.tsx:1-123`
- Confidence: medium
- Features:
  - Markdown editing with ProseMirror
  - Auto-load current note content
  - Dirty state indicator
  - Save button (enabled when dirty)
  - Word count and modification date display
- Status: Basic implementation, distraction-free features not yet implemented

**FR-4**: Type-safe API client for Tauri commands
- Evidence: `lib/api.ts:1-247`
- Confidence: high
- Coverage:
  - Vault: create, open, close, info, check, recent notes
  - Notes: list, get, save, delete, rename, create
  - Search: search, suggestions
  - Graph: layout
  - Test: greet

**FR-5**: Global state management with Zustand
- Evidence: `lib/store.ts:1-149`
- Confidence: high
- State slices:
  - `VaultState`: vault, currentNote, noteList, isLoading, error
  - `EditorState`: content, isDirty, cursorPosition
- Actions: openVault, closeVault, loadNotes, loadNote, saveCurrentNote

**FR-6**: Keyboard shortcuts
- Evidence: `components/Editor/index.tsx:69-90`
- Confidence: medium
- Implemented: Ctrl/Cmd + S (save)
- Missing: Many editor shortcuts not yet implemented

### Interface (TypeScript)

```typescript
// Vault Types (from types/vault.ts)
export interface VaultInfo {
  path: string;
  name: string;
  note_count: number;
  last_modified: number;
}

export interface NoteSummary {
  id: string;
  path: string;
  title: string;
  created_at: number;
  modified_at: number;
  word_count: number;
}

export interface NoteData {
  id: string;
  path: string;
  title: string;
  content: string;
  created_at: number;
  modified_at: number;
  word_count: number;
  headings: Heading[];
  backlinks: Backlink[];
}

// Store State (from lib/store.ts)
interface VaultState {
  vault: VaultInfo | null;
  currentNote: NoteData | null;
  noteList: NoteSummary[];
  isLoading: boolean;
  error: string | null;
  
  setVault: (vault: VaultInfo | null) => void;
  setCurrentNote: (note: NoteData | null) => void;
  setNoteList: (notes: NoteSummary[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  openVault: (path: string) => Promise<void>;
  closeVault: () => Promise<void>;
  loadNotes: () => Promise<void>;
  loadNote: (path: string) => Promise<void>;
  saveCurrentNote: () => Promise<void>;
  
  hasVault: () => boolean;
  hasNote: () => boolean;
}

interface EditorState {
  content: string;
  isDirty: boolean;
  cursorPosition: number;
  
  setContent: (content: string) => void;
  markDirty: (dirty: boolean) => void;
  setCursorPosition: (pos: number) => void;
  reset: () => void;
}

// API Functions (from lib/api.ts)
export async function createVault(path: string): Promise<VaultInfo>;
export async function openVault(path: string): Promise<VaultInfo>;
export async function closeVault(): Promise<void>;
export async function getVaultInfo(): Promise<VaultInfo | null>;
export async function isVaultOpen(): Promise<boolean>;
export async function getRecentNotes(limit?: number): Promise<NoteSummary[]>;
export async function listNotes(): Promise<NoteSummary[]>;
export async function getNote(path: string): Promise<NoteData>;
export async function saveNote(path: string, content: string): Promise<void>;
export async function deleteNote(path: string): Promise<void>;
export async function renameNote(oldPath: string, newPath: string): Promise<void>;
export async function createNote(path: string, content?: string): Promise<NoteData>;
export async function searchNotes(query: string, limit?: number): Promise<SearchResult[]>;
export async function searchSuggestions(query: string, limit?: number): Promise<string[]>;
export async function getGraphLayout(width: number, height: number): Promise<GraphLayout>;
export async function greet(name: string): Promise<string>;
```

### Component Structure

```
src/
├── App.tsx                 # Main app layout, vault management UI
├── main.tsx                # React entry point
├── components/
│   ├── Editor/
│   │   ├── index.tsx       # Editor component with ProseMirror
│   │   └── Editor.css      # Editor styles
│   └── Sidebar/
│       ├── index.tsx       # Navigation sidebar
│       └── Sidebar.css     # Sidebar styles
├── editor/                 # ProseMirror-specific code
│   ├── index.ts            # Editor initialization
│   ├── markdown.ts         # Markdown schema/serialization
│   ├── schema.ts           # ProseMirror schema
│   └── plugins/            # Editor plugins
│       ├── index.ts
│       ├── keymap.ts       # Keyboard shortcuts
│       ├── syntax-hide.ts  # (Distraction-free feature)
│       └── wikilinks.ts    # Wiki link handling
├── lib/
│   ├── api.ts              # Tauri API client
│   └── store.ts            # Zustand state management
├── types/
│   ├── vault.ts            # Shared types
│   └── editor.ts           # Editor types
└── styles/
    ├── App.css             # App styles
    └── global.css          # Global styles
```

### Behavior

**Given** no vault is open
**When** user enters path and clicks "Open Vault"
**Then** API called, vault loaded, notes list populated

**Given** vault is open with notes
**When** note is selected in sidebar
**Then** Editor loads with note content, dirty flag cleared

**Given** user edits note content
**When** typing occurs
**Then** dirty flag set to true, save button enabled

**Given** dirty note with Ctrl+S pressed
**When** save completes
**Then** dirty flag cleared, note list refreshed

**Given** error from backend
**When** error occurs
**Then** Error banner displayed with message

## Design Decisions (Inferred)

| Decision | Evidence | Confidence |
|----------|----------|------------|
| React 18+ with hooks | `App.tsx:1` | high |
| Zustand for state management | `lib/store.ts:1` | high |
| ProseMirror for editor | `editor/index.ts` | high |
| TypeScript strict mode | `tsconfig.json` | high |
| Vite for build tooling | `vite.config.ts` | high |
| Path aliases (@components, @lib) | `vite.config.ts`, `tsconfig.json` | high |
| Async Tauri invoke with error handling | `lib/api.ts:18-26` | high |

## Uncertainties

- [ ] Distraction-free editing features (syntax hiding) - partially implemented in plugins
- [ ] Sidebar functionality - only basic structure visible
- [ ] Graph visualization UI - not yet implemented
- [ ] Search UI - not yet implemented
- [ ] Mobile/responsive design - not addressed
- [ ] Theme/dark mode - not implemented

## Acceptance Criteria (Derived from Code)

- [ ] Vault can be opened via UI
- [ ] Vault info displays correctly
- [ ] Notes list loads when vault opens
- [ ] Editor loads note content
- [ ] Dirty state tracks changes
- [ ] Save button saves note
- [ ] Ctrl+S keyboard shortcut works
- [ ] Error messages display

## Related
- Extracted from: `src/` directory
- Depends on: Tauri frontend API, Backend commands
- Uses: `COMP-VAULT-001`, `COMP-NOTE-001`, `COMP-SEARCH-001`, `COMP-GRAPH-001`
