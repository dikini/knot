# Frontend API Client

**Date:** 2026-02-19  
**Status:** Implemented

## Overview

The frontend API client provides type-safe access to the refactored Rust core via Tauri commands.

## Location

- `src/lib/api.ts` - API functions
- `src/lib/store.ts` - Zustand stores with API integration
- `src/types/vault.ts` - TypeScript type definitions

## Usage

### Basic Example

```typescript
import * as api from "@lib/api";
import { useVaultStore } from "@lib/store";

// Open a vault
const info = await api.openVault("/home/user/notes");
console.log(`Opened vault with ${info.note_count} notes`);

// List all notes
const notes = await api.listNotes();

// Get a specific note
const note = await api.getNote("ideas.md");

// Save a note
await api.saveNote("ideas.md", "# My Idea\n\nContent here");

// Search
const results = await api.searchNotes("rust programming", 10);
```

### With React/Zustand

```typescript
import { useVaultStore } from "@lib/store";

function MyComponent() {
  const { vault, openVault, loadNotes, noteList } = useVaultStore();

  const handleOpen = async () => {
    await openVault("/path/to/vault");
    // Automatically loads notes after opening
  };

  return (
    <div>
      {vault && <p>Vault: {vault.name}</p>}
      <ul>
        {noteList.map(note => (
          <li key={note.path}>{note.title}</li>
        ))}
      </ul>
    </div>
  );
}
```

## API Reference

### Vault Operations

#### `createVault(path: string): Promise<VaultInfo>`
Create a new vault at the specified path.

#### `openVault(path: string): Promise<VaultInfo>`
Open an existing vault.

#### `closeVault(): Promise<void>`
Close the current vault.

#### `getVaultInfo(): Promise<VaultInfo | null>`
Get information about the current vault (or null if none open).

#### `isVaultOpen(): Promise<boolean>`
Check if a vault is currently open.

#### `getRecentNotes(limit?: number): Promise<NoteSummary[]>`
Get recently modified notes.

### Note Operations

#### `listNotes(): Promise<NoteSummary[]>`
List all notes in the vault.

#### `getNote(path: string): Promise<NoteData>`
Get a note by its path.

#### `saveNote(path: string, content: string): Promise<void>`
Save a note.

#### `deleteNote(path: string): Promise<void>`
Delete a note.

#### `renameNote(oldPath: string, newPath: string): Promise<void>`
Rename or move a note.

#### `createNote(path: string, content?: string): Promise<NoteData>`
Create a new note.

### Search Operations

#### `searchNotes(query: string, limit?: number): Promise<SearchResult[]>`
Full-text search across all notes.

#### `searchSuggestions(query: string, limit?: number): Promise<string[]>`
Get search suggestions for autocomplete.

### Graph Operations

#### `getGraphLayout(width: number, height: number): Promise<GraphLayout>`
Get the link graph layout for visualization.

## Types

```typescript
interface VaultInfo {
  path: string;
  name: string;
  note_count: number;
  last_modified: number;
}

interface NoteSummary {
  id: string;
  path: string;
  title: string;
  created_at: number;
  modified_at: number;
  word_count: number;
}

interface NoteData {
  id: string;
  path: string;
  title: string;
  content: string;
  created_at: number;
  modified_at: number;
  word_count: number;
  headings: Heading[];
  backlinks: Backlink[];
}

interface Heading {
  level: number;
  text: string;
  position: number;
}

interface Backlink {
  source_path: string;
  source_title: string;
  context: string;
}

interface SearchResult {
  path: string;
  title: string;
  excerpt: string;
  score: number;
}

interface GraphLayout {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface GraphNode {
  id: string;
  label: string;
  x: number;
  y: number;
}

interface GraphEdge {
  source: string;
  target: string;
}
```

## Error Handling

All API functions throw errors on failure:

```typescript
try {
  await api.openVault("/invalid/path");
} catch (error) {
  if (error instanceof Error) {
    console.error("Failed to open vault:", error.message);
  }
}
```

Common error messages:
- `"No vault is open"` - Try to use note operations without opening vault
- `"Vault not found at {path}"` - Path doesn't contain a vault
- `"Note not found: {path}"` - Note doesn't exist
- `"Note already exists: {path}"` - Trying to create duplicate note

## Store Integration

The `useVaultStore` hook provides:

### State
- `vault: VaultInfo | null` - Current vault info
- `currentNote: NoteData | null` - Currently open note
- `noteList: NoteSummary[]` - List of all notes
- `isLoading: boolean` - Loading state
- `error: string | null` - Error message

### Actions
- `openVault(path: string)` - Open vault and load notes
- `closeVault()` - Close current vault
- `loadNotes()` - Refresh notes list
- `loadNote(path: string)` - Load specific note
- `saveCurrentNote()` - Save current note

## Testing

Test the API without a vault:

```typescript
// Test greet command (no vault needed)
const greeting = await api.greet("World");
console.log(greeting); // "Hello, World! You've been greeted from Rust!"
```

## Next Steps

1. **Install system libraries** to enable Rust compilation:
   ```bash
   sudo apt-get install libgtk-3-dev libglib2.0-dev
   ```

2. **Install npm dependencies**:
   ```bash
   npm install
   ```

3. **Run development server**:
   ```bash
   npm run tauri-dev
   ```

4. **Test the API** using the UI:
   - Click "Test Greet" button (works without vault)
   - Enter vault path and click "Open Vault"
   - Create notes using the + button in sidebar
