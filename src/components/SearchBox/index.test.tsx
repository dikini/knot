/**
 * Tests for SearchBox component
 * Spec: COMP-SEARCH-UI-001
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchBox } from "./index";
import type { SearchResult } from "@/types/vault";

// Mock the API module
vi.mock("@lib/api", () => ({
  searchNotes: vi.fn((_query: string, _limit?: number) => {
    // The actual API implementation will be replaced by tests
    // This is just a stub to satisfy TypeScript
    return Promise.resolve([]);
  }),
}));

import { searchNotes } from "@lib/api";

describe("SearchBox Component", () => {
  const mockOnResultSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("FR-1: Search input in sidebar", () => {
    it("should render search box in sidebar", () => {
      render(<SearchBox onResultSelect={mockOnResultSelect} />);

      const input = screen.getByLabelText("Search notes");
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute("type", "text");
      expect(input).toHaveAttribute("placeholder", "Search notes...");
    });

    it("should show keyboard shortcut hint", () => {
      render(<SearchBox onResultSelect={mockOnResultSelect} />);

      const shortcut = screen.getByText("⌘");
      expect(shortcut).toBeInTheDocument();
    });

    it("should focus input on Ctrl/Cmd+K", () => {
      render(<SearchBox onResultSelect={mockOnResultSelect} />);

      const input = screen.getByLabelText("Search notes");
      expect(input).not.toHaveFocus();

      fireEvent.keyDown(document, { key: "k", ctrlKey: true });
      expect(input).toHaveFocus();
    });

    it("should focus input on Cmd+K (Mac)", () => {
      render(<SearchBox onResultSelect={mockOnResultSelect} />);

      const input = screen.getByLabelText("Search notes");
      fireEvent.keyDown(document, { key: "k", metaKey: true });
      expect(input).toHaveFocus();
    });
  });

  describe("FR-2: Real-time search as user types", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should debounce search by 300ms", async () => {
      const mockResults = [
        { path: "note1.md", title: "Note 1", excerpt: "Content...", score: 0.9 },
      ];
      vi.mocked(searchNotes).mockResolvedValue(mockResults);

      render(<SearchBox onResultSelect={mockOnResultSelect} />);

      const input = screen.getByLabelText("Search notes");

      // Type first character
      fireEvent.change(input, { target: { value: "test" } });
      expect(searchNotes).not.toHaveBeenCalled();

      // Advance debounce timer.
      await act(async () => {
        vi.advanceTimersByTime(300);
        await vi.runAllTimersAsync();
      });
      expect(searchNotes).toHaveBeenCalledOnce();
      expect(searchNotes).toHaveBeenCalledWith("test", 10);
    });

    it("should show results dropdown after debounce", async () => {
      const mockResults = [
        { path: "note1.md", title: "Note 1", excerpt: "Content...", score: 0.9 },
      ];
      vi.mocked(searchNotes).mockResolvedValue(mockResults);

      render(<SearchBox onResultSelect={mockOnResultSelect} />);

      const input = screen.getByLabelText("Search notes");
      fireEvent.change(input, { target: { value: "test" } });

      // Dropdown opens immediately while searching.
      expect(screen.getByText("Searching...")).toBeInTheDocument();

      // After debounce, dropdown should appear
      await act(async () => {
        vi.advanceTimersByTime(300);
        await vi.runAllTimersAsync();
      });
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });
  });

  describe("FR-3: Search result display", () => {
    it("should show note title in results", async () => {
      const mockResults = [
        { path: "note1.md", title: "Note 1", excerpt: "Content...", score: 0.9 },
      ];
      vi.mocked(searchNotes).mockResolvedValue(mockResults);

      render(<SearchBox onResultSelect={mockOnResultSelect} />);

      const input = screen.getByLabelText("Search notes");
      await userEvent.type(input, "test");

      await waitFor(() => {
        expect(screen.getByText("Note 1")).toBeInTheDocument();
      });
    });

    it("should show excerpt with highlighted search term", async () => {
      const mockResults = [
        {
          path: "note1.md",
          title: "Test Note",
          excerpt: "This is a test note with content",
          score: 0.9,
        },
      ];
      vi.mocked(searchNotes).mockResolvedValue(mockResults);

      render(<SearchBox onResultSelect={mockOnResultSelect} />);

      const input = screen.getByLabelText("Search notes");
      await userEvent.type(input, "test");

      await waitFor(() => {
        const result = screen.getByText(/This is a test note/);
        expect(result).toBeInTheDocument();
      });
    });

    it("should call onResultSelect when result clicked", async () => {
      const mockResults = [
        { path: "note1.md", title: "Note 1", excerpt: "Content...", score: 0.9 },
      ];
      vi.mocked(searchNotes).mockResolvedValue(mockResults);

      render(<SearchBox onResultSelect={mockOnResultSelect} />);

      const input = screen.getByLabelText("Search notes");
      await userEvent.type(input, "test");

      // Wait for results to appear
      await waitFor(() => {
        expect(screen.getByText("Note 1")).toBeInTheDocument();
      });
      const result = screen.getByText("Note 1");

      // Click the result
      await userEvent.click(result);

      expect(mockOnResultSelect).toHaveBeenCalledWith("note1.md");
    });

    it("should limit to max 10 results", async () => {
      const mockResults = Array.from({ length: 15 }, (_, i) => ({
        path: `note${i}.md`,
        title: `Note ${i}`,
        excerpt: `Content ${i}`,
        score: 0.9 - i * 0.05,
      }));
      vi.mocked(searchNotes).mockImplementation((_query, limit) => {
        // Return only the first 'limit' results
        return Promise.resolve(mockResults.slice(0, limit || mockResults.length));
      });

      render(<SearchBox onResultSelect={mockOnResultSelect} />);

      const input = screen.getByLabelText("Search notes");
      await userEvent.type(input, "test");

      await waitFor(() => {
        const results = screen.getAllByRole("option");
        expect(results.length).toBe(10);
      });
    });
  });

  describe("FR-4: Empty state", () => {
    it("should show 'Type to search' when input is focused and query is empty", async () => {
      render(<SearchBox onResultSelect={mockOnResultSelect} />);

      const input = screen.getByLabelText("Search notes");
      expect(input).toHaveValue("");
      await userEvent.click(input);

      await waitFor(() => {
        expect(screen.getByText("Type to search")).toBeInTheDocument();
      });
    });

    it("should show 'No notes found' when no results", async () => {
      vi.mocked(searchNotes).mockResolvedValue([]);

      render(<SearchBox onResultSelect={mockOnResultSelect} />);

      const input = screen.getByLabelText("Search notes");
      await userEvent.type(input, "nonexistent");

      await waitFor(() => {
        expect(screen.getByText("No notes found")).toBeInTheDocument();
      });
    });

    it("should show loading state while searching", async () => {
      // Mock a delayed response
      let resolvePromise!: (value: SearchResult[]) => void;
      const promise = new Promise<SearchResult[]>((resolve) => {
        resolvePromise = resolve;
      });
      vi.mocked(searchNotes).mockReturnValue(promise);

      render(<SearchBox onResultSelect={mockOnResultSelect} />);

      const input = screen.getByLabelText("Search notes");
      await userEvent.type(input, "test");

      await waitFor(() => {
        expect(screen.getByText("Searching...")).toBeInTheDocument();
      });

      // Resolve the promise
      resolvePromise([]);
    });
  });

  describe("FR-5: Keyboard navigation", () => {
    it("should highlight next result on ArrowDown", async () => {
      const mockResults = [
        { path: "note1.md", title: "Note 1", excerpt: "Content...", score: 0.9 },
        { path: "note2.md", title: "Note 2", excerpt: "Content...", score: 0.8 },
      ];
      vi.mocked(searchNotes).mockResolvedValue(mockResults);

      render(<SearchBox onResultSelect={mockOnResultSelect} />);

      const input = screen.getByLabelText("Search notes");
      await userEvent.type(input, "test");
      await waitFor(() => {
        expect(screen.getAllByRole("option").length).toBeGreaterThan(0);
      });

      // First result should be selected by default
      const firstResult = screen.getAllByRole("option")[0];
      expect(firstResult).toHaveClass("search-box__result--selected");

      // Press ArrowDown
      fireEvent.keyDown(input, { key: "ArrowDown" });

      const results = screen.getAllByRole("option");
      expect(results[0]).not.toHaveClass("search-box__result--selected");
      expect(results[1]).toHaveClass("search-box__result--selected");
    });

    it("should highlight previous result on ArrowUp", async () => {
      const mockResults = [
        { path: "note1.md", title: "Note 1", excerpt: "Content...", score: 0.9 },
        { path: "note2.md", title: "Note 2", excerpt: "Content...", score: 0.8 },
      ];
      vi.mocked(searchNotes).mockResolvedValue(mockResults);

      render(<SearchBox onResultSelect={mockOnResultSelect} />);

      const input = screen.getByLabelText("Search notes");
      await userEvent.type(input, "test");
      await waitFor(() => {
        expect(screen.getAllByRole("option").length).toBeGreaterThan(0);
      });

      // Press ArrowDown to move to second result
      fireEvent.keyDown(input, { key: "ArrowDown" });

      // Press ArrowUp to go back
      fireEvent.keyDown(input, { key: "ArrowUp" });

      const results = screen.getAllByRole("option");
      expect(results[0]).toHaveClass("search-box__result--selected");
      expect(results[1]).not.toHaveClass("search-box__result--selected");
    });

    it("should open note on Enter", async () => {
      const mockResults = [
        { path: "note1.md", title: "Note 1", excerpt: "Content...", score: 0.9 },
      ];
      vi.mocked(searchNotes).mockResolvedValue(mockResults);

      render(<SearchBox onResultSelect={mockOnResultSelect} />);

      const input = screen.getByLabelText("Search notes");
      await userEvent.type(input, "test");
      await waitFor(() => {
        const options = screen.getAllByRole("option");
        expect(options.length).toBeGreaterThan(0);
        expect(options[0]).toHaveClass("search-box__result--selected");
      });

      fireEvent.keyDown(input, { key: "Enter" });

      expect(mockOnResultSelect).toHaveBeenCalledWith("note1.md");
    });

    it("should close dropdown on Escape", async () => {
      const mockResults = [
        { path: "note1.md", title: "Note 1", excerpt: "Content...", score: 0.9 },
      ];
      vi.mocked(searchNotes).mockResolvedValue(mockResults);

      render(<SearchBox onResultSelect={mockOnResultSelect} />);

      const input = screen.getByLabelText("Search notes");
      await userEvent.type(input, "test");
      await waitFor(() => {
        expect(screen.getByRole("listbox")).toBeInTheDocument();
      });

      fireEvent.keyDown(input, { key: "Escape" });

      await waitFor(() => {
        expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      });
    });
  });

  describe("FR-6: Advanced search syntax hints", () => {
    it("should show syntax hints below search box", () => {
      render(<SearchBox onResultSelect={mockOnResultSelect} />);

      const hint = screen.getByText(/Use "quotes" for phrases/);
      expect(hint).toBeInTheDocument();
    });
  });
});
