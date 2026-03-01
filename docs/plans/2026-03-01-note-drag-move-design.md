# Note Drag Move Design
Change-Type: design-update
Trace: DESIGN-note-drag-move

## Summary

Add explorer drag-and-drop for moving notes between folders without introducing a new backend primitive. The sidebar will reuse the existing `rename_note(old_path, new_path)` path mutation flow so drag-drop and prompt-based move remain behaviorally identical.

## Recommended Approach

Use native HTML drag-and-drop on sidebar rows.

- Note rows are draggable.
- Folder rows accept drops directly.
- Note rows also accept drops, resolving the destination to that note's parent folder.
- Same-folder drops are silent no-ops.
- Existing context-menu move remains available as fallback.

This keeps the change local to `src/components/Sidebar/index.tsx`, avoids new dependencies, and preserves current optimistic tree refresh plus active-note path sync.

## Interaction Model

### Drag source

- Only note rows are draggable in this slice.
- Folder dragging is out of scope.

### Drop targets

- Dropping on a folder row moves the dragged note into that folder.
- Dropping on a note row moves the dragged note into the parent folder of the target note.
- Dropping into the dragged note's current parent folder does nothing and shows no warning.

### Visual feedback

- The current drop target gets a dedicated highlight state.
- Collapsed folders auto-expand after a short drag-hover delay.
- No custom drag preview is included in this slice.

## Implementation Shape

`Sidebar` owns a minimal local drag state:

- `draggedNotePath: string | null`
- `dropTargetPath: string | null`
- `dropTargetType: "folder" | "note" | null`

Shared helpers:

- Resolve destination folder from a folder path or a note path.
- Reuse the existing rename/move helper so drag-drop and prompt move share path-building and active-note sync behavior.
- Reuse the existing folder toggle path for delayed auto-expand so persisted expansion state stays aligned.

Rendering updates stay in the explorer tree:

- Note rows: `draggable`, `onDragStart`, `onDragEnd`
- Folder and note rows: `onDragOver`, `onDragEnter`, `onDragLeave`, `onDrop`
- CSS modifier for active drop target

## Testing

Targeted sidebar tests should cover:

- Drag note onto folder row moves note into that folder.
- Drag note onto note row moves note into the target note's parent folder.
- Drag note into its current parent folder is a no-op.
- Drag-moving the active note updates the current note path through existing sync logic.
- Hovering a dragged note over a collapsed folder expands it after the configured delay.
- Leaving a collapsed folder before the delay prevents expansion.

## Limits

- No folder dragging
- No keyboard drag-drop equivalent
- No notification for no-op drops
