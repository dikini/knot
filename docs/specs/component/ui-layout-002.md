# UI Layout - Distraction-Free Design

## Metadata

- ID: `COMP-UI-LAYOUT-002`
- Scope: `component`
- Status: `implemented`
- Parent: `COMP-FRONTEND-001`
- Concerns: [CONF, CAP]
- Created: `2026-02-19`
- Verified: `2026-02-19`

## Purpose

Redesign the UI layout to provide a distraction-free editing experience. Move all service/info UI out of the central content area. Central area is exclusively for content (notes, graphs, future features).

## Current Problems

1. **Vault info panel visible during editing** - Shows path, note count, last modified - distracting
2. **Vault actions in main area** - Open/Create vault buttons take up central space
3. **Mixed concerns** - Service info mixed with content

## Design Principles

1. **Central area = Content only** - Notes, graphs, AI chat, etc.
2. **Sidebar = Navigation + Actions** - Note list, vault switcher, create buttons
3. **Chrome hidden when not needed** - Minimize UI when editing
4. **Contextual UI** - Show relevant controls based on state

## Proposed Layout

```
┌─────────────────────────────────────────────────────────────┐
│  Sidebar (200-250px)      │  Main Content Area (flexible)   │
│                           │                                 │
│  ┌─────────────────────┐  │  ┌─────────────────────────┐    │
│  │ Vault Name          │  │  │                         │    │
│  │ [Switch ▼]          │  │  │    NOTE CONTENT         │    │
│  └─────────────────────┘  │  │                         │    │
│                           │  │    (or Graph, or        │    │
│  ┌─────────────────────┐  │  │     AI Chat, etc)       │    │
│  │ [+ New Note]        │  │  │                         │    │
│  └─────────────────────┘  │  └─────────────────────────┘    │
│                           │                                 │
│  Notes List               │  NO SERVICE INFO HERE           │
│  ┌─────────────────────┐  │  NO BUTTONS HERE                │
│  │ • Note 1            │  │                                 │
│  │ • Note 2            │  │                                 │
│  │ • Note 3            │  │                                 │
│  └─────────────────────┘  │                                 │
│                           │                                 │
└───────────────────────────┴─────────────────────────────────┘
```

## Contract

### Functional Requirements

**FR-1**: Vault switcher in sidebar

- Show current vault name in sidebar header
- Dropdown or button to switch vault (opens vault selection modal/screen)
- Recent vaults accessible from switcher

**FR-2**: New note button in sidebar

- "+ New Note" button at top of note list
- Creates new note and opens it in editor

**FR-3**: Remove vault info panel from main area

- Delete the vault info panel (path, note count, last modified)
- Move "Close Vault" to vault switcher menu

**FR-4**: Distraction-free note editor

- Editor takes full central area when note open
- No service info visible
- Toolbar only shows note title + save status

**FR-5**: Welcome screen for no vault state

- When no vault open, show welcome in central area
- Recent vaults here (not in sidebar)
- Open/Create vault buttons here
- Sidebar shows "No vault open" placeholder

**FR-6**: Empty state for vault open but no note selected

- Show placeholder: "Select a note or create a new one"
- Optional: Recent notes or getting started tips

### State-Based Layout

| State                     | Sidebar                          | Main Area                       |
| ------------------------- | -------------------------------- | ------------------------------- |
| No vault                  | "No vault" placeholder           | Welcome screen with Open/Create |
| Vault open, no note       | Note list                        | Empty state placeholder         |
| Vault open, note selected | Note list (selected highlighted) | Editor (full content area)      |

### Interface Changes

**Sidebar additions:**

```typescript
// New props/actions
vaultName: string;
onVaultSwitch: () => void;  // Opens vault switcher
onCreateNote: () => void;
```

**App.tsx changes:**

- Remove vault info panel
- Remove vault actions from main area (when vault open)
- Add vault switcher to sidebar

## Design Decisions

| Decision                           | Rationale                         | Trade-off                                     |
| ---------------------------------- | --------------------------------- | --------------------------------------------- |
| Vault switcher in sidebar          | Always accessible, contextual     | Sidebar slightly busier                       |
| New note button at top of list     | Natural placement, always visible | Takes some vertical space                     |
| Remove vault info panel            | Reduces distraction               | Less info visible (but available in switcher) |
| Welcome screen only when no vault  | Central area focused on content   | One more state to handle                      |
| Keep save button in editor toolbar | Essential function, contextual    | Minimal chrome                                |

## Acceptance Criteria

- [x] Vault switcher in sidebar with current vault name
- [x] "+ New Note" button in sidebar
- [x] Vault info panel removed from main area
- [x] Close vault moved to vault switcher menu
- [x] Editor takes full central area when note open
- [x] Welcome screen shown when no vault (central area)
- [x] Sidebar shows placeholder when no vault
- [x] Layout is responsive

## Related

- Updates: `COMP-FRONTEND-001`, `COMP-VAULT-UI-001`
- Used by: All UI components
