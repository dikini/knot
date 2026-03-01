import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type ReactElement } from "react";
import { useVaultStore, useEditorStore } from "@lib/store";
import { IconButton } from "@components/IconButton";
import { VaultSwitcher } from "@components/VaultSwitcher";
import type { RecentVault } from "@lib/api";
import * as api from "@lib/api";
import type { ExplorerFolderNode } from "@/types/vault";
import { FolderPlus, FilePlus, ChevronDown, ChevronUp, RefreshCcw } from "lucide-react";
import { listen } from "@tauri-apps/api/event";
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
// SPEC: COMP-EXPLORER-TREE-001 FR-8, FR-9
export function Sidebar({
  recentVaults,
  onOpenVault,
  onCreateVault,
  onOpenRecent,
  onCloseVault,
}: SidebarProps) {
  const AUTO_EXPAND_DELAY_MS = 500;
  const { vault, noteList, currentNote, loadNote, saveCurrentNote, isLoading, setCurrentNote } =
    useVaultStore();
  const { isDirty, content } = useEditorStore();
  const [explorerRoot, setExplorerRoot] = useState<ExplorerFolderNode | null>(null);
  const [isExplorerLoading, setIsExplorerLoading] = useState(false);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const [draggedNotePath, setDraggedNotePath] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{
    path: string;
    type: "folder" | "note";
  } | null>(null);
  const autoExpandTimerRef = useRef<number | null>(null);
  const autoExpandPathRef = useRef<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    targetType: "folder" | "note";
    path: string;
  } | null>(null);

  const refreshExplorerTree = useCallback(async () => {
    setIsExplorerLoading(true);
    try {
      const tree = await api.getExplorerTree();
      setExplorerRoot(tree.root);
    } catch {
      setExplorerRoot(null);
    } finally {
      setIsExplorerLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!vault) {
      setExplorerRoot(null);
      return;
    }
    void refreshExplorerTree();
  }, [vault, noteList, refreshExplorerTree]);

  useEffect(() => () => {
    clearAutoExpandTimer();
  }, []);

  // SPEC: COMP-EXPLORER-TREE-001 FR-10, FR-11
  useEffect(() => {
    if (!vault) return;

    let cancelled = false;
    let debounceTimer: number | null = null;
    let unlistenFn: (() => void) | null = null;

    const subscribe = async () => {
      try {
        unlistenFn = await listen("vault://tree-changed", () => {
          if (cancelled) return;
          if (debounceTimer) {
            window.clearTimeout(debounceTimer);
          }
          debounceTimer = window.setTimeout(() => {
            void refreshExplorerTree();
            void useVaultStore.getState().loadNotes();
          }, 120);
        });
      } catch {
        // Non-tauri test/web contexts: keep polling fallback only.
      }
    };

    void subscribe();

    return () => {
      cancelled = true;
      if (debounceTimer) {
        window.clearTimeout(debounceTimer);
      }
      if (unlistenFn) {
        unlistenFn();
      }
    };
  }, [vault, refreshExplorerTree]);

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

  const clearAutoExpandTimer = () => {
    if (autoExpandTimerRef.current !== null) {
      window.clearTimeout(autoExpandTimerRef.current);
      autoExpandTimerRef.current = null;
    }
    autoExpandPathRef.current = null;
  };

  const withOptimisticTree = async (
    transform: (root: ExplorerFolderNode) => ExplorerFolderNode,
    action: () => Promise<void>
  ) => {
    const previous = explorerRoot;
    if (previous) {
      setExplorerRoot(transform(previous));
    }
    try {
      await action();
      await useVaultStore.getState().loadNotes();
      await refreshExplorerTree();
    } catch (error) {
      if (previous) {
        setExplorerRoot(previous);
      }
      alert(`Operation failed: ${error}`);
      await refreshExplorerTree();
    }
  };

  const normalizeRelPath = (value: string) => value.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  const splitNotePath = (value: string) => {
    const normalized = normalizeRelPath(value);
    const parts = normalized.split("/");
    const fileName = parts.pop() ?? "";
    const parentPath = parts.join("/");
    const baseName = fileName.replace(/\.md$/i, "");
    return { parentPath, fileName, baseName };
  };
  const basenameOnly = (value: string) => normalizeRelPath(value).split("/").pop() ?? "";
  const ensureMarkdownExtension = (value: string) => (value.endsWith(".md") ? value : `${value}.md`);
  const joinNotePath = (parentPath: string, fileName: string) =>
    parentPath ? `${parentPath}/${fileName}` : fileName;
  const resolveDropParentPath = (targetType: "folder" | "note", targetPath: string) =>
    targetType === "folder" ? targetPath : splitNotePath(targetPath).parentPath;
  const syncActiveNotePath = (oldPath: string, newPath: string) => {
    if (currentNote?.path !== oldPath) return;

    const { baseName } = splitNotePath(newPath);
    setCurrentNote({
      ...currentNote,
      path: newPath,
      title: baseName,
    });
  };

  const applyCreateFolder = (
    node: ExplorerFolderNode,
    parentPath: string,
    folderName: string
  ): ExplorerFolderNode => {
    const nextPath = parentPath ? `${parentPath}/${folderName}` : folderName;
    if (node.path === parentPath) {
      if (node.folders.some((folder) => folder.path === nextPath)) {
        return node;
      }
      return {
        ...node,
        expanded: true,
        folders: [
          ...node.folders,
          { path: nextPath, name: folderName, expanded: false, folders: [], notes: [] },
        ].sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase())),
      };
    }
    return {
      ...node,
      folders: node.folders.map((folder) => applyCreateFolder(folder, parentPath, folderName)),
    };
  };

  const applyDeleteNode = (
    node: ExplorerFolderNode,
    targetPath: string,
    targetType: "folder" | "note"
  ): ExplorerFolderNode => {
    if (targetType === "note") {
      return {
        ...node,
        folders: node.folders.map((folder) => applyDeleteNode(folder, targetPath, targetType)),
        notes: node.notes.filter((note) => note.path !== targetPath),
      };
    }

    return {
      ...node,
      folders: node.folders
        .filter((folder) => folder.path !== targetPath)
        .map((folder) => applyDeleteNode(folder, targetPath, targetType)),
    };
  };

  const applyRenameNode = (
    node: ExplorerFolderNode,
    targetPath: string,
    nextPath: string,
    targetType: "folder" | "note"
  ): ExplorerFolderNode => {
    if (targetType === "note") {
      return {
        ...node,
        folders: node.folders.map((folder) => applyRenameNode(folder, targetPath, nextPath, targetType)),
        notes: node.notes.map((note) =>
          note.path === targetPath
            ? { ...note, path: nextPath, display_title: nextPath.split("/").pop()?.replace(/\.md$/i, "") ?? note.display_title }
            : note
        ),
      };
    }

    const renamedSelf = node.path === targetPath;
    const mappedPath = renamedSelf
      ? nextPath
      : node.path.startsWith(`${targetPath}/`)
        ? `${nextPath}${node.path.slice(targetPath.length)}`
        : node.path;

    const mappedFolders = node.folders.map((folder) =>
      applyRenameNode(folder, targetPath, nextPath, targetType)
    );

    const mappedNotes = node.notes.map((note) => {
      if (note.path.startsWith(`${targetPath}/`)) {
        return { ...note, path: `${nextPath}${note.path.slice(targetPath.length)}` };
      }
      return note;
    });

    return {
      ...node,
      path: mappedPath,
      name: mappedPath === "" ? node.name : mappedPath.split("/").pop() ?? node.name,
      folders: mappedFolders,
      notes: mappedNotes,
    };
  };

  const setAllExpanded = (node: ExplorerFolderNode, expanded: boolean): ExplorerFolderNode => ({
    ...node,
    expanded: node.path === "" ? true : expanded,
    folders: node.folders.map((folder) => setAllExpanded(folder, expanded)),
  });

  const collectFolderPaths = (node: ExplorerFolderNode): string[] => {
    const children = node.folders.flatMap((folder) => collectFolderPaths(folder));
    return node.path === "" ? children : [node.path, ...children];
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

  type VisibleTreeItem = {
    key: string;
    type: "folder" | "note";
    path: string;
    parentFolderPath: string;
    depth: number;
    expanded?: boolean;
  };

  const visibleTreeItems = useMemo<VisibleTreeItem[]>(() => {
    if (!explorerRoot) return [];
    const items: VisibleTreeItem[] = [];

    const walk = (folder: ExplorerFolderNode, depth: number, parentFolderPath: string) => {
      if (folder.path !== "") {
        items.push({
          key: `folder:${folder.path}`,
          type: "folder",
          path: folder.path,
          parentFolderPath,
          depth,
          expanded: folder.expanded,
        });
      }

      if (!folder.expanded) return;
      const nextDepth = folder.path === "" ? depth : depth + 1;

      for (const child of folder.folders) {
        walk(child, nextDepth, folder.path);
      }
      for (const note of folder.notes) {
        items.push({
          key: `note:${note.path}`,
          type: "note",
          path: note.path,
          parentFolderPath: folder.path,
          depth: nextDepth,
        });
      }
    };

    walk(explorerRoot, 0, "");
    return items;
  }, [explorerRoot]);

  const itemRefs = useRef<Record<string, HTMLElement | null>>({});
  const focusTreeItem = (itemKey: string) => {
    const element = itemRefs.current[itemKey];
    if (!element) return;
    element.focus();
    setFocusedKey(itemKey);
  };

  const handleTreeKeyDown = async (event: React.KeyboardEvent<HTMLUListElement>) => {
    if (visibleTreeItems.length === 0) return;

    const index = visibleTreeItems.findIndex((item) => item.key === focusedKey);
    const currentIndex = index >= 0 ? index : 0;
    const current = visibleTreeItems[currentIndex];

    if (event.key === "ArrowDown") {
      event.preventDefault();
      const next = visibleTreeItems[Math.min(currentIndex + 1, visibleTreeItems.length - 1)];
      focusTreeItem(next.key);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      const prev = visibleTreeItems[Math.max(currentIndex - 1, 0)];
      focusTreeItem(prev.key);
      return;
    }

    if (event.key === "ArrowRight") {
      if (current.type === "folder") {
        event.preventDefault();
        if (!current.expanded) {
          await handleFolderToggle(current.path, true);
          return;
        }
        const child = visibleTreeItems[currentIndex + 1];
        if (child) {
          focusTreeItem(child.key);
        }
      }
      return;
    }

    if (event.key === "ArrowLeft") {
      if (current.type === "folder" && current.expanded) {
        event.preventDefault();
        await handleFolderToggle(current.path, false);
        return;
      }
      if (current.parentFolderPath) {
        event.preventDefault();
        focusTreeItem(`folder:${current.parentFolderPath}`);
      }
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (current.type === "folder") {
        await handleFolderToggle(current.path, !current.expanded);
      } else {
        await handleNoteClick(current.path);
      }
    }
  };

  // SPEC: COMP-EXPLORER-TREE-001 FR-8, FR-9
  const handleNewFolder = async (baseFolderPath: string) => {
    const name = normalizeRelPath(prompt("Folder name:") ?? "");
    if (!name) return;
    await withOptimisticTree(
      (root) => applyCreateFolder(root, baseFolderPath, name),
      async () => {
        const fullPath = baseFolderPath ? `${baseFolderPath}/${name}` : name;
        await api.createDirectory(fullPath);
      }
    );
  };

  const handleNewNote = async (baseFolderPath: string) => {
    const name = normalizeRelPath(prompt("Note name:") ?? "");
    if (!name) return;
    const fileName = name.endsWith(".md") ? name : `${name}.md`;
    const fullPath = baseFolderPath ? `${baseFolderPath}/${fileName}` : fileName;
    await withOptimisticTree(
      (root) => root,
      async () => {
        const note = await api.createNote(fullPath, "# New Note\n\nStart writing...");
        setCurrentNote(note);
      }
    );
  };

  const handleDeleteTarget = async (targetType: "folder" | "note", targetPath: string) => {
    const confirmed = confirm(
      targetType === "folder"
        ? `Delete folder "${targetPath}" recursively?`
        : `Delete note "${targetPath}"?`
    );
    if (!confirmed) return;

    await withOptimisticTree(
      (root) => applyDeleteNode(root, targetPath, targetType),
      async () => {
        if (targetType === "folder") {
          await api.deleteDirectory(targetPath, true);
        } else {
          await api.deleteNote(targetPath);
        }
      }
    );
  };

  const handleRenameTarget = async (targetType: "folder" | "note", targetPath: string) => {
    const next = normalizeRelPath(prompt("New path:", targetPath) ?? "");
    if (!next || next === targetPath) return;

    await withOptimisticTree(
      (root) => applyRenameNode(root, targetPath, next, targetType),
      async () => {
        if (targetType === "folder") {
          await api.renameDirectory(targetPath, next);
        } else {
          await api.renameNote(targetPath, next.endsWith(".md") ? next : `${next}.md`);
        }
      }
    );
  };

  const handleRenameNotePath = async (targetPath: string, nextPath: string) => {
    if (!nextPath || nextPath === targetPath) return;

    await withOptimisticTree(
      (root) => applyRenameNode(root, targetPath, nextPath, "note"),
      async () => {
        await api.renameNote(targetPath, nextPath);
        syncActiveNotePath(targetPath, nextPath);
      }
    );
  };

  const moveNoteToParentPath = async (targetPath: string, nextParentPath: string) => {
    const { parentPath, fileName } = splitNotePath(targetPath);
    if (parentPath === nextParentPath) return;
    await handleRenameNotePath(targetPath, joinNotePath(nextParentPath, fileName));
  };

  // SPEC: COMP-AUTHORING-FLOWS-001 FR-2, FR-4
  const handleRenameFile = async (targetPath: string) => {
    const { parentPath, fileName } = splitNotePath(targetPath);
    const nextFileName = ensureMarkdownExtension(basenameOnly(prompt("New file name:", fileName) ?? ""));
    if (!nextFileName) return;
    await handleRenameNotePath(targetPath, joinNotePath(parentPath, nextFileName));
  };

  // SPEC: COMP-AUTHORING-FLOWS-001 FR-2, FR-4
  const handleRenameNote = async (targetPath: string) => {
    const { parentPath, baseName } = splitNotePath(targetPath);
    const nextBaseName = basenameOnly(prompt("New note name:", baseName) ?? "").replace(/\.md$/i, "");
    if (!nextBaseName) return;
    await handleRenameNotePath(targetPath, joinNotePath(parentPath, `${nextBaseName}.md`));
  };

  // SPEC: COMP-AUTHORING-FLOWS-001 FR-3, FR-4
  const handleMoveNote = async (targetPath: string) => {
    const { parentPath } = splitNotePath(targetPath);
    const nextParentPath = normalizeRelPath(prompt("Destination folder:", parentPath) ?? "");
    await moveNoteToParentPath(targetPath, nextParentPath);
  };

  const handleNoteDragStart = (event: DragEvent<HTMLElement>, notePath: string) => {
    event.stopPropagation();
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", notePath);
    clearAutoExpandTimer();
    setDraggedNotePath(notePath);
    setDropTarget(null);
  };

  const scheduleAutoExpand = (folder: ExplorerFolderNode) => {
    if (folder.expanded || autoExpandPathRef.current === folder.path) return;
    clearAutoExpandTimer();
    autoExpandPathRef.current = folder.path;
    autoExpandTimerRef.current = window.setTimeout(() => {
      autoExpandTimerRef.current = null;
      autoExpandPathRef.current = null;
      void handleFolderToggle(folder.path, true);
    }, AUTO_EXPAND_DELAY_MS);
  };

  const handleDragEnterTarget = (targetType: "folder" | "note", targetPath: string) => {
    if (!draggedNotePath || draggedNotePath === targetPath) return;
    setDropTarget({ path: targetPath, type: targetType });
  };

  const handleDragLeaveTarget = (targetType: "folder" | "note", targetPath: string) => {
    if (targetType === "folder" && autoExpandPathRef.current === targetPath) {
      clearAutoExpandTimer();
    }
    setDropTarget((current) =>
      current?.path === targetPath && current.type === targetType ? null : current
    );
  };

  const handleDropOnTarget = async (
    event: DragEvent<HTMLElement>,
    targetType: "folder" | "note",
    targetPath: string
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const notePath = draggedNotePath || event.dataTransfer.getData("text/plain");
    clearAutoExpandTimer();
    setDropTarget(null);
    setDraggedNotePath(null);
    if (!notePath) return;

    await moveNoteToParentPath(notePath, resolveDropParentPath(targetType, targetPath));
  };

  const handleExpandCollapseAll = async (expanded: boolean) => {
    if (!explorerRoot) return;
    const folderPaths = collectFolderPaths(explorerRoot);
    setExplorerRoot((prev) => (prev ? setAllExpanded(prev, expanded) : prev));
    await Promise.all(folderPaths.map((path) => api.setFolderExpanded(path, expanded).catch(() => undefined)));
    await refreshExplorerTree();
  };

  const renderNote = (notePath: string, noteTitle: string, depth: number, isInitiallyFocusable: boolean) => (
    <li
      key={notePath}
      className={`explorer-tree__note-row ${currentNote?.path === notePath ? "explorer-tree__note-row--active" : ""} ${
        dropTarget?.type === "note" && dropTarget.path === notePath ? "explorer-tree__note-row--drop-target" : ""
      }`}
      style={{ paddingLeft: `${depth * 12 + 28}px` }}
      role="treeitem"
      aria-level={depth + 1}
      aria-selected={focusedKey === `note:${notePath}`}
      draggable
      ref={(el) => {
        itemRefs.current[`note:${notePath}`] = el;
      }}
      tabIndex={
        focusedKey === `note:${notePath}` || (focusedKey === null && isInitiallyFocusable) ? 0 : -1
      }
      onFocus={() => setFocusedKey(`note:${notePath}`)}
      onClick={() => void handleNoteClick(notePath)}
      onDragStart={(event) => handleNoteDragStart(event, notePath)}
      onDragEnd={() => {
        clearAutoExpandTimer();
        setDraggedNotePath(null);
        setDropTarget(null);
      }}
      onDragEnter={(event) => {
        event.preventDefault();
        event.stopPropagation();
        handleDragEnterTarget("note", notePath);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = "move";
      }}
      onDragLeave={() => handleDragLeaveTarget("note", notePath)}
      onDrop={(event) => void handleDropOnTarget(event, "note", notePath)}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        setContextMenu({
          x: event.clientX,
          y: event.clientY,
          targetType: "note",
          path: notePath,
        });
      }}
    >
      <span className="explorer-tree__note-title">{noteTitle}</span>
    </li>
  );

  const renderFolder = (folder: ExplorerFolderNode, depth: number): ReactElement | ReactElement[] => {
    if (folder.path === "") {
      return (
        <>
          {folder.folders.map((child) => renderFolder(child, depth))}
          {folder.notes.map((note, index) =>
            renderNote(note.path, note.display_title, depth, index === 0)
          )}
        </>
      );
    }

    const noteDepth = depth + 1;

    return (
      <li
        key={folder.path}
        className={`explorer-tree__folder ${
          dropTarget?.type === "folder" && dropTarget.path === folder.path
            ? "explorer-tree__folder--drop-target"
            : ""
        }`}
        role="treeitem"
        aria-expanded={folder.expanded}
        aria-level={depth + 1}
        aria-selected={focusedKey === `folder:${folder.path}`}
        aria-label={folder.name}
        ref={(el) => {
          itemRefs.current[`folder:${folder.path}`] = el;
        }}
        tabIndex={focusedKey === `folder:${folder.path}` || (focusedKey === null && depth === 0) ? 0 : -1}
        onFocus={() => setFocusedKey(`folder:${folder.path}`)}
        onDragEnter={(event) => {
          event.preventDefault();
          event.stopPropagation();
          handleDragEnterTarget("folder", folder.path);
          scheduleAutoExpand(folder);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.stopPropagation();
          event.dataTransfer.dropEffect = "move";
          scheduleAutoExpand(folder);
        }}
        onDragLeave={() => handleDragLeaveTarget("folder", folder.path)}
        onDrop={(event) => void handleDropOnTarget(event, "folder", folder.path)}
        onContextMenu={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setContextMenu({
            x: event.clientX,
            y: event.clientY,
            targetType: "folder",
            path: folder.path,
          });
        }}
      >
        <div
          className="explorer-tree__folder-row"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => void handleFolderToggle(folder.path, !folder.expanded)}
          onContextMenu={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setContextMenu({
              x: event.clientX,
              y: event.clientY,
              targetType: "folder",
              path: folder.path,
            });
          }}
        >
          <span className="explorer-tree__chevron">{folder.expanded ? "▾" : "▸"}</span>
          <span className="explorer-tree__folder-name">{folder.name}</span>
        </div>
        {folder.expanded && (
          <ul className="explorer-tree__children" role="group">
            {folder.folders.map((child) => renderFolder(child, noteDepth))}
            {folder.notes.map((note) => renderNote(note.path, note.display_title, noteDepth, false))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <section className="sidebar" aria-label="Notes sidebar">
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
            <div className="sidebar__actions">
              <IconButton
                icon={FilePlus}
                label="New Note"
                onClick={() => handleNewNote("")}
                className="sidebar__action-btn"
              />
              <IconButton
                icon={FolderPlus}
                label="New Folder"
                onClick={() => handleNewFolder("")}
                className="sidebar__action-btn"
              />
              <IconButton
                icon={ChevronUp}
                label="Collapse"
                onClick={() => handleExpandCollapseAll(false)}
                className="sidebar__action-btn"
              />
              <IconButton
                icon={ChevronDown}
                label="Expand"
                onClick={() => handleExpandCollapseAll(true)}
                className="sidebar__action-btn"
              />
              <IconButton
                icon={RefreshCcw}
                label="Refresh"
                onClick={refreshExplorerTree}
                className="sidebar__action-btn"
              />
            </div>
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
            <ul
              className="explorer-tree"
              role="tree"
              aria-label="Notes explorer"
              onKeyDown={(event) => void handleTreeKeyDown(event)}
              onContextMenu={(event) => {
                if (event.target !== event.currentTarget) return;
                event.preventDefault();
                setContextMenu({
                  x: event.clientX,
                  y: event.clientY,
                  targetType: "folder",
                  path: "",
                });
              }}
            >
              {renderFolder(explorerRoot, 0)}
            </ul>
          )
        ) : (
          <p className="sidebar__empty">No vault open</p>
        )}
      </nav>
      {contextMenu && (
        <div
          className="sidebar-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          role="menu"
          onMouseLeave={() => setContextMenu(null)}
        >
          {contextMenu.targetType === "folder" && (
            <>
              <button type="button" role="menuitem" onClick={() => void handleNewNote(contextMenu.path)}>
                New note here
              </button>
              <button type="button" role="menuitem" onClick={() => void handleNewFolder(contextMenu.path)}>
                New folder
              </button>
              {contextMenu.path !== "" && (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void handleRenameTarget("folder", contextMenu.path)}
                  >
                    Rename folder
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void handleDeleteTarget("folder", contextMenu.path)}
                  >
                    Delete folder
                  </button>
                </>
              )}
            </>
          )}
          {contextMenu.targetType === "note" && (
            <>
              <button type="button" role="menuitem" onClick={() => void handleRenameFile(contextMenu.path)}>
                Rename file
              </button>
              <button type="button" role="menuitem" onClick={() => void handleRenameNote(contextMenu.path)}>
                Rename note
              </button>
              <button type="button" role="menuitem" onClick={() => void handleMoveNote(contextMenu.path)}>
                Move note
              </button>
              <button type="button" role="menuitem" onClick={() => void handleDeleteTarget("note", contextMenu.path)}>
                Delete note
              </button>
            </>
          )}
        </div>
      )}
    </section>
  );
}
