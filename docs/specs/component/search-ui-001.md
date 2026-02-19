# Search UI Component

## Metadata
- ID: `COMP-SEARCH-UI-001`
- Scope: `component`
- Status: `draft`
- Parent: `COMP-FRONTEND-001`, `COMP-SEARCH-001`
- Concerns: [CAP, REL]
- Created: `2026-02-19`

## Purpose
Provide a user interface for searching notes. Backend search is fully functional; this adds the frontend interface.

## Contract

### Functional Requirements

**FR-1**: Search input in sidebar
- Search box at top of sidebar
- Placeholder text: "Search notes..."
- Keyboard shortcut: Ctrl/Cmd + K to focus

**FR-2**: Real-time search as user types
- Debounce 300ms
- Show results in dropdown below search box
- Max 10 results shown

**FR-3**: Search result display
- Show note title (highlighted match)
- Show excerpt with highlighted search term
- Click to open note

**FR-4**: Empty state
- No query: Show "Type to search"
- No results: Show "No notes found"

**FR-5**: Keyboard navigation
- Up/Down arrows to navigate results
- Enter to open selected note
- Escape to close results

**FR-6**: Advanced search syntax hints
- Show hint: Use "quotes" for phrases
- Show hint: Use -term to exclude
- Show hint: Use tag:name for tags

### Interface (TypeScript)

```typescript
interface SearchBoxProps {
  onResultSelect: (path: string) => void;
}

interface SearchResult {
  path: string;
  title: string;
  excerpt: string;
  score: number;
}
```

### Behavior

**Given** user types "rust" in search box
**When** after 300ms debounce
**Then** search API called, results dropdown shown

**Given** search results visible
**When** user presses Down arrow
**Then** second result highlighted

**Given** result highlighted
**When** user presses Enter
**Then** note opens, search dropdown closes

## Design Decisions

| Decision | Rationale | Trade-off |
|----------|-----------|-----------|
| Search in sidebar | Always accessible | Takes vertical space |
| Real-time search | Immediate feedback | More API calls (debounced) |
| Dropdown results | Familiar UX | Can overflow on small screens |
| Max 10 results | Performance, simplicity | May need pagination later |

## Acceptance Criteria

- [ ] Search box visible in sidebar
- [ ] Real-time search with debounce
- [ ] Results show title and excerpt
- [ ] Click result to open note
- [ ] Keyboard navigation works
- [ ] Empty states handled
- [ ] Syntax hints visible

## Related

- Depends on: `COMP-SEARCH-001` (backend)
- Used by: Frontend sidebar
