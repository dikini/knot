import { useEffect, useRef, useCallback, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { initProseMirrorEditor } from "@editor/index";
import {
  canRedoHistory,
  canUndoHistory,
  clearBlockFormatting,
  insertDisplayMath,
  insertInlineMath,
  redoHistory,
  undoHistory,
} from "@editor/commands";
import { renderMarkdownToHtml, renderMermaidDiagrams } from "@editor/render";
import {
  buildKnownWikilinkTargets,
  getWikilinkSuggestions,
  notePathFromWikilinkTarget,
  resolveWikilinkTargetPath,
} from "@editor/wikilink-utils";
import { IconButton } from "@components/IconButton";
import { useEditorStore, useVaultStore } from "@lib/store";
import * as api from "@lib/api";
import type { AppKeymapSettings } from "@lib/api";
import { DEFAULT_APP_KEYMAP_SETTINGS, expandManagedShortcutMap, matchesShortcutEvent } from "@lib/keymapSettings";
import {
  Save,
  Bold,
  Italic,
  Link2,
  Code,
  Plus,
  X,
  FileCode2,
  Redo2,
  TextQuote,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  Sigma,
  Undo2,
} from "lucide-react";
import { toggleMark, wrapIn, setBlockType } from "prosemirror-commands";
import { Selection, TextSelection, type Command } from "prosemirror-state";
import { schema } from "@editor/schema";
import type { ProseMirrorEditor } from "../../types/editor";
import "./Editor.css";

// SPEC: COMP-UI-LAYOUT-002 FR-4
// SPEC: COMP-FRONTEND-001 FR-3, FR-6
// SPEC: COMP-ICON-CHROME-001 FR-2, FR-5
// SPEC: COMP-EDITOR-MODES-001 FR-1, FR-2, FR-3, FR-4, FR-5, FR-6, FR-7, FR-9, FR-11
// TRACE: DESIGN-editor-medium-like-interactions
// TRACE: DESIGN-editor-wikilink-ux-003
interface EditorProps {
  appKeymapSettings?: AppKeymapSettings;
}

export function Editor({ appKeymapSettings = DEFAULT_APP_KEYMAP_SETTINGS }: EditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const editContainerRef = useRef<HTMLDivElement>(null);
  const pmRef = useRef<ProseMirrorEditor | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const blockMenuRef = useRef<HTMLDivElement>(null);
  const blockToggleRef = useRef<HTMLButtonElement>(null);
  const viewArticleRef = useRef<HTMLElement>(null);
  const initialContentRef = useRef<string>("# New Note\n\nStart writing...");
  const { currentNote, setCurrentNote, loadNote, noteList, shell } = useVaultStore();
  const { content, setContent, markDirty, isDirty, reset } = useEditorStore();
  const [editorMode, setEditorMode] = useState<"source" | "edit" | "view">("edit");
  const [selectionToolbar, setSelectionToolbar] = useState<{
    visible: boolean;
    x: number;
    y: number;
    placeBelow?: boolean;
  }>({
    visible: false,
    x: 0,
    y: 0,
    placeBelow: false,
  });
  const [blockTool, setBlockTool] = useState<{
    visible: boolean;
    x: number;
    y: number;
  }>({
    visible: false,
    x: 0,
    y: 0,
  });
  const [blockMenuOpen, setBlockMenuOpen] = useState(false);
  const [wikilinkSuggest, setWikilinkSuggest] = useState<{
    visible: boolean;
    x: number;
    y: number;
    from: number;
    to: number;
    items: Array<{ target: string; label: string; path: string }>;
    hasMore: boolean;
  }>({
    visible: false,
    x: 0,
    y: 0,
    from: 0,
    to: 0,
    items: [],
    hasMore: false,
  });
  const [historyAvailability, setHistoryAvailability] = useState({
    undo: false,
    redo: false,
  });
  const managedShortcuts = useMemo(() => expandManagedShortcutMap(appKeymapSettings), [appKeymapSettings]);

  const noteScopedModeKey = currentNote ? `knot:editor-mode:${currentNote.path}` : null;

  const updateHistoryAvailability = useCallback((next?: { undo: boolean; redo: boolean }) => {
    if (next) {
      setHistoryAvailability(next);
      return;
    }

    const viewState = pmRef.current?.view.state;
    if (!viewState) {
      setHistoryAvailability({ undo: false, redo: false });
      return;
    }

    setHistoryAvailability({
      undo: canUndoHistory(viewState),
      redo: canRedoHistory(viewState),
    });
  }, []);

  if (currentNote?.content && initialContentRef.current === "# New Note\n\nStart writing...") {
    initialContentRef.current = currentNote.content;
  }

  useEffect(() => {
    if (!noteScopedModeKey) {
      setEditorMode("edit");
      return;
    }
    const stored = localStorage.getItem(noteScopedModeKey);
    if (stored === "source" || stored === "edit" || stored === "view") {
      setEditorMode(stored);
      return;
    }
    setEditorMode("edit");
  }, [noteScopedModeKey]);

  useEffect(() => {
    if (!noteScopedModeKey) return;
    localStorage.setItem(noteScopedModeKey, editorMode);
  }, [editorMode, noteScopedModeKey]);

  useEffect(() => {
    if (!currentNote) return;
    setContent(currentNote.content);
    markDirty(false);
  }, [currentNote, setContent, markDirty]);

  useEffect(() => {
    const dirty = Boolean(currentNote && isDirty);
    const pending = api.setUnsavedChanges(dirty);
    if (pending && typeof (pending as Promise<unknown>).catch === "function") {
      void pending.catch(() => {
        // Non-tauri test/web contexts may not provide this command.
      });
    }
  }, [currentNote, isDirty]);

  useEffect(() => {
    window.__KNOT_WIKILINK_TARGETS__ = [...buildKnownWikilinkTargets(noteList)];
    if (!pmRef.current) return;
    const { view } = pmRef.current;
    view.dispatch(view.state.tr.setMeta("wikilink-targets-updated", true));
  }, [noteList]);

  const updateWikilinkSuggest = useCallback(() => {
    if (!pmRef.current || !editContainerRef.current) {
      setWikilinkSuggest((previous) => ({ ...previous, visible: false }));
      return;
    }

    const { view } = pmRef.current;
    const selection = view.state.selection as typeof view.state.selection & { $from?: typeof view.state.selection.$from };
    if (!selection.empty) {
      setWikilinkSuggest((previous) => ({ ...previous, visible: false }));
      return;
    }

    if (!selection.$from || typeof selection.from !== "number") {
      setWikilinkSuggest((previous) => ({ ...previous, visible: false }));
      return;
    }

    const { $from } = selection;
    if (!$from.parent.isTextblock) {
      setWikilinkSuggest((previous) => ({ ...previous, visible: false }));
      return;
    }

    const textBefore = $from.parent.textBetween(0, $from.parentOffset, "", "");
    const markerIndex = textBefore.lastIndexOf("[[");
    if (markerIndex < 0) {
      setWikilinkSuggest((previous) => ({ ...previous, visible: false }));
      return;
    }

    const query = textBefore.slice(markerIndex + 2).trim();
    if (query.includes("|") || query.length < 3) {
      setWikilinkSuggest((previous) => ({ ...previous, visible: false }));
      return;
    }

    const { items, hasMore } = getWikilinkSuggestions(noteList, query, 5);
    if (items.length === 0) {
      setWikilinkSuggest((previous) => ({ ...previous, visible: false }));
      return;
    }

    const containerRect = editContainerRef.current.getBoundingClientRect();
    const cursor = view.coordsAtPos(selection.from);

    setWikilinkSuggest({
      visible: true,
      x: Math.max(8, cursor.left - containerRect.left),
      y: Math.max(8, cursor.bottom - containerRect.top + editContainerRef.current.scrollTop + 6),
      from: $from.start() + markerIndex,
      to: selection.from,
      items,
      hasMore,
    });
  }, [noteList]);

  const applyWikilinkSuggestion = useCallback((target: string) => {
    if (!pmRef.current) return;
    const { view } = pmRef.current;
    const transaction = view.state.tr.insertText(`[[${target}]]`, wikilinkSuggest.from, wikilinkSuggest.to);
    view.dispatch(transaction);
    view.focus();
    setWikilinkSuggest((previous) => ({ ...previous, visible: false }));
  }, [wikilinkSuggest.from, wikilinkSuggest.to]);

  const followOrCreateWikilinkTarget = useCallback(
    async (target: string) => {
      const normalizedTarget = target.trim();
      if (!normalizedTarget) return;

      const existingPath = resolveWikilinkTargetPath(noteList, normalizedTarget);
      if (existingPath) {
        await loadNote(existingPath);
        return;
      }

      const path = notePathFromWikilinkTarget(normalizedTarget);
      const created = await api.createNote(path, `# ${normalizedTarget}\n\n`);
      setCurrentNote(created);
      await useVaultStore.getState().loadNotes();
    },
    [loadNote, noteList, setCurrentNote]
  );

  // Initialize editor
  useEffect(() => {
    if (editorMode !== "edit") {
      updateHistoryAvailability({ undo: false, redo: false });
      if (pmRef.current) {
        pmRef.current.destroy();
        pmRef.current = null;
      }
      return;
    }
    if (!editorRef.current || !currentNote) return;

    const pm = initProseMirrorEditor(editorRef.current, {
      onChange: (state) => {
        setContent(state.markdown);
        markDirty(true);
        updateHistoryAvailability();
        updateWikilinkSuggest();
      },
      onSelectionChange: (selection) => {
        if (!editContainerRef.current || !pmRef.current) {
          setSelectionToolbar((prev) => ({ ...prev, visible: false }));
          setBlockTool((prev) => ({ ...prev, visible: false }));
          setBlockMenuOpen(false);
          setWikilinkSuggest((previous) => ({ ...previous, visible: false }));
          return;
        }
        const view = pmRef.current.view;
        const fromCoords = view.coordsAtPos(selection.from);
        const toCoords = view.coordsAtPos(selection.to);
        const containerRect = editContainerRef.current.getBoundingClientRect();
        const containerWidth = containerRect.width;
        const scrollParent = editContainerRef.current;
        const scrollTop = scrollParent instanceof HTMLElement ? scrollParent.scrollTop : 0;

        if (selection.empty) {
          const proseRect = view.dom.getBoundingClientRect();
          const gutterLeft = proseRect.left - containerRect.left;
          const lineBottom = fromCoords.bottom - containerRect.top + scrollTop;
          setSelectionToolbar((prev) => ({ ...prev, visible: false }));
          setBlockTool({
            visible: true,
            x: Math.max(8, Math.min(gutterLeft - 36, containerWidth - 36)),
            y: Math.max(8, lineBottom - 14),
          });
          updateWikilinkSuggest();
          return;
        }

        const centerX = (fromCoords.left + toCoords.right) / 2 - containerRect.left;
        const topY = Math.min(fromCoords.top, toCoords.top);
        const belowY = Math.max(8, fromCoords.bottom - containerRect.top + scrollTop + 8);
        const preferredAboveY = topY - containerRect.top + scrollTop - 44;
        const placeBelow = preferredAboveY < 10;
        const clampedX = Math.max(84, Math.min(centerX, containerWidth - 84));
        setBlockTool((prev) => ({ ...prev, visible: false }));
        setBlockMenuOpen(false);
        setSelectionToolbar({
          visible: true,
          x: clampedX,
          y: placeBelow ? belowY : Math.max(8, preferredAboveY),
          placeBelow,
        });
        setWikilinkSuggest((previous) => ({ ...previous, visible: false }));
      },
      initialContent:
        useEditorStore.getState().content || currentNote.content || initialContentRef.current,
    });

    pmRef.current = pm;
    updateHistoryAvailability();

    if (editContainerRef.current) {
      const { view } = pm;
      const selection = view.state.selection;
      if (selection.empty) {
        const fromCoords = view.coordsAtPos(selection.from);
        const containerRect = editContainerRef.current.getBoundingClientRect();
        const proseRect = view.dom.getBoundingClientRect();
        const gutterLeft = proseRect.left - containerRect.left;
        const lineBottom = fromCoords.bottom - containerRect.top + editContainerRef.current.scrollTop;
        setBlockTool({
          visible: true,
          x: Math.max(8, Math.min(gutterLeft - 36, containerRect.width - 36)),
          y: Math.max(8, lineBottom - 14),
        });
      }
    }

    return () => {
      updateHistoryAvailability({ undo: false, redo: false });
      pm.destroy();
      pmRef.current = null;
    };
  }, [editorMode, currentNote, setContent, markDirty, updateHistoryAvailability, updateWikilinkSuggest]);

  const runCommand = useCallback((command: Command) => {
    if (!pmRef.current) return;
    const { state, dispatch } = pmRef.current.view;
    command(state, dispatch, pmRef.current.view);
    pmRef.current.view.focus();
  }, []);

  const handleHistoryCommand = useCallback((command: Command) => {
    if (!pmRef.current) return;
    const { state, dispatch } = pmRef.current.view;
    const handled = command(state, dispatch, pmRef.current.view);
    if (handled) {
      updateHistoryAvailability();
      pmRef.current.view.focus();
    }
  }, [updateHistoryAvailability]);

  const handleToggleLink = useCallback(() => {
    if (!pmRef.current) return;
    const href = prompt("Link URL:");
    if (!href) return;
    const linkMark = schema.marks.link;
    if (!linkMark) return;
    runCommand(toggleMark(linkMark, { href, title: null }));
  }, [runCommand]);

  const insertBlockAfterSelection = useCallback(
    (kind: "code_block" | "blockquote" | "heading_1" | "heading_2" | "heading_3" | "bullet_list" | "ordered_list" | "horizontal_rule" | "mermaid_diagram") => {
      if (!pmRef.current) return;
      const { view } = pmRef.current;
      const { state, dispatch } = view;
      const selectionWithResolved = state.selection as typeof state.selection & {
        $from?: { depth: number; parent?: { isTextblock?: boolean }; after: (depth: number) => number };
      };
      let insertPos = state.selection.to;

      if (kind === "mermaid_diagram") {
        if (selectionWithResolved.$from?.parent?.isTextblock) {
          // Keep inline mark runs intact by inserting Mermaid as a sibling block.
          insertPos = selectionWithResolved.$from.after(selectionWithResolved.$from.depth);
        }
        // TRACE: BUG-mermaid-insert-escape-001
        const mermaidNode = schema.nodes.code_block.create(
          { language: "mermaid" },
          schema.text("graph TD\n  A[Start] --> B[End]")
        );
        const tr = state.tr.insert(insertPos, mermaidNode);
        dispatch(tr.scrollIntoView());
        view.focus();
        setBlockMenuOpen(false);
        return;
      }

      let node;

      if (kind === "code_block") {
        node = schema.nodes.code_block.create({ language: null });
      } else if (kind === "blockquote") {
        node = schema.nodes.blockquote.create(null, schema.nodes.paragraph.create());
      } else if (kind === "heading_1") {
        node = schema.nodes.heading.create({ level: 1 });
      } else if (kind === "heading_2") {
        node = schema.nodes.heading.create({ level: 2 });
      } else if (kind === "heading_3") {
        node = schema.nodes.heading.create({ level: 3 });
      } else if (kind === "bullet_list") {
        node = schema.nodes.bullet_list.create(
          null,
          schema.nodes.list_item.create(null, schema.nodes.paragraph.create())
        );
      } else if (kind === "ordered_list") {
        node = schema.nodes.ordered_list.create(
          { order: 1 },
          schema.nodes.list_item.create(null, schema.nodes.paragraph.create())
        );
      } else {
        node = schema.nodes.horizontal_rule.create();
      }

      let tr = state.tr.insert(insertPos, node);
      const nearPos = Math.min(insertPos + 1, tr.doc.content.size);
      const resolved = tr.doc.resolve(nearPos);
      tr = tr.setSelection(Selection.near(resolved, 1));

      if (!(tr.selection instanceof TextSelection)) {
        tr = tr.setSelection(TextSelection.create(tr.doc, tr.selection.from));
      }

      dispatch(tr.scrollIntoView());
      view.focus();
      setBlockMenuOpen(false);
    },
    []
  );

  const handleLinearToolbarKeydown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>, options?: { closeOnEscape?: boolean }) => {
      const root = event.currentTarget;
      const controls = Array.from(root.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
      if (controls.length === 0) return;

      const active = document.activeElement as HTMLElement | null;
      const currentIndex = controls.findIndex((button) => button === active);

      const focusByIndex = (index: number) => {
        const normalized = (index + controls.length) % controls.length;
        controls[normalized]?.focus();
      };

      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        focusByIndex((currentIndex === -1 ? 0 : currentIndex + 1));
        return;
      }

      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        focusByIndex((currentIndex === -1 ? controls.length - 1 : currentIndex - 1));
        return;
      }

      if (event.key === "Home") {
        event.preventDefault();
        controls[0]?.focus();
        return;
      }

      if (event.key === "End") {
        event.preventDefault();
        controls[controls.length - 1]?.focus();
        return;
      }

      if (event.key === "Enter" || event.key === " ") {
        if (currentIndex === -1) return;
        event.preventDefault();
        controls[currentIndex]?.click();
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        if (options?.closeOnEscape) {
          setBlockMenuOpen(false);
          blockToggleRef.current?.focus();
        } else {
          setSelectionToolbar((prev) => ({ ...prev, visible: false }));
          pmRef.current?.view.focus();
        }
      }
    },
    []
  );

  useEffect(() => {
    if (!blockMenuOpen) return;
    const firstMenuItem = blockMenuRef.current?.querySelector<HTMLButtonElement>("button[role='menuitem']");
    firstMenuItem?.focus();
  }, [blockMenuOpen]);

  // Load note content when currentNote changes
  useEffect(() => {
    if (!pmRef.current || !currentNote || editorMode !== "edit") return;
    if (isDirty) return;

    // Only update if content is different (avoid loops)
    const currentMarkdown = pmRef.current.getMarkdown();
    if (currentMarkdown !== currentNote.content) {
      pmRef.current.setMarkdown(currentNote.content);
      reset();
    }
  }, [currentNote, editorMode, isDirty, reset]);

  const effectiveMarkdown = content || currentNote?.content || "";
  const renderedHtml = useMemo(
    () => renderMarkdownToHtml(effectiveMarkdown),
    [effectiveMarkdown]
  );

  useEffect(() => {
    if (editorMode !== "view" || !viewArticleRef.current) return;
    void renderMermaidDiagrams(viewArticleRef.current);
  }, [editorMode, renderedHtml]);

  // Save note handler
  const handleSave = useCallback(async () => {
    if (!currentNote || !isDirty) return;

    try {
      await api.saveNote(currentNote.path, content);
      markDirty(false);

      // Update current note in store
      const updatedNote = await api.getNote(currentNote.path);
      setCurrentNote(updatedNote);

      // Refresh note list
      await useVaultStore.getState().loadNotes();

      console.log("Note saved successfully");
    } catch (error) {
      console.error("Failed to save note:", error);
      alert(`Failed to save: ${error}`);
    }
  }, [currentNote, content, isDirty, markDirty, setCurrentNote]);

  useEffect(() => {
    const handleManagedKeyDown = (event: KeyboardEvent) => {
      if (matchesShortcutEvent(event, appKeymapSettings.keymaps.general.save_note)) {
        event.preventDefault();
        void handleSave();
        return;
      }

      if (editorMode !== "edit" || !pmRef.current) {
        return;
      }

      if (managedShortcuts.undo.some((shortcut) => matchesShortcutEvent(event, serializeShortcut(shortcut)))) {
        event.preventDefault();
        handleHistoryCommand(undoHistory);
        return;
      }

      if (managedShortcuts.redo.some((shortcut) => matchesShortcutEvent(event, serializeShortcut(shortcut)))) {
        event.preventDefault();
        handleHistoryCommand(redoHistory);
        return;
      }

      if (
        managedShortcuts.clearParagraph.some((shortcut) =>
          matchesShortcutEvent(event, serializeShortcut(shortcut))
        )
      ) {
        event.preventDefault();
        runCommand(clearBlockFormatting);
      }
    };

    window.addEventListener("keydown", handleManagedKeyDown, true);
    return () => window.removeEventListener("keydown", handleManagedKeyDown, true);
  }, [appKeymapSettings, editorMode, handleHistoryCommand, handleSave, managedShortcuts, runCommand]);

  // Listen for save events from outside
  useEffect(() => {
    const handleSaveEvent = () => {
      handleSave();
    };

    window.addEventListener("editor-save", handleSaveEvent);
    return () => window.removeEventListener("editor-save", handleSaveEvent);
  }, [handleSave]);

  useEffect(() => {
    const handleWikilinkClick = async (event: Event) => {
      const custom = event as CustomEvent<{ target: string; missing?: boolean }>;
      const target = custom.detail?.target?.trim();
      if (!target) return;
      await followOrCreateWikilinkTarget(target);
    };

    window.addEventListener("wikilink-click", handleWikilinkClick as EventListener);
    return () => window.removeEventListener("wikilink-click", handleWikilinkClick as EventListener);
  }, [followOrCreateWikilinkTarget]);

  const handleRenderedMarkdownClick = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      const targetElement = event.target as HTMLElement | null;
      if (!targetElement) return;

      const anchor = targetElement.closest("a") as HTMLAnchorElement | null;
      if (!anchor) return;

      const wikilinkTarget = anchor.getAttribute("data-wikilink");
      if (wikilinkTarget) {
        event.preventDefault();
        void followOrCreateWikilinkTarget(wikilinkTarget);
        return;
      }

      const href = anchor.getAttribute("href")?.trim();
      if (!href || href.startsWith("http://") || href.startsWith("https://") || href.startsWith("#")) {
        return;
      }

      if (href.endsWith(".md")) {
        event.preventDefault();
        void loadNote(href);
      }
    },
    [followOrCreateWikilinkTarget, loadNote]
  );

  if (!currentNote) {
    return (
      <div className="editor-wrapper">
        <div className="editor-placeholder">
          <div className="editor-placeholder__content">
            <h3>No note selected</h3>
            <p>Select a note from the sidebar to start editing</p>
            <p className="editor-placeholder__hint">
              Or create a new note using the New Note action in the sidebar
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-wrapper">
      <div className="editor-toolbar">
        <div className="editor-toolbar__info">
          <>
            <span className="editor-toolbar__title" title={currentNote.path}>
              {currentNote.title || currentNote.path}
            </span>
            {isDirty && <span className="editor-toolbar__dirty">●</span>}
            <span className="editor-toolbar__meta">
              {currentNote.word_count} words
              {" · "}
              {new Date(currentNote.modified_at * 1000).toLocaleDateString()}
            </span>
          </>
        </div>
        <div className="editor-toolbar__actions">
          <div className="editor-toolbar__history" role="group" aria-label="Editor history">
            <IconButton
              icon={Undo2}
              label="Undo"
              showLabel={shell.showTextLabels}
              disabled={!historyAvailability.undo}
              onClick={() => handleHistoryCommand(undoHistory)}
            />
            <IconButton
              icon={Redo2}
              label="Redo"
              showLabel={shell.showTextLabels}
              disabled={!historyAvailability.redo}
              onClick={() => handleHistoryCommand(redoHistory)}
            />
          </div>
          <div className="editor-toolbar__modes" role="tablist" aria-label="Editor mode">
            <button
              type="button"
              role="tab"
              aria-selected={editorMode === "source"}
              className={`editor-toolbar__mode-btn ${editorMode === "source" ? "is-active" : ""}`}
              onClick={() => setEditorMode("source")}
            >
              Source
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={editorMode === "edit"}
              className={`editor-toolbar__mode-btn ${editorMode === "edit" ? "is-active" : ""}`}
              onClick={() => setEditorMode("edit")}
            >
              Edit
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={editorMode === "view"}
              className={`editor-toolbar__mode-btn ${editorMode === "view" ? "is-active" : ""}`}
              onClick={() => setEditorMode("view")}
            >
              View
            </button>
          </div>
          <IconButton
            icon={Save}
            label={isDirty ? "Save" : "Saved"}
            className="editor-toolbar__save"
            showLabel={shell.showTextLabels}
            disabled={!isDirty}
            onClick={handleSave}
          />
        </div>
      </div>
      {editorMode === "edit" && (
        <div ref={editContainerRef} className="editor-container editor-container--edit">
          <div ref={editorRef} className="editor-edit-host" />
          {selectionToolbar.visible && (
            <div
              ref={toolbarRef}
              className={`editor-selection-toolbar ${selectionToolbar.placeBelow ? "is-below" : ""}`}
              style={{ left: `${selectionToolbar.x}px`, top: `${selectionToolbar.y}px` }}
              role="toolbar"
              aria-label="Selection formatting"
              onKeyDown={(event) => handleLinearToolbarKeydown(event)}
            >
              <button
                type="button"
                className="editor-selection-toolbar__action"
                aria-label="Bold"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  const strongMark = schema.marks.strong;
                  if (!strongMark) return;
                  runCommand(toggleMark(strongMark));
                }}
              >
                <Bold size={14} />
                <span className="editor-selection-toolbar__label">Bold</span>
              </button>
              <button
                type="button"
                className="editor-selection-toolbar__action"
                aria-label="Italic"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  const emMark = schema.marks.em;
                  if (!emMark) return;
                  runCommand(toggleMark(emMark));
                }}
              >
                <Italic size={14} />
                <span className="editor-selection-toolbar__label">Italic</span>
              </button>
              <button
                type="button"
                className="editor-selection-toolbar__action"
                aria-label="Code"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  const codeMark = schema.marks.code;
                  if (!codeMark) return;
                  runCommand(toggleMark(codeMark));
                }}
              >
                <Code size={14} />
                <span className="editor-selection-toolbar__label">Code</span>
              </button>
              <button
                type="button"
                className="editor-selection-toolbar__action"
                aria-label="Inline math"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  runCommand(insertInlineMath);
                }}
              >
                <Sigma size={14} />
                <span className="editor-selection-toolbar__label">Inline math</span>
              </button>
              <button
                type="button"
                className="editor-selection-toolbar__action"
                aria-label="Quote"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  const blockquoteNode = schema.nodes.blockquote;
                  if (!blockquoteNode) return;
                  runCommand(wrapIn(blockquoteNode));
                }}
              >
                <TextQuote size={14} />
                <span className="editor-selection-toolbar__label">Quote</span>
              </button>
              <button
                type="button"
                className="editor-selection-toolbar__action"
                aria-label="Strikethrough"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  const strikeMark = schema.marks.strike;
                  if (!strikeMark) return;
                  runCommand(toggleMark(strikeMark));
                }}
              >
                <Strikethrough size={14} />
                <span className="editor-selection-toolbar__label">Strike</span>
              </button>
              <button
                type="button"
                className="editor-selection-toolbar__action"
                aria-label="Link"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleToggleLink}
              >
                <Link2 size={14} />
                <span className="editor-selection-toolbar__label">Link</span>
              </button>
            </div>
          )}
          {blockTool.visible && (
            <div
              className="editor-block-tool"
              style={{ left: `${blockTool.x}px`, top: `${blockTool.y}px` }}
            >
              <button
                ref={blockToggleRef}
                type="button"
                className="editor-block-tool__toggle"
                aria-label={blockMenuOpen ? "Close block menu" : "Open block menu"}
                onClick={() => setBlockMenuOpen((open) => !open)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    setBlockMenuOpen(false);
                  }
                }}
              >
                {blockMenuOpen ? <X size={17} strokeWidth={2.8} /> : <Plus size={17} strokeWidth={2.8} />}
              </button>
              {blockMenuOpen && (
                <div
                  ref={blockMenuRef}
                  className="editor-block-tool__menu"
                  role="menu"
                  aria-label="Insert block"
                  onKeyDown={(event) => handleLinearToolbarKeydown(event, { closeOnEscape: true })}
                >
                  <button
                    type="button"
                    role="menuitem"
                    className="editor-block-tool__menu-item"
                    onClick={() => {
                      runCommand(clearBlockFormatting);
                      setBlockMenuOpen(false);
                    }}
                  >
                    <Pilcrow size={14} data-testid="block-menu-icon-paragraph" aria-hidden="true" />
                    <span>Paragraph</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="editor-block-tool__menu-item"
                    onClick={() => {
                      const heading = schema.nodes.heading;
                      if (!heading) return;
                      runCommand(setBlockType(heading, { level: 1 }));
                      setBlockMenuOpen(false);
                    }}
                  >
                    <Heading1 size={14} data-testid="block-menu-icon-h1" aria-hidden="true" />
                    <span>Heading 1</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="editor-block-tool__menu-item"
                    onClick={() => {
                      const heading = schema.nodes.heading;
                      if (!heading) return;
                      runCommand(setBlockType(heading, { level: 2 }));
                      setBlockMenuOpen(false);
                    }}
                  >
                    <Heading2 size={14} data-testid="block-menu-icon-h2" aria-hidden="true" />
                    <span>Heading 2</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="editor-block-tool__menu-item"
                    onClick={() => {
                      const heading = schema.nodes.heading;
                      if (!heading) return;
                      runCommand(setBlockType(heading, { level: 3 }));
                      setBlockMenuOpen(false);
                    }}
                  >
                    <Heading3 size={14} data-testid="block-menu-icon-h3" aria-hidden="true" />
                    <span>Heading 3</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="editor-block-tool__menu-item"
                    onClick={() => insertBlockAfterSelection("bullet_list")}
                  >
                    <List size={14} data-testid="block-menu-icon-bullet" aria-hidden="true" />
                    <span>Bullet list</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="editor-block-tool__menu-item"
                    onClick={() => insertBlockAfterSelection("ordered_list")}
                  >
                    <ListOrdered size={14} data-testid="block-menu-icon-ordered" aria-hidden="true" />
                    <span>Numbered list</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="editor-block-tool__menu-item"
                    onClick={() => insertBlockAfterSelection("horizontal_rule")}
                  >
                    <Minus size={14} data-testid="block-menu-icon-hr" aria-hidden="true" />
                    <span>Horizontal rule</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="editor-block-tool__menu-item"
                    onClick={() => {
                      runCommand(insertDisplayMath);
                      setBlockMenuOpen(false);
                    }}
                  >
                    <Sigma size={14} data-testid="block-menu-icon-math" aria-hidden="true" />
                    <span>Math block</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="editor-block-tool__menu-item"
                    onClick={() => insertBlockAfterSelection("mermaid_diagram")}
                  >
                    <FileCode2 size={14} data-testid="block-menu-icon-mermaid" aria-hidden="true" />
                    <span>Mermaid diagram</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="editor-block-tool__menu-item"
                    onClick={() => insertBlockAfterSelection("code_block")}
                  >
                    <FileCode2 size={14} data-testid="block-menu-icon-code" aria-hidden="true" />
                    <span>Code block</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="editor-block-tool__menu-item"
                    onClick={() => insertBlockAfterSelection("blockquote")}
                  >
                    <TextQuote size={14} data-testid="block-menu-icon-quote" aria-hidden="true" />
                    <span>Blockquote</span>
                  </button>
                </div>
              )}
            </div>
          )}
          {wikilinkSuggest.visible && (
            <div
              className="editor-wikilink-suggest"
              style={{ left: `${wikilinkSuggest.x}px`, top: `${wikilinkSuggest.y}px` }}
              role="listbox"
              aria-label="Wikilink suggestions"
            >
              {wikilinkSuggest.items.map((item) => (
                <button
                  key={item.path}
                  type="button"
                  className="editor-wikilink-suggest__item"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => applyWikilinkSuggestion(item.target)}
                >
                  <span>{item.label}</span>
                  <span className="editor-wikilink-suggest__path">{item.path}</span>
                </button>
              ))}
              {wikilinkSuggest.hasMore && (
                <div className="editor-wikilink-suggest__more">More matches available…</div>
              )}
            </div>
          )}
        </div>
      )}
      {editorMode === "source" && (
        <div className="editor-container editor-container--source">
          <textarea
            className="editor-source-textarea"
            aria-label="Source markdown editor"
            value={effectiveMarkdown}
            onChange={(event) => {
              setContent(event.target.value);
              markDirty(true);
            }}
          />
        </div>
      )}
      {editorMode === "view" && (
        <div className="editor-container editor-container--view">
          <article
            ref={viewArticleRef}
            className="editor-view-markdown"
            onClick={handleRenderedMarkdownClick}
            dangerouslySetInnerHTML={{ __html: renderedHtml }}
          />
        </div>
      )}
    </div>
  );
}

function serializeShortcut(shortcut: { useMod: boolean; altKey: boolean; shiftKey: boolean; key: string }): string {
  const parts: string[] = [];
  if (shortcut.useMod) {
    parts.push("Mod");
  }
  if (shortcut.altKey) {
    parts.push("Alt");
  }
  if (shortcut.shiftKey) {
    parts.push("Shift");
  }
  parts.push(shortcut.key);
  return parts.join("-");
}
