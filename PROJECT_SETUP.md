# Knot Project Setup Summary

**Date:** 2026-02-19  
**Status:** Initial project structure created

## What Was Created

### 1. Project Configuration
- `AGENTS.md` - Project guide for AI agents with philosophy, guardrails, and tech stack
- `package.json` - Node.js dependencies (React, ProseMirror, Tauri API)
- `tsconfig.json` / `tsconfig.node.json` - TypeScript configuration (strict mode)
- `vite.config.ts` - Vite build configuration with Tauri integration
- `.eslintrc.cjs` - ESLint config (no `any` allowed)
- `.prettierrc` - Code formatting rules
- `.gitignore` - Git ignore patterns

### 2. Frontend (Web)

#### Entry Points
- `index.html` - HTML entry point
- `src/main.tsx` - React application entry
- `src/App.tsx` - Main app component with vault integration

#### Components
- `src/components/Editor/index.tsx` - ProseMirror editor wrapper
- `src/components/Sidebar/index.tsx` - Note navigation sidebar

#### Editor (ProseMirror)
- `src/editor/index.ts` - Editor initialization
- `src/editor/schema.ts` - Markdown document schema (nodes + marks)
- `src/editor/plugins/index.ts` - Plugin registry
- `src/editor/plugins/syntax-hide.ts` - "Hide syntax on inactive lines" implementation
- `src/editor/plugins/wikilinks.ts` - [[Wikilink]] support
- `src/editor/plugins/keymap.ts` - Keyboard shortcuts

#### Types & State
- `src/types/vault.ts` - Vault, Note, Search types
- `src/types/editor.ts` - ProseMirror, EditorConfig types
- `src/lib/store.ts` - Zustand stores (vault, editor)

#### Styles
- `src/styles/global.css` - Base styles, CSS variables
- `src/styles/App.css` - App layout styles
- `src/components/Editor/Editor.css` - ProseMirror-specific styling
- `src/components/Sidebar/Sidebar.css` - Sidebar component styles

### 3. Backend (Tauri/Rust)

#### Configuration
- `src-tauri/Cargo.toml` - Rust dependencies (tauri, tokio, rusqlite, tantivy)
- `src-tauri/tauri.conf.json` - Tauri app configuration
- `src-tauri/build.rs` - Build script
- `src-tauri/capabilities/default.json` - Tauri permissions

#### Source Code
- `src-tauri/src/main.rs` - Tauri app entry with commands
- `src-tauri/src/*.rs` - Copied from botpane/libvault:
  - `vault.rs` (47KB) - Vault management
  - `search.rs` (30KB) - Search index
  - `graph.rs` (25KB) - Link graph
  - `markdown.rs` (14KB) - Markdown parsing
  - `db.rs`, `note.rs`, `config.rs`, etc.

#### Tests
- `src-tauri/tests/` - Test files copied from libvault

### 4. Documentation
- `README.md` - Project overview and development guide
- `docs/REFACTORING_LIBVAULT.md` - Migration guide from FFI to Tauri commands

### 5. Build Kit Skills
- `.agents/skills/` - All bk-* skills copied from botpane

## File Tree

```
knot/
├── .agents/
│   └── skills/              # Build kit skills (18 skills)
├── docs/
│   └── REFACTORING_LIBVAULT.md
├── src/
│   ├── components/
│   │   ├── Editor/
│   │   │   ├── index.tsx
│   │   │   └── Editor.css
│   │   └── Sidebar/
│   │       ├── index.tsx
│   │       └── Sidebar.css
│   ├── editor/
│   │   ├── index.ts
│   │   ├── schema.ts
│   │   └── plugins/
│   │       ├── index.ts
│   │       ├── syntax-hide.ts    # Key feature!
│   │       ├── wikilinks.ts
│   │       └── keymap.ts
│   ├── hooks/
│   ├── lib/
│   │   └── store.ts
│   ├── styles/
│   │   ├── global.css
│   │   └── App.css
│   ├── types/
│   │   ├── vault.ts
│   │   └── editor.ts
│   ├── main.tsx
│   └── App.tsx
├── src-tauri/
│   ├── src/
│   │   ├── main.rs            # Tauri entry
│   │   ├── vault.rs           # (from libvault)
│   │   ├── search.rs          # (from libvault)
│   │   ├── graph.rs           # (from libvault)
│   │   ├── markdown.rs        # (from libvault)
│   │   ├── ffi.rs             # (from libvault) - TO DELETE
│   │   └── ... (other modules)
│   ├── tests/
│   ├── capabilities/
│   ├── icons/
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── build.rs
├── AGENTS.md
├── README.md
├── PROJECT_SETUP.md           # This file
├── package.json
├── tsconfig.json
├── vite.config.ts
├── .eslintrc.cjs
├── .prettierrc
└── .gitignore
```

## Next Steps

### 1. Install Dependencies
```bash
cd /home/dikini/Projects/knot
npm install
cd src-tauri
cargo fetch
```

### 2. Run Development Server
```bash
# Terminal 1: Frontend dev server
npm run dev

# Terminal 2: Tauri dev (in another terminal)
npm run tauri-dev
```

### 3. First Tasks (Priority Order)

1. **Refactor Rust Core**
   - Follow `docs/REFACTORING_LIBVAULT.md`
   - Create `commands/` module
   - Implement `open_vault`, `get_note`, `save_note` commands
   - Delete `ffi.rs`

2. **Implement Markdown Parser/Serializer**
   - `src/editor/markdown.ts` - Parse MD → ProseMirror doc
   - `src/editor/serializer.ts` - Serialize doc → MD
   - Connect to Tauri commands

3. **Test Syntax Hiding**
   - Verify heading `#` hides/shows based on cursor
   - Style inactive vs active states

4. **Android Setup**
   - Install Android SDK
   - Configure Tauri mobile
   - Test on emulator

## Key Design Decisions

1. **Type Safety First**
   - TypeScript: strict mode, no `any`
   - Rust: `thiserror`, never unwrap without comment
   - Full type safety across Rust ↔ TypeScript boundary

2. **Distraction-Free Editing**
   - ProseMirror NodeViews for "hide syntax" behavior
   - Custom `syntax-hide.ts` plugin
   - CSS handles visual transitions

3. **State Management**
   - Zustand for React state (lightweight, type-safe)
   - Tauri managed state for Rust (Arc<Mutex<_>>)

4. **Mobile Support**
   - Tauri 2.0's mobile capabilities
   - Responsive CSS (already in Editor.css)
   - Touch-friendly targets

## Estimated Binary Sizes

| Component | Size |
|-----------|------|
| Tauri runtime | ~3 MB |
| Rust core (refactored) | ~4 MB |
| Frontend (gzipped) | ~200 KB |
| **Total** | **~7-8 MB** |

Compare to Qt WebEngine approach: ~130 MB  
**Savings: ~95% smaller**

## Notes

- All Rust code from `libvault` compiles but needs refactoring
- Frontend TypeScript code has placeholder implementations (marked with `TODO`)
- The `syntax-hide.ts` plugin has the core logic but needs markdown parser integration
- Tests need to be rewritten for Tauri command structure

---

**Ready to start development!** Run `npm install` to begin.
