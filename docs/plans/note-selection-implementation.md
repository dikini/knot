# Implementation Plan: Note Selection UI
Change-Type: bug-fix
Trace: BUG-note-selection-stale-delete

## Metadata
- Spec: `docs/specs/component/note-selection-001.md`
- Generated: `2026-02-19`
- Approach: `sequential`

## Summary
- Total tasks: 5
- Size: 2 Small, 3 Medium

## Tasks

| ID | Task | Size | Depends | Spec Ref |
|----|------|------|---------|----------|
| NS-001 | Read current Sidebar implementation | S | - | - |
| NS-002 | Add selectedNotePath to store | S | NS-001 | FR-2 |
| NS-003 | Wire Sidebar click to loadNote | M | NS-002 | FR-1 |
| NS-004 | Add visual selection highlight | S | NS-003 | FR-2 |
| NS-005 | Add unsaved changes dialog | M | NS-003 | FR-3 |
| NS-006 | Add editor placeholder | M | NS-003 | FR-4 |
| NS-007 | Reconcile deleted active note on note reload | S | NS-003 | FR-6 |

## Task Details

### NS-001: Read Sidebar implementation
Location: `src/components/Sidebar/index.tsx`
Understand:
- How notes are rendered
- Current onNoteSelect prop usage
- Styling approach

### NS-002: Add selectedNotePath to store
Location: `src/lib/store.ts`

Add to VaultState:
```typescript
selectedNotePath: string | null;
setSelectedNotePath: (path: string | null) => void;
```

Initialize to null. Update in loadNote action.

### NS-003: Wire Sidebar click
Location: `src/App.tsx` (pass handler to Sidebar)

In App.tsx:
```typescript
const handleNoteSelect = async (path: string) => {
  // Check for unsaved changes first (NS-005)
  await loadNote(path);
};

// Pass to Sidebar
<Sidebar onNoteSelect={handleNoteSelect} />
```

### NS-004: Visual selection highlight
Location: `src/components/Sidebar/index.tsx`

Accept `selectedPath` prop, apply CSS class to matching note:
```typescript
className={note.path === selectedPath ? 'note-item selected' : 'note-item'}
```

### NS-005: Unsaved changes dialog
Location: `src/App.tsx` or new component

Before switching notes:
```typescript
if (editorStore.isDirty) {
  const choice = await showConfirmDialog(
    "Unsaved Changes",
    "Save changes before switching?"
  );
  if (choice === 'save') {
    await saveCurrentNote();
  } else if (choice === 'cancel') {
    return; // Don't switch
  }
  // 'discard' just continues
}
```

Use browser confirm() for now, or add custom dialog component.

### NS-006: Editor placeholder
Location: `src/components/Editor/index.tsx`

When no currentNote:
```typescript
if (!currentNote) {
  return (
    <div className="editor-placeholder">
      <p>Select a note from the sidebar to start editing</p>
      <button onClick={createNewNote}>Create New Note</button>
    </div>
  );
}
```

### NS-007: Reconcile deleted active note on note reload
Location: `src/lib/store.ts`

After `listNotes()` resolves, compare the refreshed inventory against `currentNote.path`.

If the current note path is missing:
```typescript
set({ noteList: notes, currentNote: null, isLoading: false });
```

Otherwise preserve the active selection.

## Verification

```bash
npm run typecheck
npm run tauri dev  # Manual test
```

Test scenarios:
1. Click note → loads in editor
2. Selected note highlighted
3. Edit note, try switch → prompt appears
4. No note selected → placeholder shown
5. Delete selected note → selection clears and placeholder shows
