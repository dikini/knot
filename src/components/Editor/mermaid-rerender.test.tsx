import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEditorStore, useVaultStore } from "@lib/store";

const mockInitProseMirrorEditor = vi.fn();
const mockRenderMermaidDiagrams = vi.fn<(root: HTMLElement) => Promise<void>>(async () => {});

vi.mock("@lib/api");
vi.mock("@editor/index", () => ({
  initProseMirrorEditor: (...args: unknown[]) => mockInitProseMirrorEditor(...args),
}));
vi.mock("@editor/render", () => ({
  renderMarkdownToHtml: () =>
    '<h1>Test mermaid</h1><div class="editor-mermaid" data-mermaid-diagram="true"><pre class="editor-mermaid__source"><code>flowchart TD</code></pre></div>',
  renderMermaidDiagrams: (root: HTMLElement) => mockRenderMermaidDiagrams(root),
  toggleTaskListItemInMarkdown: vi.fn(),
}));
vi.mock("@tauri-apps/plugin-shell", () => ({
  open: vi.fn(),
}));
vi.mock("@lib/pdfjsLegacy", () => ({
  getDocument: vi.fn(),
  PDFWorker: class MockPdfWorker {
    destroy() {}
  },
  GlobalWorkerOptions: {},
}));

import { Editor } from "./index";

describe("Editor Mermaid rerender hydration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    mockInitProseMirrorEditor.mockReturnValue({
      destroy: vi.fn(),
      getMarkdown: vi.fn(() => "# Test mermaid\n\n```mermaid\nflowchart TD\n```"),
      setMarkdown: vi.fn(),
      view: {
        dom: document.createElement("div"),
        state: {
          selection: {
            from: 1,
            to: 1,
            empty: true,
          },
        },
        dispatch: vi.fn(),
        focus: vi.fn(),
        coordsAtPos: vi.fn(() => ({ left: 0, right: 0, top: 0, bottom: 0 })),
      },
    });

    useVaultStore.setState({
      vault: null,
      currentNote: {
        id: "1",
        path: "Test mermaid.md",
        title: "Test mermaid",
        content: "# Test mermaid\n\n```mermaid\nflowchart TD\n```",
        created_at: Date.now() / 1000,
        modified_at: Date.now() / 1000,
        word_count: 5,
        headings: [],
        backlinks: [],
      },
      noteList: [],
      isLoading: false,
      error: null,
      setVault: vi.fn(),
      setCurrentNote: vi.fn(),
      setNoteList: vi.fn(),
      setLoading: vi.fn(),
      setError: vi.fn(),
      openVault: vi.fn(),
      closeVault: vi.fn(),
      loadNotes: vi.fn(),
      loadNote: vi.fn(),
      saveCurrentNote: vi.fn(),
      hasVault: vi.fn(() => false),
      hasNote: vi.fn(() => true),
    });

    useEditorStore.setState({
      content: "# Test mermaid\n\n```mermaid\nflowchart TD\n```",
      isDirty: false,
      cursorPosition: 0,
      setContent: vi.fn(),
      markDirty: vi.fn(),
      setCursorPosition: vi.fn(),
      reset: vi.fn(),
    });
  });

  it("rehydrates Mermaid after a parent rerender in view mode", async () => {
    const firstSettings = {
      keymaps: {
        general: {
          save_note: "Mod-s",
          switch_notes: "Mod-1",
          switch_search: "Mod-2",
          switch_graph: "Mod-3",
        },
        editor: {
          undo: "Mod-z",
          redo: "Mod-Shift-z, Mod-y",
          clear_paragraph: "Mod-Alt-0",
        },
      },
      graph: {
        readability_floor_percent: 70,
      },
    };

    const secondSettings = {
      ...firstSettings,
      graph: {
        readability_floor_percent: 72,
      },
    };

    const { rerender } = render(<Editor appKeymapSettings={firstSettings} />);
    fireEvent.click(screen.getByRole("tab", { name: "View" }));

    let initialCalls = 0;
    await waitFor(() => {
      expect(mockRenderMermaidDiagrams.mock.calls.length).toBeGreaterThan(0);
    });
    initialCalls = mockRenderMermaidDiagrams.mock.calls.length;

    rerender(<Editor appKeymapSettings={secondSettings} />);

    await waitFor(() => {
      expect(mockRenderMermaidDiagrams.mock.calls.length).toBeGreaterThan(initialCalls);
    });
  });
});
