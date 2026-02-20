import { useVaultStore, useEditorStore } from "@lib/store";
import { VaultSwitcher } from "@components/VaultSwitcher";
import { SearchBox } from "@components/SearchBox";
import type { RecentVault } from "@lib/api";
import * as api from "@lib/api";
import "./Sidebar.css";

export interface SidebarProps {
  recentVaults: RecentVault[];
  onOpenVault: () => void;
  onCreateVault: () => void;
  onOpenRecent: (path: string) => void;
  onCloseVault: () => void;
}

// SPEC: COMP-UI-LAYOUT-002 FR-2, FR-6
// SPEC: COMP-FRONTEND-001 FR-2
export function Sidebar({
  recentVaults,
  onOpenVault,
  onCreateVault,
  onOpenRecent,
  onCloseVault,
}: SidebarProps) {
  const { vault, noteList, currentNote, loadNote, saveCurrentNote, isLoading, setCurrentNote } =
    useVaultStore();
  const { isDirty, content } = useEditorStore();

  const handleNoteClick = async (path: string) => {
    // Don't reload same note
    if (currentNote?.path === path) return;

    // Check for unsaved changes
    if (isDirty && currentNote) {
      const choice = confirm(
        `You have unsaved changes in "${currentNote.title}".\n\n` +
          "Click OK to save and switch, Cancel to discard changes and switch."
      );

      if (choice) {
        // Save then switch
        try {
          await saveCurrentNote(content);
        } catch (error) {
          alert("Failed to save note. Switching cancelled.");
          return;
        }
      }
      // If cancel clicked, we proceed without saving (discard changes)
    }

    await loadNote(path);
  };

  // SPEC: COMP-NOTE-SEL-001 FR-1
  // SPEC: COMP-SEARCH-UI-001 FR-3
  const handleSearchResultSelect = async (path: string) => {
    // Don't reload same note
    if (currentNote?.path === path) return;

    // Check for unsaved changes
    if (isDirty && currentNote) {
      const choice = confirm(
        `You have unsaved changes in "${currentNote.title}".\n\n` +
          "Click OK to save and switch, Cancel to discard changes and switch."
      );

      if (choice) {
        // Save then switch
        try {
          await saveCurrentNote(content);
        } catch (error) {
          alert("Failed to save note. Switching cancelled.");
          return;
        }
      }
      // If cancel clicked, we proceed without saving (discard changes)
    }

    await loadNote(path);
  };

  const handleCreateNote = async () => {
    if (!vault) return;

    const name = prompt("Enter note name:");
    if (!name) return;

    const path = name.endsWith(".md") ? name : `${name}.md`;

    try {
      const note = await api.createNote(path, "# New Note\n\nStart writing...");
      setCurrentNote(note);
      // Refresh the notes list
      await useVaultStore.getState().loadNotes();
    } catch (error) {
      alert(`Failed to create note: ${error}`);
    }
  };

  return (
    <aside className="sidebar">
      <header className="sidebar__header">
        <VaultSwitcher
          vault={vault}
          recentVaults={recentVaults}
          onOpenVault={onOpenVault}
          onCreateVault={onCreateVault}
          onOpenRecent={onOpenRecent}
          onCloseVault={onCloseVault}
        />
        {vault && (
          <>
            {/* SPEC: COMP-SEARCH-UI-001 FR-1 */}
            <SearchBox onResultSelect={handleSearchResultSelect} />
            <button className="sidebar__new-btn" onClick={handleCreateNote}>
              + New Note
            </button>
          </>
        )}
      </header>

      <nav className="sidebar__nav">
        {vault ? (
          isLoading && noteList.length === 0 ? (
            <p className="sidebar__loading">Loading notes...</p>
          ) : noteList.length === 0 ? (
            <p className="sidebar__empty">No notes yet</p>
          ) : (
            <ul className="note-list">
              {noteList.map((note) => (
                <li
                  key={note.path}
                  className={`note-list__item ${
                    currentNote?.path === note.path ? "note-list__item--active" : ""
                  }`}
                  onClick={() => handleNoteClick(note.path)}
                >
                  <span className="note-list__title">{note.title || note.path}</span>
                  <span className="note-list__date">
                    {new Date(note.modified_at * 1000).toLocaleDateString()}
                  </span>
                  {note.word_count > 0 && (
                    <span className="note-list__words">{note.word_count} words</span>
                  )}
                </li>
              ))}
            </ul>
          )
        ) : (
          <p className="sidebar__empty">No vault open</p>
        )}
      </nav>
    </aside>
  );
}
