import { useEffect, useState } from "react";
import { useVaultStore, useEditorStore } from "@lib/store";
import { VaultSwitcher } from "@components/VaultSwitcher";
import { SearchBox } from "@components/SearchBox";
import type { RecentVault } from "@lib/api";
import * as api from "@lib/api";
import type { ExplorerFolderNode } from "@/types/vault";
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
// SPEC: COMP-EXPLORER-TREE-001 FR-1, FR-3, FR-4, FR-7
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
  const [explorerRoot, setExplorerRoot] = useState<ExplorerFolderNode | null>(null);
  const [isExplorerLoading, setIsExplorerLoading] = useState(false);

  useEffect(() => {
    if (!vault) {
      setExplorerRoot(null);
      return;
    }

    setIsExplorerLoading(true);
    api
      .getExplorerTree()
      .then((tree) => setExplorerRoot(tree.root))
      .catch(() => setExplorerRoot(null))
      .finally(() => setIsExplorerLoading(false));
  }, [vault, noteList]);

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

  const updateFolderExpanded = (
    node: ExplorerFolderNode,
    targetPath: string,
    expanded: boolean
  ): ExplorerFolderNode => {
    if (node.path === targetPath) {
      return { ...node, expanded };
    }
    return {
      ...node,
      folders: node.folders.map((child) => updateFolderExpanded(child, targetPath, expanded)),
    };
  };

  // SPEC: COMP-EXPLORER-TREE-001 FR-3, FR-5
  const handleFolderToggle = async (path: string, nextExpanded: boolean) => {
    if (!explorerRoot) return;

    setExplorerRoot((prev) => (prev ? updateFolderExpanded(prev, path, nextExpanded) : prev));
    try {
      await api.setFolderExpanded(path, nextExpanded);
    } catch {
      const tree = await api.getExplorerTree();
      setExplorerRoot(tree.root);
    }
  };

  const renderFolder = (folder: ExplorerFolderNode, depth: number) => (
    <li key={folder.path || "__root"} className="explorer-tree__folder">
      {folder.path !== "" && (
        <button
          type="button"
          className="explorer-tree__folder-row"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => handleFolderToggle(folder.path, !folder.expanded)}
          aria-expanded={folder.expanded}
          aria-label={folder.name}
        >
          <span className="explorer-tree__chevron">{folder.expanded ? "▾" : "▸"}</span>
          <span className="explorer-tree__folder-name">{folder.name}</span>
        </button>
      )}

      {folder.expanded && (
        <ul className="explorer-tree__children">
          {folder.folders.map((child) => renderFolder(child, folder.path === "" ? depth : depth + 1))}
          {folder.notes.map((note) => (
            <li key={note.path}>
              <button
                type="button"
                className={`explorer-tree__note-row ${
                  currentNote?.path === note.path ? "explorer-tree__note-row--active" : ""
                }`}
                style={{ paddingLeft: `${(folder.path === "" ? depth : depth + 1) * 12 + 28}px` }}
                onClick={() => handleNoteClick(note.path)}
              >
                <span className="explorer-tree__note-title">{note.display_title}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );

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
          ) : isExplorerLoading ? (
            <p className="sidebar__loading">Loading explorer...</p>
          ) : !explorerRoot ? (
            <p className="sidebar__empty">No notes yet</p>
          ) : (
            <ul className="explorer-tree" role="tree" aria-label="Notes explorer">
              {renderFolder(explorerRoot, 0)}
            </ul>
          )
        ) : (
          <p className="sidebar__empty">No vault open</p>
        )}
      </nav>
    </aside>
  );
}
