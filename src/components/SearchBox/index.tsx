import { useState, useEffect, useRef, useCallback } from "react";
import type { ReactNode } from "react";
import { searchNotes } from "@lib/api";
import type { SearchResult } from "@lib/api";
import "./SearchBox.css";
// SPEC: COMP-SEARCH-UI-001 FR-1, FR-2, FR-3, FR-4, FR-5, FR-6

export interface SearchBoxProps {
  onResultSelect: (path: string) => void;
}

const MAX_RESULTS = 10;
const DEBOUNCE_MS = 300;

export function SearchBox({ onResultSelect }: SearchBoxProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Handle keyboard shortcut (Ctrl/Cmd+K)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    // Clear previous timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (query.trim() === "") {
      setResults([]);
      setIsSearching(false);
      setSelectedIndex(-1);
      return;
    }

    setIsSearching(true);
    setIsOpen(true);

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const searchResults = await searchNotes(query, MAX_RESULTS);
        setResults(searchResults);
        setSelectedIndex(searchResults.length > 0 ? 0 : -1);
      } catch (error) {
        console.error("Search failed:", error);
        setResults([]);
        setSelectedIndex(-1);
      } finally {
        setIsSearching(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [query]);

  const handleSelect = useCallback(
    (path: string) => {
      setIsOpen(false);
      setQuery("");
      setResults([]);
      setSelectedIndex(-1);
      onResultSelect(path);
    },
    [onResultSelect]
  );

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (!isOpen || results.length === 0) {
        if (event.key === "Escape") {
          setIsOpen(false);
          inputRef.current?.blur();
        }
        return;
      }

      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          setSelectedIndex((prev) =>
            prev < results.length - 1 ? prev + 1 : prev
          );
          break;
        case "ArrowUp":
          event.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;
        case "Enter":
          event.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < results.length) {
            const selected = results[selectedIndex];
            if (selected) {
              handleSelect(selected.path);
            }
          }
          break;
        case "Escape":
          event.preventDefault();
          setIsOpen(false);
          inputRef.current?.blur();
          break;
      }
    },
    [handleSelect, isOpen, results, selectedIndex]
  );

  const handleClear = useCallback(() => {
    setQuery("");
    setResults([]);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  }, []);

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setQuery(event.target.value);
    },
    []
  );

  const handleInputFocus = useCallback(() => {
    setIsOpen(true);
  }, []);

  // Highlight matching text in title
  const highlightMatch = (text: string, queryText: string): ReactNode => {
    if (!queryText.trim()) return <>{text}</>;

    const parts = text.split(new RegExp(`(${escapeRegex(queryText)})`, "gi"));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === queryText.toLowerCase() ? (
            <mark key={i} className="search-box__highlight">
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </>
    );
  };

  const escapeRegex = (str: string): string => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  };

  const showDropdown = isOpen;

  return (
    <div className="search-box" ref={containerRef}>
      <div className="search-box__input-wrapper">
        <svg
          className="search-box__icon"
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M7.33333 12.6667C10.2789 12.6667 12.6667 10.2789 12.6667 7.33333C12.6667 4.38781 10.2789 2 7.33333 2C4.38781 2 2 4.38781 2 7.33333C2 10.2789 4.38781 12.6667 7.33333 12.6667Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M14 14L11 11"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <input
          ref={inputRef}
          type="text"
          className="search-box__input"
          placeholder="Search notes..."
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleInputFocus}
          aria-label="Search notes"
          aria-expanded={showDropdown}
          aria-controls="search-results"
          aria-activedescendant={
            selectedIndex >= 0 ? `search-result-${selectedIndex}` : undefined
          }
          autoComplete="off"
        />

        {query && (
          <button
            type="button"
            className="search-box__clear"
            onClick={handleClear}
            aria-label="Clear search"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                d="M10.5 3.5L3.5 10.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M3.5 3.5L10.5 10.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}

        <kbd className="search-box__shortcut" aria-hidden="true">
          <span>⌘</span>
          <span>K</span>
        </kbd>
      </div>

      {showDropdown && (
        <div
          id="search-results"
          className="search-box__dropdown"
          role="listbox"
        >
          {isSearching ? (
            <div className="search-box__loading">Searching...</div>
          ) : query.trim() === "" ? (
            <div className="search-box__empty">Type to search</div>
          ) : results.length === 0 ? (
            <div className="search-box__empty">No notes found</div>
          ) : (
            <ul className="search-box__results">
              {results.map((result, index) => (
                <li
                  key={result.path}
                  id={`search-result-${index}`}
                  className={`search-box__result ${
                    index === selectedIndex ? "search-box__result--selected" : ""
                  }`}
                  onClick={() => handleSelect(result.path)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  role="option"
                  aria-selected={index === selectedIndex}
                >
                  <div className="search-box__result-title">
                    {highlightMatch(result.title, query)}
                  </div>
                  {result.excerpt && (
                    <div className="search-box__result-excerpt">
                      {result.excerpt}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p className="search-box__hint">
        Tip: Use "quotes" for phrases, -term to exclude, tag:name for tags
      </p>
    </div>
  );
}
