# Implementation Plan: Search UI

> Superseded by `docs/plans/search-ui-001-plan.md` and `docs/plans/search-ui-001-tasks.yaml`.

## Metadata
- Spec: `docs/specs/component/search-ui-001.md`
- Generated: `2026-02-19`
- Approach: `sequential`

## Summary
- Total tasks: 5
- Size: 2 Small, 3 Medium

## Tasks

| ID | Task | Size | Depends | Spec Ref |
|----|------|------|---------|----------|
| SU-001 | Create SearchBox component structure | M | - | FR-1 |
| SU-002 | Implement search logic with debounce | M | SU-001 | FR-2 |
| SU-003 | Implement results dropdown | M | SU-002 | FR-3, FR-4 |
| SU-004 | Add keyboard navigation | S | SU-003 | FR-5 |
| SU-005 | Add syntax hints | S | SU-001 | FR-6 |

## Task Details

### SU-001: Create SearchBox component
Location: `src/components/SearchBox/`

Files:
- `index.tsx` - Component
- `SearchBox.css` - Styles

Props:
```typescript
interface SearchBoxProps {
  onResultSelect: (path: string) => void;
}
```

### SU-002: Search logic with debounce
- useState for query
- useEffect with setTimeout for debounce (300ms)
- Call `api.searchNotes(query, 10)` when debounced
- Store results in state

### SU-003: Results dropdown
- Absolute positioned dropdown below input
- Show loading state while searching
- Show "No results" if empty
- Map results to clickable items
- Highlight matches in title

### SU-004: Keyboard navigation
- useState for selectedIndex
- onKeyDown handler:
  - ArrowDown: increment index (modulo results.length)
  - ArrowUp: decrement index
  - Enter: select current result
  - Escape: close dropdown

### SU-005: Syntax hints
- Small text below search box
- Icons or examples for syntax

## Verification

```bash
npm run typecheck
npm run tauri dev
```

Test:
1. Type query → results appear
2. Click result → note opens
3. Keyboard nav → works
4. Empty state → shows message
