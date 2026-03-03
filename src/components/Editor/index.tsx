import { useEffect, useRef, useCallback, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { open as openExternal } from "@tauri-apps/plugin-shell";
import "@lib/pdfjsCompat";
import * as pdfjs from "@lib/pdfjsLegacy";
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
import { renderMarkdownToHtml, renderMermaidDiagrams, toggleTaskListItemInMarkdown } from "@editor/render";
import {
  emptyMetadataDraft,
  parseNoteDocument,
  serializeNoteDocument,
  validateExtraMetadataYaml,
  type NoteMetadataDraft,
} from "@lib/frontmatter";
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
import { flushSync } from "react-dom";
import { schema } from "@editor/schema";
import type { ProseMirrorEditor } from "../../types/editor";
import type { NoteData, NoteModeAvailability } from "../../types/vault";
import "./Editor.css";

const UI_AUTOMATION_EDITOR_REQUEST_EVENT = "ui-automation-editor-request";
const UI_AUTOMATION_EDITOR_RESULT_EVENT = "ui-automation-editor-result";

type UiAutomationEditorMode = "meta" | "view" | "edit" | "source";

interface UiAutomationEditorRequestDetail {
  requestId: string;
  actionId?: string;
  behaviorId?: string;
  path: string;
  taskIndex?: number;
  mode?: UiAutomationEditorMode;
}

interface UiAutomationEditorResultDetail {
  requestId: string;
  success: boolean;
  message: string;
  payload?: Record<string, unknown>;
  errorCode?: string;
}

// SPEC: COMP-UI-LAYOUT-002 FR-4
// SPEC: COMP-FRONTEND-001 FR-3, FR-6
// SPEC: COMP-ICON-CHROME-001 FR-2, FR-5
// SPEC: COMP-EDITOR-MODES-001 FR-1, FR-2, FR-3, FR-4, FR-5, FR-6, FR-7, FR-9, FR-11
// TRACE: DESIGN-editor-medium-like-interactions
// TRACE: DESIGN-editor-wikilink-ux-003
interface EditorProps {
  appKeymapSettings?: AppKeymapSettings;
}

async function loadPdfDocument(data: Uint8Array) {
  return await pdfjs.getDocument({ data }).promise;
}

pdfjs.GlobalWorkerOptions.workerSrc = new URL("../../lib/pdfjsWorkerEntry.ts", import.meta.url).toString();

export function Editor({ appKeymapSettings = DEFAULT_APP_KEYMAP_SETTINGS }: EditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const editContainerRef = useRef<HTMLDivElement>(null);
  const pmRef = useRef<ProseMirrorEditor | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const blockMenuRef = useRef<HTMLDivElement>(null);
  const blockToggleRef = useRef<HTMLButtonElement>(null);
  const viewArticleRef = useRef<HTMLElement>(null);
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const initialContentRef = useRef<string>("# New Note\n\nStart writing...");
  const metadataDraftRef = useRef<NoteMetadataDraft>(emptyMetadataDraft());
  const extraMetadataYamlRef = useRef("");
  const embedNoteCacheRef = useRef<Map<string, NoteData>>(new Map());
  const { currentNote, setCurrentNote, loadNote, noteList, shell } = useVaultStore();
  const { content, setContent, markDirty, isDirty, reset } = useEditorStore();
  const [editorMode, setEditorMode] = useState<"meta" | "source" | "edit" | "view">(() =>
    currentNote?.available_modes
      ? defaultEditorMode(currentNote.available_modes)
      : "edit"
  );
  const [metadataDraft, setMetadataDraft] = useState<NoteMetadataDraft>(emptyMetadataDraft());
  const [extraMetadataYaml, setExtraMetadataYaml] = useState("");
  const [metaValidationError, setMetaValidationError] = useState<string | null>(null);
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
  const [pdfPageCount, setPdfPageCount] = useState<number>(0);
  const [pdfPageNumber, setPdfPageNumber] = useState<number>(1);
  const [pdfZoom, setPdfZoom] = useState<number>(1);
  const [pdfFitWidth, setPdfFitWidth] = useState<number>(0);
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
  const [pdfDocument, setPdfDocument] = useState<Awaited<ReturnType<typeof loadPdfDocument>> | null>(null);
  const [pdfStatus, setPdfStatus] = useState<"idle" | "reading" | "document_loading" | "document_ready" | "rendering" | "ready" | "error">("idle");
  const [pdfLoadError, setPdfLoadError] = useState<string | null>(null);
  const managedShortcuts = useMemo(() => expandManagedShortcutMap(appKeymapSettings), [appKeymapSettings]);

  const noteScopedModeKey = currentNote ? `knot:editor-mode:${currentNote.path}` : null;
  const noteModeAvailability = useMemo<NoteModeAvailability>(
    () =>
      currentNote?.available_modes ?? {
        meta: true,
        source: true,
        edit: true,
        view: true,
      },
    [currentNote]
  );
  const currentNoteType = currentNote?.note_type ?? "markdown";
  const isViewOnlyNoteType = currentNoteType === "pdf" || currentNoteType === "image" || currentNoteType === "unknown";
  const youtubeMetadata = useMemo(() => {
    const extra = currentNote?.metadata?.extra ?? {};
    if (currentNoteType !== "youtube") {
      return null;
    }
    return {
      title:
        typeof extra.youtube_title === "string" && extra.youtube_title.trim().length > 0
          ? extra.youtube_title
          : currentNote?.title ?? "YouTube Video",
      watchUrl: typeof extra.youtube_url === "string" ? extra.youtube_url : "",
      thumbnailUrl: typeof extra.youtube_thumbnail_url === "string" ? extra.youtube_thumbnail_url : "",
    };
  }, [currentNote?.metadata?.extra, currentNote?.title, currentNoteType]);
  const imageSrc =
    currentNoteType === "image" && currentNote?.media?.file_path
      ? toRenderableFileSrc(currentNote.media.file_path)
      : null;

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

  const effectiveRawMarkdown = isDirty ? content : (content || currentNote?.content || "");
  const parsedDocument = useMemo(() => {
    try {
      return {
        ...parseNoteDocument(effectiveRawMarkdown),
        error: null as string | null,
      };
    } catch (error) {
      return {
        body: effectiveRawMarkdown,
        managed: emptyMetadataDraft(),
        extra: "",
        hasFrontmatter: false,
        error: error instanceof Error ? error.message : "Invalid front matter",
      };
    }
  }, [effectiveRawMarkdown]);

  if (currentNote?.content && initialContentRef.current === "# New Note\n\nStart writing...") {
    initialContentRef.current = parsedDocument.body || currentNote.content;
  }

  useEffect(() => {
    if (!noteScopedModeKey) {
      setEditorMode(defaultEditorMode(noteModeAvailability));
      return;
    }
    if (isViewOnlyNoteType) {
      setEditorMode("view");
      return;
    }
    const stored = localStorage.getItem(noteScopedModeKey);
    if (
      (stored === "meta" || stored === "source" || stored === "edit" || stored === "view") &&
      noteModeAvailability[stored]
    ) {
      setEditorMode(stored);
      return;
    }
    setEditorMode(defaultEditorMode(noteModeAvailability));
  }, [isViewOnlyNoteType, noteModeAvailability, noteScopedModeKey]);

  useEffect(() => {
    if (!noteScopedModeKey) return;
    localStorage.setItem(noteScopedModeKey, editorMode);
  }, [editorMode, noteScopedModeKey]);

  useEffect(() => {
    setPdfPageCount(0);
    setPdfPageNumber(1);
    setPdfZoom(1);
    setPdfData(null);
    setPdfDocument(null);
    setPdfStatus("idle");
    setPdfLoadError(null);
  }, [currentNote?.path]);

  useEffect(() => {
    if (editorMode !== "view" || currentNoteType !== "pdf" || !pdfContainerRef.current) {
      return;
    }

    const syncWidth = () => {
      const width = pdfContainerRef.current?.clientWidth ?? 0;
      if (width > 0) {
        setPdfFitWidth(width);
      }
    };

    syncWidth();

    const observer =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => syncWidth()) : undefined;
    if (pdfContainerRef.current) {
      observer?.observe(pdfContainerRef.current);
    }

    return () => observer?.disconnect();
  }, [currentNoteType, editorMode]);

  useEffect(() => {
    if (currentNoteType !== "pdf" || !currentNote?.media?.file_path) {
      return;
    }

    let cancelled = false;
    setPdfStatus("reading");
    setPdfLoadError(null);

    const mediaUrl = toRenderableFileSrc(currentNote.media.file_path);

    void fetch(mediaUrl)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Media fetch failed with status ${response.status}`);
        }
        const buffer = await response.arrayBuffer();
        if (cancelled) {
          return;
        }
        setPdfData(new Uint8Array(buffer));
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setPdfData(null);
        setPdfStatus("error");
        setPdfLoadError(error instanceof Error ? error.message : "Failed to load PDF file.");
      });

    return () => {
      cancelled = true;
    };
  }, [currentNote?.media?.file_path, currentNoteType]);

  useEffect(() => {
    if (!pdfData) {
      setPdfDocument(null);
      return;
    }

    let cancelled = false;
    setPdfStatus("document_loading");
    setPdfLoadError(null);

    void loadPdfDocument(pdfData)
      .then((document) => {
        if (cancelled) {
          void document.destroy();
          return;
        }
        setPdfDocument(document);
        setPdfPageCount(document.numPages);
        setPdfPageNumber((page) => Math.min(page, document.numPages || 1));
        setPdfStatus("document_ready");
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        setPdfDocument(null);
        setPdfPageCount(0);
        setPdfStatus("error");
        setPdfLoadError(error instanceof Error ? error.message : "Failed to load PDF file.");
      });

    return () => {
      cancelled = true;
    };
  }, [pdfData]);

  useEffect(() => {
    if (currentNoteType !== "pdf" || editorMode !== "view" || !pdfDocument || !pdfCanvasRef.current) {
      return;
    }

    let cancelled = false;
    let currentRenderTask: { cancel?: () => void; promise?: Promise<unknown> } | null = null;

    const renderPage = async () => {
      try {
        setPdfStatus("rendering");
        const page = await pdfDocument.getPage(pdfPageNumber);
        if (cancelled || !pdfCanvasRef.current) {
          return;
        }

        const unscaledViewport = page.getViewport({ scale: 1 });
        const fitScale = pdfFitWidth > 0 ? pdfFitWidth / unscaledViewport.width : 1;
        const scale = Math.max(0.1, fitScale * pdfZoom);
        const viewport = page.getViewport({ scale });
        const canvas = pdfCanvasRef.current;
        const context = canvas.getContext("2d");
        if (!context) {
          throw new Error("Canvas 2D context is unavailable");
        }

        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        canvas.style.width = `${Math.ceil(viewport.width)}px`;
        canvas.style.height = `${Math.ceil(viewport.height)}px`;

        currentRenderTask = page.render({
          canvas,
          canvasContext: context,
          viewport,
        });
        await currentRenderTask.promise;

        if (!cancelled) {
          setPdfStatus("ready");
          setPdfLoadError(null);
        }
      } catch (error) {
        if (cancelled) {
          return;
        }
        const message = error instanceof Error ? error.message : "Failed to render PDF page.";
        if (!message.toLowerCase().includes("cancelled")) {
          setPdfStatus("error");
          setPdfLoadError(message);
        }
      }
    };

    void renderPage();

    return () => {
      cancelled = true;
      currentRenderTask?.cancel?.();
    };
  }, [currentNoteType, editorMode, pdfDocument, pdfFitWidth, pdfPageNumber, pdfZoom]);

  useEffect(() => {
    if (!currentNote) return;
    setContent(currentNote.content);
    markDirty(false);
    try {
      const parsed = parseNoteDocument(currentNote.content);
      setMetadataDraft(parsed.managed);
      setExtraMetadataYaml(parsed.extra);
      setMetaValidationError(null);
    } catch (error) {
      setMetadataDraft(emptyMetadataDraft());
      setExtraMetadataYaml("");
      setMetaValidationError(error instanceof Error ? error.message : "Invalid front matter");
    }
  }, [currentNote, markDirty, setContent]);

  useEffect(() => {
    metadataDraftRef.current = metadataDraft;
    extraMetadataYamlRef.current = extraMetadataYaml;
  }, [metadataDraft, extraMetadataYaml]);

  const getBodyMarkdown = useCallback((markdown: string) => {
    try {
      return parseNoteDocument(markdown).body;
    } catch {
      return markdown;
    }
  }, []);

  const syncMetaDraftFromMarkdown = useCallback((markdown: string) => {
    try {
      const parsed = parseNoteDocument(markdown);
      setMetadataDraft(parsed.managed);
      setExtraMetadataYaml(parsed.extra);
      setMetaValidationError(null);
    } catch (error) {
      setMetadataDraft(emptyMetadataDraft());
      setExtraMetadataYaml("");
      setMetaValidationError(error instanceof Error ? error.message : "Invalid front matter");
    }
  }, []);

  const commitMetadataToContent = useCallback(
    (nextManaged: NoteMetadataDraft, nextExtraYaml: string) => {
      const validationError = validateExtraMetadataYaml(nextExtraYaml);
      setMetadataDraft(nextManaged);
      setExtraMetadataYaml(nextExtraYaml);
      setMetaValidationError(validationError);
      useEditorStore.setState((previous) => ({
        ...previous,
        isDirty: true,
      }));
      markDirty(true);

      if (validationError) {
        return false;
      }

      const serialized = serializeNoteDocument({
        body: parsedDocument.body,
        managed: nextManaged,
        extraYaml: nextExtraYaml,
      });
      setContent(serialized);
      useEditorStore.setState((previous) => ({
        ...previous,
        content: serialized,
        isDirty: true,
      }));
      return true;
    },
    [markDirty, parsedDocument.body, setContent]
  );

  const handleModeChange = useCallback(
    (nextMode: "meta" | "source" | "edit" | "view") => {
      if (!noteModeAvailability[nextMode]) {
        return;
      }
      if (nextMode === "meta") {
        syncMetaDraftFromMarkdown(effectiveRawMarkdown);
      }
      setEditorMode(nextMode);
    },
    [effectiveRawMarkdown, noteModeAvailability, syncMetaDraftFromMarkdown]
  );

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
    if (editorMode !== "edit" || !noteModeAvailability.edit) {
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
        const serialized = serializeNoteDocument({
          body: state.markdown,
          managed: metadataDraftRef.current,
          extraYaml: extraMetadataYamlRef.current,
        });
        setContent(serialized);
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
        getBodyMarkdown(useEditorStore.getState().content || currentNote.content || initialContentRef.current) ||
        initialContentRef.current,
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
  }, [
    editorMode,
    currentNote,
    getBodyMarkdown,
    markDirty,
    setContent,
    updateHistoryAvailability,
    updateWikilinkSuggest,
    noteModeAvailability.edit,
  ]);

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
    const currentBody = getBodyMarkdown(currentNote.content);
    if (currentMarkdown !== currentBody) {
      pmRef.current.setMarkdown(currentBody);
      reset();
    }
  }, [currentNote, editorMode, getBodyMarkdown, isDirty, reset]);

  const renderedHtml = useMemo(
    () => renderMarkdownToHtml(parsedDocument.body),
    [parsedDocument.body]
  );
  const [renderedViewHtml, setRenderedViewHtml] = useState(renderedHtml);

  useEffect(() => {
    if (editorMode !== "view" || !viewArticleRef.current) return;
    void renderMermaidDiagrams(viewArticleRef.current);
  });

  useEffect(() => {
    let cancelled = false;

    if (editorMode !== "view") {
      setRenderedViewHtml(renderedHtml);
      return;
    }

    if (!renderedHtml.includes('data-embed="true"')) {
      setRenderedViewHtml(renderedHtml);
      return;
    }

    void buildRenderedHtmlWithEmbeds(renderedHtml, noteList, embedNoteCacheRef.current).then((nextHtml) => {
      if (!cancelled) {
        setRenderedViewHtml(nextHtml);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [editorMode, renderedHtml, noteList]);

  // Save note handler
  const handleSave = useCallback(async () => {
    if (!currentNote || !isDirty || metaValidationError) return;

    try {
      await api.saveNote(currentNote.path, effectiveRawMarkdown);
      useEditorStore.setState((previous) => ({
        ...previous,
        isDirty: false,
      }));
      markDirty(false);

      // Update current note in store
      const updatedNote = await api.getNote(currentNote.path);
      setCurrentNote(updatedNote);

      // Refresh note list
      await useVaultStore.getState().loadNotes();
    } catch (error) {
      console.error("Failed to save note:", error);
      alert(`Failed to save: ${error}`);
    }
  }, [currentNote, effectiveRawMarkdown, isDirty, markDirty, metaValidationError, setCurrentNote]);

  const handleOpenYouTube = useCallback(async () => {
    const watchUrl = youtubeMetadata?.watchUrl;
    if (!watchUrl) {
      return;
    }
    try {
      await openExternal(watchUrl);
    } catch (error) {
      console.error("Failed to open YouTube video externally", error);
    }
  }, [youtubeMetadata?.watchUrl]);

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

  useEffect(() => {
    const emitResult = (detail: UiAutomationEditorResultDetail) => {
      window.dispatchEvent(new CustomEvent<UiAutomationEditorResultDetail>(UI_AUTOMATION_EDITOR_RESULT_EVENT, { detail }));
    };

    const handleUiAutomationRequest = async (event: Event) => {
      const custom = event as CustomEvent<UiAutomationEditorRequestDetail>;
      const detail = custom.detail;
      if (!detail) {
        return;
      }

      if (detail.actionId === "core.select.editor-mode") {
        if (!currentNote || currentNote.path !== detail.path) {
          emitResult({
            requestId: detail.requestId,
            success: false,
            message: "Editor note context is not ready for mode automation",
            errorCode: "UI_TARGET_UNAVAILABLE",
          });
          return;
        }

        const targetMode = detail.mode;
        if (targetMode !== "meta" && targetMode !== "view" && targetMode !== "edit" && targetMode !== "source") {
          emitResult({
            requestId: detail.requestId,
            success: false,
            message: "Invalid editor mode",
            errorCode: "UI_ACTION_INVALID_ARGUMENTS",
          });
          return;
        }
        if (!noteModeAvailability[targetMode]) {
          emitResult({
            requestId: detail.requestId,
            success: false,
            message: `Editor mode is unavailable: ${targetMode}`,
            errorCode: "UI_TARGET_UNAVAILABLE",
          });
          return;
        }

        flushSync(() => {
          handleModeChange(targetMode);
        });
        await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
        emitResult({
          requestId: detail.requestId,
          success: true,
          message: `Switched editor mode to ${targetMode}`,
          payload: {
            active_note_path: currentNote.path,
            active_view: "view.editor",
            editor_mode: targetMode,
          },
        });
        return;
      }

      if (detail.behaviorId !== "core.task.toggle") {
        return;
      }

      if (!currentNote || currentNote.path !== detail.path) {
        emitResult({
          requestId: detail.requestId,
          success: false,
          message: "Editor note context is not ready for task automation",
          errorCode: "UI_TARGET_UNAVAILABLE",
        });
        return;
      }

      const targetMode = detail.mode ?? "view";
      if (targetMode !== "meta" && targetMode !== "view" && targetMode !== "edit" && targetMode !== "source") {
        emitResult({
          requestId: detail.requestId,
          success: false,
          message: "Invalid editor mode",
          errorCode: "UI_ACTION_INVALID_ARGUMENTS",
        });
        return;
      }
      if (!noteModeAvailability[targetMode]) {
        emitResult({
          requestId: detail.requestId,
          success: false,
          message: `Editor mode is unavailable: ${targetMode}`,
          errorCode: "UI_TARGET_UNAVAILABLE",
        });
        return;
      }

      const sourceMarkdown = useEditorStore.getState().content || currentNote.content || "";
      if (!Number.isInteger(detail.taskIndex) || Number(detail.taskIndex) < 0) {
        emitResult({
          requestId: detail.requestId,
          success: false,
          message: "taskIndex must be a non-negative integer",
          errorCode: "UI_ACTION_INVALID_ARGUMENTS",
        });
        return;
      }

      const taskIndex = Number(detail.taskIndex);
      const nextBody = toggleTaskListItemInMarkdown(getBodyMarkdown(sourceMarkdown), taskIndex);
      if (!nextBody) {
        emitResult({
          requestId: detail.requestId,
          success: false,
          message: `Task index not found: ${taskIndex}`,
          errorCode: "UI_TARGET_NOT_FOUND",
        });
        return;
      }

      const serialized = serializeNoteDocument({
        body: nextBody,
        managed: metadataDraftRef.current,
        extraYaml: extraMetadataYamlRef.current,
      });
      flushSync(() => {
        handleModeChange(targetMode);
        setContent(serialized);
        useEditorStore.setState((previous) => ({
          ...previous,
          content: serialized,
          isDirty: true,
        }));
        markDirty(true);
      });

      if (targetMode === "edit" && pmRef.current) {
        pmRef.current.setMarkdown(nextBody);
      }

      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));

      emitResult({
        requestId: detail.requestId,
        success: true,
        message: `Toggled task ${detail.taskIndex} in ${currentNote.path}`,
        payload: {
          active_note_path: currentNote.path,
          editor_mode: targetMode,
          task_index: taskIndex,
        },
      });
    };

    window.addEventListener(UI_AUTOMATION_EDITOR_REQUEST_EVENT, handleUiAutomationRequest as EventListener);
    return () =>
      window.removeEventListener(UI_AUTOMATION_EDITOR_REQUEST_EVENT, handleUiAutomationRequest as EventListener);
  }, [currentNote, getBodyMarkdown, handleModeChange, markDirty, noteModeAvailability, setContent]);

  const handleRenderedMarkdownClick = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      const targetElement = event.target as HTMLElement | null;
      if (!targetElement) return;

      const checkbox = targetElement.closest<HTMLInputElement>("input[data-task-checkbox='true']");
      if (checkbox) {
        const taskItem = checkbox.closest<HTMLElement>("li[data-task-index]");
        const taskIndex = Number(taskItem?.dataset.taskIndex);
        if (Number.isInteger(taskIndex) && taskIndex >= 0) {
          const nextBody = toggleTaskListItemInMarkdown(parsedDocument.body, taskIndex);
          if (nextBody) {
            const serialized = serializeNoteDocument({
              body: nextBody,
              managed: metadataDraftRef.current,
              extraYaml: extraMetadataYamlRef.current,
            });
            setContent(serialized);
            useEditorStore.setState((previous) => ({
              ...previous,
              content: serialized,
              isDirty: true,
            }));
            markDirty(true);
          }
        }
        event.preventDefault();
        return;
      }

      const anchor = targetElement.closest("a") as HTMLAnchorElement | null;
      if (!anchor) return;

      const wikilinkTarget = anchor.getAttribute("data-wikilink");
      if (wikilinkTarget) {
        event.preventDefault();
        void followOrCreateWikilinkTarget(wikilinkTarget);
        return;
      }

      const secondaryNotePath =
        anchor.closest<HTMLElement>("[data-embed-secondary-note-path]")?.dataset.embedSecondaryNotePath ?? null;
      if (event.shiftKey && secondaryNotePath) {
        event.preventDefault();
        void loadNote(secondaryNotePath);
        return;
      }

      const embedNotePath = anchor.dataset.embedNotePath;
      if (embedNotePath) {
        event.preventDefault();
        void loadNote(embedNotePath);
        return;
      }

      const embedExternalUrl = anchor.dataset.embedExternalUrl;
      if (embedExternalUrl) {
        event.preventDefault();
        void openExternal(embedExternalUrl);
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
    [followOrCreateWikilinkTarget, loadNote, markDirty, parsedDocument.body, setContent]
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
              aria-selected={editorMode === "meta"}
              className={`editor-toolbar__mode-btn ${editorMode === "meta" ? "is-active" : ""}`}
              disabled={!noteModeAvailability.meta}
              onClick={() => handleModeChange("meta")}
            >
              Meta
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={editorMode === "source"}
              className={`editor-toolbar__mode-btn ${editorMode === "source" ? "is-active" : ""}`}
              disabled={!noteModeAvailability.source}
              onClick={() => handleModeChange("source")}
            >
              Source
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={editorMode === "edit"}
              className={`editor-toolbar__mode-btn ${editorMode === "edit" ? "is-active" : ""}`}
              disabled={!noteModeAvailability.edit}
              onClick={() => handleModeChange("edit")}
            >
              Edit
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={editorMode === "view"}
              className={`editor-toolbar__mode-btn ${editorMode === "view" ? "is-active" : ""}`}
              disabled={!noteModeAvailability.view}
              onClick={() => handleModeChange("view")}
            >
              View
            </button>
          </div>
          <IconButton
            icon={Save}
            label={isDirty ? "Save" : "Saved"}
            className="editor-toolbar__save"
            showLabel={shell.showTextLabels}
            disabled={!isDirty || Boolean(metaValidationError)}
            onClick={handleSave}
          />
        </div>
      </div>
      {editorMode === "meta" && (
        <div className="editor-container editor-container--meta">
          {isViewOnlyNoteType ? (
            <div className="editor-meta-empty">
              <p>No metadata fields are available for this note type yet.</p>
            </div>
          ) : (
          <form className="editor-meta-form" onSubmit={(event) => event.preventDefault()}>
            {/* TRACE: DESIGN-note-metadata-frontmatter-011 */}
            <label className="editor-meta-form__field editor-meta-form__field--wide">
              <span>Description</span>
              <textarea
                aria-label="Description"
                value={metadataDraft.description}
                onChange={(event) =>
                  commitMetadataToContent(
                    { ...metadataDraft, description: event.target.value },
                    extraMetadataYaml
                  )
                }
              />
            </label>
            <label className="editor-meta-form__field">
              <span>Author</span>
              <input
                aria-label="Author"
                value={metadataDraft.author}
                onChange={(event) =>
                  commitMetadataToContent(
                    { ...metadataDraft, author: event.target.value },
                    extraMetadataYaml
                  )
                }
              />
            </label>
            <label className="editor-meta-form__field">
              <span>Email</span>
              <input
                aria-label="Email"
                value={metadataDraft.email}
                onChange={(event) =>
                  commitMetadataToContent(
                    { ...metadataDraft, email: event.target.value },
                    extraMetadataYaml
                  )
                }
              />
            </label>
            <label className="editor-meta-form__field">
              <span>Version</span>
              <input
                aria-label="Version"
                value={metadataDraft.version}
                onChange={(event) =>
                  commitMetadataToContent(
                    { ...metadataDraft, version: event.target.value },
                    extraMetadataYaml
                  )
                }
              />
            </label>
            <label className="editor-meta-form__field">
              <span>Tags</span>
              <input
                aria-label="Tags"
                value={metadataDraft.tagsText}
                onChange={(event) =>
                  commitMetadataToContent(
                    { ...metadataDraft, tagsText: event.target.value },
                    extraMetadataYaml
                  )
                }
              />
            </label>
            <label className="editor-meta-form__field editor-meta-form__field--wide">
              <span>Extra YAML</span>
              <textarea
                aria-label="Extra YAML"
                value={extraMetadataYaml}
                onChange={(event) => commitMetadataToContent(metadataDraft, event.target.value)}
              />
            </label>
            {metaValidationError && <p className="editor-meta-form__error">{metaValidationError}</p>}
          </form>
          )}
        </div>
      )}
      {editorMode === "edit" && (
        <div ref={editContainerRef} className="editor-container editor-container--edit">
          {currentNoteType === "youtube" && youtubeMetadata?.thumbnailUrl ? (
            <div className="editor-youtube-card editor-youtube-card--thumbnail editor-youtube-card--edit">
              <img
                className="editor-youtube-card__thumbnail"
                src={youtubeMetadata.thumbnailUrl}
                alt={`${youtubeMetadata.title} thumbnail`}
              />
            </div>
          ) : null}
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
            value={effectiveRawMarkdown}
            onChange={(event) => {
              setContent(event.target.value);
              markDirty(true);
            }}
          />
        </div>
      )}
      {editorMode === "view" && (
        <div className="editor-container editor-container--view">
          {currentNoteType === "youtube" && youtubeMetadata ? (
            <>
              {youtubeMetadata.thumbnailUrl ? (
                <button
                  type="button"
                  className="editor-youtube-card editor-youtube-card--link editor-youtube-card--view"
                  aria-label={`Open ${youtubeMetadata.title} on YouTube`}
                  onClick={() => void handleOpenYouTube()}
                >
                  <img
                    className="editor-youtube-card__thumbnail"
                    src={youtubeMetadata.thumbnailUrl}
                    alt={`${youtubeMetadata.title} thumbnail`}
                  />
                </button>
              ) : null}
              <article
                ref={viewArticleRef}
                className="editor-view-markdown"
                onClick={handleRenderedMarkdownClick}
                dangerouslySetInnerHTML={{ __html: renderedViewHtml }}
              />
            </>
          ) : currentNoteType === "image" && imageSrc ? (
            <div className="editor-media-view">
              <img
                className="editor-media-view__image"
                src={imageSrc}
                alt={currentNote.title || currentNote.path}
              />
            </div>
          ) : currentNoteType === "pdf" && currentNote?.media?.file_path ? (
            <div
              ref={pdfContainerRef}
              className="editor-pdf-view"
              data-ui-automation-pdf-status={pdfStatus}
              data-ui-automation-pdf-error={pdfLoadError ?? ""}
              data-ui-automation-pdf-page-count={pdfPageCount > 0 ? String(pdfPageCount) : ""}
              data-ui-automation-pdf-page-number={String(pdfPageNumber)}
            >
              <div className="editor-pdf-view__toolbar" role="toolbar" aria-label="PDF controls">
                <button
                  type="button"
                  className="editor-pdf-view__button"
                  onClick={() => setPdfPageNumber((page) => Math.max(1, page - 1))}
                  disabled={pdfPageNumber <= 1}
                >
                  Previous page
                </button>
                <span className="editor-pdf-view__status">
                  Page {pdfPageNumber} of {pdfPageCount || "?"}
                </span>
                <button
                  type="button"
                  className="editor-pdf-view__button"
                  onClick={() => setPdfPageNumber((page) => Math.min(pdfPageCount || page, page + 1))}
                  disabled={pdfPageCount === 0 || pdfPageNumber >= pdfPageCount}
                >
                  Next page
                </button>
                <div className="editor-pdf-view__spacer" />
                <button
                  type="button"
                  className="editor-pdf-view__button"
                  onClick={() => setPdfZoom((zoom) => Math.max(0.5, Number((zoom - 0.1).toFixed(2))))}
                >
                  Zoom out
                </button>
                <span className="editor-pdf-view__status">{Math.round(pdfZoom * 100)}%</span>
                <button
                  type="button"
                  className="editor-pdf-view__button"
                  onClick={() => setPdfZoom((zoom) => Math.min(3, Number((zoom + 0.1).toFixed(2))))}
                >
                  Zoom in
                </button>
                <button
                  type="button"
                  className="editor-pdf-view__button"
                  onClick={() => setPdfZoom(1)}
                >
                  Fit width
                </button>
              </div>
              <div className="editor-pdf-view__canvas">
                {pdfLoadError ? (
                  <div className="editor-pdf-view__loading">Failed to load PDF file: {pdfLoadError}</div>
                ) : pdfDocument ? (
                  <canvas ref={pdfCanvasRef} data-testid="pdf-canvas" />
                ) : (
                  <div className="editor-pdf-view__loading">Loading PDF…</div>
                )}
              </div>
            </div>
          ) : currentNoteType === "unknown" ? (
            <div className="editor-meta-empty">
              <p>Unknown file type. This file can be viewed in the explorer but cannot be edited in Knot yet.</p>
            </div>
          ) : (
            <article
              ref={viewArticleRef}
              className="editor-view-markdown"
              onClick={handleRenderedMarkdownClick}
              dangerouslySetInnerHTML={{ __html: renderedViewHtml }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function defaultEditorMode(availability: NoteModeAvailability): "meta" | "source" | "edit" | "view" {
  if (availability.edit) return "edit";
  if (availability.view) return "view";
  if (availability.meta) return "meta";
  return "source";
}

function toRenderableFileSrc(filePath: string): string {
  if (/^(https?:)?\/\//i.test(filePath) || filePath.startsWith("data:")) {
    return filePath;
  }
  try {
    return convertFileSrc(filePath);
  } catch {
    return filePath;
  }
}

function setEmbedActionData(element: HTMLElement, action?: { path?: string | null; url?: string | null } | null): void {
  if (!action) {
    return;
  }

  if (action.path) {
    element.dataset.embedNotePath = action.path;
  }
  if (action.url) {
    element.dataset.embedExternalUrl = action.url;
  }
}

function createEmbedLinkElement(
  action: { path?: string | null; url?: string | null } | null | undefined,
  text: string,
  options?: { pdfIndicator?: boolean }
): HTMLElement {
  const anchor = document.createElement("a");
  anchor.className = "editor-embed__title";
  anchor.href = action?.url ?? (action?.path ? `#${action.path}` : "#");
  setEmbedActionData(anchor, action);

  const label = document.createElement("span");
  label.textContent = text;
  anchor.appendChild(label);

  if (options?.pdfIndicator) {
    const badge = document.createElement("span");
    badge.className = "editor-embed__file-badge";
    badge.setAttribute("aria-hidden", "true");
    badge.textContent = "PDF";
    anchor.appendChild(document.createTextNode(" "));
    anchor.appendChild(badge);

    const accessible = document.createElement("span");
    accessible.className = "editor-embed__sr-only";
    accessible.textContent = " PDF document";
    anchor.appendChild(accessible);
  }

  return anchor;
}

function createEmbeddedNoteElement(note: NoteData): HTMLElement | null {
  const embed = note.embed;
  if (!embed) {
    return null;
  }

  const container = document.createElement("div");
  container.className = `editor-embed editor-embed--${embed.shape.kind}`;
  container.dataset.embedKind = embed.shape.kind;
  if (embed.secondary_action?.path) {
    container.dataset.embedSecondaryNotePath = embed.secondary_action.path;
  }

    switch (embed.shape.kind) {
    case "link": {
      container.appendChild(
        createEmbedLinkElement(embed.primary_action, embed.shape.title, {
          pdfIndicator: note.note_type === "pdf",
        })
      );
      if (embed.shape.description) {
        const description = document.createElement("blockquote");
        description.className = "editor-embed__description";
        description.textContent = embed.shape.description;
        container.appendChild(description);
      }
      return container;
    }
    case "image": {
      const media = document.createElement(embed.primary_action ? "a" : "div");
      media.className = "editor-embed__media";
      if (media instanceof HTMLAnchorElement) {
        media.href = embed.primary_action.url ?? (embed.primary_action.path ? `#${embed.primary_action.path}` : "#");
        setEmbedActionData(media, embed.primary_action);
      }

      const image = document.createElement("img");
      image.className = "editor-embed__image";
      image.src = toRenderableFileSrc(embed.shape.src);
      image.alt = embed.shape.alt ?? embed.shape.title ?? note.title;
      media.appendChild(image);
      container.appendChild(media);

      if (embed.shape.title) {
        container.appendChild(createEmbedLinkElement(embed.primary_action, embed.shape.title));
      }
      if (embed.shape.description) {
        const description = document.createElement("div");
        description.className = "editor-embed__description";
        description.textContent = embed.shape.description;
        container.appendChild(description);
      }
      return container;
    }
    case "canvas":
    case "iframe":
      return null;
    default:
      return null;
  }
}

async function buildRenderedHtmlWithEmbeds(
  baseHtml: string,
  noteList: ReturnType<typeof useVaultStore.getState>["noteList"],
  cache: Map<string, NoteData>
): Promise<string> {
  const container = document.createElement("div");
  container.innerHTML = baseHtml;

  const targets = Array.from(
    container.querySelectorAll<HTMLAnchorElement>("a[data-wikilink][data-embed='true']")
  );

  await Promise.all(
    targets.map(async (anchor) => {
      const target = anchor.getAttribute("data-wikilink")?.trim();
      if (!target) {
        return;
      }

      const resolvedPath = resolveWikilinkTargetPath(noteList, target);
      if (!resolvedPath) {
        return;
      }

      let embeddedNote = cache.get(resolvedPath);
      if (!embeddedNote) {
        embeddedNote = await api.getNote(resolvedPath);
        cache.set(resolvedPath, embeddedNote);
      }

      const replacement = createEmbeddedNoteElement(embeddedNote);
      if (!replacement) {
        return;
      }

      anchor.replaceWith(replacement);
    })
  );

  return container.innerHTML;
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
