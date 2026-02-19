# Note Selection UI

## Metadata

- ID: `COMP-NOTE-SEL-001`
- Scope: `component`
- Status: `implemented`
- Parent: `COMP-FRONTEND-001`, `COMP-NOTE-001`
- Concerns: [REL, CAP]
- Created: `2026-02-19`
- Verified: `2026-02-19` (100% compliance)

## Purpose

Wire the sidebar note list to the editor. When a user clicks a note in the sidebar, it should load in the editor.

## Current State

**Sidebar** (`src/components/Sidebar/index.tsx`):

- Displays list of notes from `useVaultStore().noteList`
- Has `onNoteSelect` callback prop
- Not yet connected to editor

**Editor** (`src/components/Editor/index.tsx`):

- Takes `currentNote` from store
- Loads content when `currentNote` changes
- Has save functionality

**Store** (`src/lib/store.ts`):

- Has `loadNote(path)` action
- Has `currentNote` state
- Not connected to sidebar clicks

## Contract

### Functional Requirements

**FR-1**: Click note in sidebar to open

- Given: Vault is open with notes displayed in sidebar
- When: User clicks a note item
- Then: Note loads in editor, editor shows content

**FR-2**: Visual selection state

- Selected note highlighted in sidebar
- Clear which note is currently open

**FR-3**: Handle unsaved changes

- If current note has unsaved changes, prompt user
- Options: Save, Discard, Cancel
- Prevent accidental data loss

**FR-4**: Empty state

- When no note selected, editor shows placeholder
- Prompt to select or create note

**FR-5**: Keyboard navigation (optional)

- Arrow keys to navigate list
- Enter to open selected note

### Interface (TypeScript)

```typescript
// Sidebar props (existing)
interface SidebarProps {
  onNoteSelect?: (path: string) => void;
}

// Store additions needed
interface VaultState {
  // ... existing ...
  selectedNotePath: string | null; // Track selection
}

// New action
loadNote: (path: string) => Promise<void>; // Already exists
```

### Behavior

**Given** vault open with notes, no note selected
**When** user clicks note "ideas.md" in sidebar
**Then** sidebar highlights "ideas.md", editor loads content, store updates currentNote

**Given** editing note with unsaved changes
**When** user clicks different note
**Then** confirmation dialog: "You have unsaved changes. Save before switching?"

- Save: Save current, then switch
- Don't Save: Discard changes, switch
- Cancel: Stay on current note

## Design Decisions

| Decision                    | Rationale              | Trade-off           |
| --------------------------- | ---------------------- | ------------------- |
| Track selectedPath in store | Single source of truth | Slightly more state |
| Prompt for unsaved changes  | Prevent data loss      | Interrupts flow     |
| Sidebar handles click       | Natural UX             | Tight coupling      |

## Acceptance Criteria

- [ ] Click note in sidebar opens it in editor
- [ ] Selected note visually highlighted
- [ ] Unsaved changes prompt before switching
- [ ] Editor shows placeholder when no note selected
- [ ] Works with content loading (P1.1)

## Related

- Depends on: P1.1 Content Loading (content must load first)
- Uses: `COMP-FRONTEND-001`, `COMP-NOTE-001`
- Blocks: Full editing workflow
