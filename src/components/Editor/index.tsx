import { useEffect, useRef, useCallback, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { initProseMirrorEditor } from "@editor/index";
import { renderMarkdownToHtml } from "@editor/render";
import { IconButton } from "@components/IconButton";
import { useEditorStore, useVaultStore } from "@lib/store";
import * as api from "@lib/api";
import { Save, Bold, Italic, Link2, Code, Plus, X } from "lucide-react";
import { toggleMark } from "prosemirror-commands";
import { TextSelection, type Command } from "prosemirror-state";
import { schema } from "@editor/schema";
import type { ProseMirrorEditor } from "../../types/editor";
import "./Editor.css";

// SPEC: COMP-UI-LAYOUT-002 FR-4
// SPEC: COMP-FRONTEND-001 FR-3, FR-6
// SPEC: COMP-ICON-CHROME-001 FR-2, FR-5
// SPEC: COMP-EDITOR-MODES-001 FR-1, FR-2, FR-3, FR-4, FR-5, FR-6, FR-7, FR-9, FR-11
// TRACE: DESIGN-editor-medium-like-interactions
export function Editor() {
  const editorRef = useRef<HTMLDivElement>(null);
  const editContainerRef = useRef<HTMLDivElement>(null);
  const pmRef = useRef<ProseMirrorEditor | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const blockMenuRef = useRef<HTMLDivElement>(null);
  const blockToggleRef = useRef<HTMLButtonElement>(null);
  const initialContentRef = useRef<string>("# New Note\n\nStart writing...");
  const { currentNote, setCurrentNote, shell } = useVaultStore();
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

  const noteScopedModeKey = currentNote ? `knot:editor-mode:${currentNote.path}` : null;

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

  // Initialize editor
  useEffect(() => {
    if (editorMode !== "edit") {
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
      },
      onSelectionChange: (selection) => {
        if (!editContainerRef.current || !pmRef.current) {
          setSelectionToolbar((prev) => ({ ...prev, visible: false }));
          setBlockTool((prev) => ({ ...prev, visible: false }));
          setBlockMenuOpen(false);
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
      },
      initialContent: content || currentNote.content || initialContentRef.current,
    });

    pmRef.current = pm;

    return () => {
      pm.destroy();
      pmRef.current = null;
    };
  }, [editorMode, content, currentNote, setContent, markDirty]);

  const runCommand = useCallback((command: Command) => {
    if (!pmRef.current) return;
    const { state, dispatch } = pmRef.current.view;
    command(state, dispatch, pmRef.current.view);
    pmRef.current.view.focus();
  }, []);

  const handleToggleLink = useCallback(() => {
    if (!pmRef.current) return;
    const href = prompt("Link URL:");
    if (!href) return;
    const linkMark = schema.marks.link;
    if (!linkMark) return;
    runCommand(toggleMark(linkMark, { href, title: null }));
  }, [runCommand]);

  const insertBlockAfterSelection = useCallback(
    (kind: "code_block" | "blockquote") => {
      if (!pmRef.current) return;
      const { view } = pmRef.current;
      const { state, dispatch } = view;
      const { $from } = state.selection;
      const depth = Math.min(1, $from.depth);
      const insertPos = depth > 0 ? $from.after(depth) : state.selection.to;

      let node;
      let cursorPos = insertPos + 1;

      if (kind === "code_block") {
        node = schema.nodes.code_block.create({ language: null });
      } else {
        node = schema.nodes.blockquote.create(null, schema.nodes.paragraph.create());
        cursorPos = insertPos + 2;
      }

      const tr = state.tr.insert(insertPos, node);
      tr.setSelection(TextSelection.create(tr.doc, cursorPos));
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

    // Only update if content is different (avoid loops)
    const currentMarkdown = pmRef.current.getMarkdown();
    if (currentMarkdown !== currentNote.content) {
      pmRef.current.setMarkdown(currentNote.content);
      reset();
    }
  }, [currentNote, editorMode, reset]);

  const effectiveMarkdown = content || currentNote?.content || "";
  const renderedHtml = useMemo(
    () => renderMarkdownToHtml(effectiveMarkdown),
    [effectiveMarkdown]
  );

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

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + S to save
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave]);

  // Listen for save events from outside
  useEffect(() => {
    const handleSaveEvent = () => {
      handleSave();
    };

    window.addEventListener("editor-save", handleSaveEvent);
    return () => window.removeEventListener("editor-save", handleSaveEvent);
  }, [handleSave]);

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
                aria-label="Bold"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  const strongMark = schema.marks.strong;
                  if (!strongMark) return;
                  runCommand(toggleMark(strongMark));
                }}
              >
                <Bold size={14} />
              </button>
              <button
                type="button"
                aria-label="Italic"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  const emMark = schema.marks.em;
                  if (!emMark) return;
                  runCommand(toggleMark(emMark));
                }}
              >
                <Italic size={14} />
              </button>
              <button
                type="button"
                aria-label="Code"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  const codeMark = schema.marks.code;
                  if (!codeMark) return;
                  runCommand(toggleMark(codeMark));
                }}
              >
                <Code size={14} />
              </button>
              <button
                type="button"
                aria-label="Link"
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleToggleLink}
              >
                <Link2 size={14} />
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
                {blockMenuOpen ? <X size={13} /> : <Plus size={13} />}
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
                    onClick={() => insertBlockAfterSelection("code_block")}
                  >
                    Code block
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => insertBlockAfterSelection("blockquote")}
                  >
                    Blockquote
                  </button>
                </div>
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
          <article className="editor-view-markdown" dangerouslySetInnerHTML={{ __html: renderedHtml }} />
        </div>
      )}
    </div>
  );
}
