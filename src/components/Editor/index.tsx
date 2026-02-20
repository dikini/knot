import { useEffect, useRef, useCallback } from "react";
import { initProseMirrorEditor } from "@editor/index";
import { IconButton } from "@components/IconButton";
import { useEditorStore, useVaultStore } from "@lib/store";
import * as api from "@lib/api";
import { Save } from "lucide-react";
import type { ProseMirrorEditor } from "../../types/editor";
import "./Editor.css";

// SPEC: COMP-UI-LAYOUT-002 FR-4
// SPEC: COMP-FRONTEND-001 FR-3, FR-6
// SPEC: COMP-ICON-CHROME-001 FR-2, FR-5
export function Editor() {
  const editorRef = useRef<HTMLDivElement>(null);
  const pmRef = useRef<ProseMirrorEditor | null>(null);
  const initialContentRef = useRef<string>("# New Note\n\nStart writing...");
  const { currentNote, setCurrentNote, shell } = useVaultStore();
  const { content, setContent, markDirty, isDirty, reset } = useEditorStore();

  if (currentNote?.content && initialContentRef.current === "# New Note\n\nStart writing...") {
    initialContentRef.current = currentNote.content;
  }

  // Initialize editor
  useEffect(() => {
    if (!editorRef.current) return;

    const pm = initProseMirrorEditor(editorRef.current, {
      onChange: (state) => {
        setContent(state.markdown);
        markDirty(true);
      },
      initialContent: initialContentRef.current,
    });

    pmRef.current = pm;

    return () => {
      pm.destroy();
      pmRef.current = null;
    };
  }, [setContent, markDirty]);

  // Load note content when currentNote changes
  useEffect(() => {
    if (!pmRef.current || !currentNote) return;

    // Only update if content is different (avoid loops)
    const currentMarkdown = pmRef.current.getMarkdown();
    if (currentMarkdown !== currentNote.content) {
      pmRef.current.setMarkdown(currentNote.content);
      reset();
    }
  }, [currentNote, reset]);

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
              Or create a new note using the + button in the sidebar
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
      <div ref={editorRef} className="editor-container" />
    </div>
  );
}
