# Knot - AI-Native Knowledge Base

## Project Overview

Knot is a privacy-focused, AI-accessible knowledge management application. It's an Obsidian-like note-taking app with native MCP (Model Context Protocol) integration, built with a distraction-free editing experience as the highest priority.

**Key differentiators:**

- **Distraction-free editing** - Semantic markdown highlighting with syntax hidden on inactive lines
- **AI-native** - MCP server for RAG integration
- **Privacy-first** - Local-first, P2P sync, no cloud dependency
- **Cross-platform** - Desktop (Linux, macOS, Windows) + Android (phone + tablet)
- **Rich media** - Native image and video embedding

## Architecture

**Tauri 2.0** application with:

- **Frontend:** Web-based (TypeScript/React) with ProseMirror editor
- **Backend:** Rust core library (evolved from libvault)
- **Mobile:** Shared codebase via Tauri's mobile support

```
knot/
├── src-tauri/          # Rust backend (Tauri commands, core logic)
├── src/                # Web frontend (TypeScript/React + ProseMirror)
├── src-mobile/         # Mobile-specific overrides (if needed)
└── docs/
```

## Technology Stack

### Backend (Rust)

- **Tauri 2.0** - Cross-platform app framework
- **SQLite** - Metadata storage (libsql or rusqlite)
- **Tantivy** - Full-text search (Bulgarian + English)
- **Tokio** - Async runtime
- **P2P sync** - Future: libp2p for peer-to-peer synchronization

### Frontend (TypeScript)

- **React 18+** - UI framework
- **ProseMirror** - Rich semantic text editor
- **TipTap** (optional) - ProseMirror wrapper for faster development
- **Vite** - Build tooling
- **TypeScript** - Strict type discipline required

## Implementation Philosophy

### 1. Type Discipline is Non-Negotiable

- **Rust:** Strict compiler, no `unwrap()` without comment, `Result` everywhere
- **TypeScript:** Strict mode enabled, no `any` without explicit justification
- **Type safety at boundaries:** Tauri commands fully typed, no implicit conversions

### 2. Distraction-Free First

Every UI decision prioritizes focused writing:

- Chrome hidden when not needed
- Markdown syntax invisible on inactive lines
- Semantic highlighting (headings look like headings, not `###`)
- Minimal UI chrome, maximum content

### 3. Privacy by Design

- Local-first storage
- No telemetry without explicit opt-in
- P2P sync only (no central server)
- End-to-end encryption for sync

### 4. Progressive Enhancement

Core functionality works offline. Enhanced features (AI, sync) layer on top.

## MANDATORY WORKFLOW

**ALL development work MUST follow this exact sequence. No exceptions.**

If you are tempted to skip steps, you are violating the development process.

```
bk-design → bk-plan → bk-tdd → bk-implement → bk-verify
```

### Workflow Requirements

1. **No code without spec** - Use `bk-design` first
2. **No implementation without plan** - Use `bk-plan` to create tasks
3. **No code without tests** - Use `bk-tdd` to write failing tests first
4. **No completion without verification** - Use `bk-verify` to check compliance

### Anti-Patterns (Forbidden)

- ❌ Reading code and declaring "it's done"
- ❌ Writing implementation code directly without tests
- ❌ Updating spec status without formal verification
- ❌ Skipping workflow because "it looks right"
- ❌ Running tests manually outside skill workflow

### Enforced Discipline

When asked to implement something:

1. ALWAYS invoke the appropriate skill first
2. Follow the skill's workflow exactly
3. Wait for skill completion before proceeding
4. Only then move to next step

**Example:**

```
User: Implement note editor

Wrong:
✗ Read Editor.tsx, say "it's already done"

Correct:
✓ bk-design (ensure spec exists)
✓ bk-plan (create implementation plan)
✓ bk-tdd (write tests)
✓ bk-implement-typescript (write code)
✓ bk-verify (verify compliance)
```

## Project Guardrails

### Code Organization

```
src-tauri/src/
├── main.rs              # App entry point
├── lib.rs               # Library exports (for testing)
├── commands/            # Tauri command handlers
│   ├── vault.rs         # Vault operations
│   ├── notes.rs         # Note CRUD
│   ├── search.rs        # Search API
│   └── sync.rs          # P2P sync
├── core/                # Core business logic
│   ├── vault.rs         # Vault management
│   ├── note.rs          # Note model
│   ├── graph.rs         # Link graph
│   └── search.rs        # Search index
├── db/                  # Database layer
│   ├── schema.rs        # Migration definitions
│   └── queries.rs       # SQL queries
└── plugins/             # Future: WASM plugin host

src/
├── components/          # React components
│   ├── Editor/          # ProseMirror editor
│   ├── Sidebar/         # Navigation
│   └── Layout/          # App shell
├── editor/              # ProseMirror-specific code
│   ├── schema.ts        # Document schema
│   ├── plugins/         # Editor plugins
│   └── views/           # Node views
├── hooks/               # Custom React hooks
├── lib/                 # Utility functions
└── types/               # Shared TypeScript types
```

### Naming Conventions

- **Rust:** `snake_case` for functions/variables, `PascalCase` for types/structs
- **TypeScript:** `camelCase` for functions/variables, `PascalCase` for types/components
- **Files:** Match default export name (e.g., `Editor.tsx` exports `Editor`)

### Error Handling

**Rust:**

```rust
// Prefer thiserror for library errors
#[derive(thiserror::Error, Debug)]
pub enum VaultError {
    #[error("note not found: {0}")]
    NoteNotFound(String),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
}

// Use anyhow for application errors
fn do_something() -> anyhow::Result<()> {
    risky_op().context("failed to do something")?;
    Ok(())
}
```

**TypeScript:**

```typescript
// Never throw bare strings
type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

// Or use neverthrow library
import { Result, ok, err } from "neverthrow";

function mightFail(): Result<string, VaultError> {
  if (somethingWrong) {
    return err({ type: "NOTE_NOT_FOUND", path });
  }
  return ok(data);
}
```

### Testing Strategy

- **Rust:** Unit tests in-module, integration tests in `tests/`
- **TypeScript:** Vitest for unit, Playwright for E2E
- **Critical paths:** Vault operations, search, editor state

## Development Workflow

### Build Commands

```bash
# Development (desktop)
npm run tauri dev

# Build for production
npm run tauri build

# Android development
npm run tauri android dev

# Type checking
npm run typecheck        # TypeScript
cargo check              # Rust
cargo clippy             # Rust linting

# Testing
npm run test             # Frontend tests
cargo test               # Rust tests
```

### Git Workflow

- Main branch: `main`
- Feature branches: `feature/description`
- Use git worktrees for major features: `.worktrees/`

### Code Quality Gates

1. **Type checking passes** (both Rust and TypeScript)
2. **Clippy clean** (no warnings)
3. **Tests pass** (unit + integration)
4. **Formatted** (`rustfmt`, `prettier`)

### Pre-Workflow Validation

Before any code changes, verify:

- [ ] **Spec exists?** If no → run `bk-design`
- [ ] **Implementation plan exists?** If no → run `bk-plan`
- [ ] **Tests written first?** If no → run `bk-tdd`
- [ ] **Compliance verified?** If no → run `bk-verify`

**Stop if any checkbox is unchecked.**

### Workflow Artifacts Tracking

Each workflow step MUST create/update specific artifacts:

| Step         | Tool  | Output Location                             | Required Artifacts                                           |
| ------------ | ----- | ------------------------------------------- | ------------------------------------------------------------ |
| bk-design    | skill | `docs/specs/<scope>/<id>.md`                | Spec document with FR, design decisions, acceptance criteria |
| bk-plan      | skill | `docs/plans/<feature-id>-plan.md`           | Implementation plan with tasks, dependencies, traceability   |
| bk-tdd       | skill | `tests/` or `__tests__/`                    | Failing tests for all requirements                           |
| bk-implement | skill | `src/` or `src-tauri/src/`                  | Working implementation with SPEC markers                     |
| bk-verify    | skill | `docs/audit/<scope>-verification-<date>.md` | Compliance report, gap analysis, audit trail                 |

**Artifact requirements:**

- All specs must have traceability to implementation code
- All implementation code must have SPEC markers
- All acceptance criteria must have corresponding tests
- Verification reports must document gaps and compliance %

### Artifact Quality Standards

**Specs (bk-design):**

- Clear purpose statement
- Functional requirements with evidence
- Design decisions with rationale and trade-offs
- Verifiable acceptance criteria
- Concern mapping to requirements

**Plans (bk-plan):**

- Task breakdown with dependencies
- Traceability matrix (FR → Tasks → Code)
- Estimated complexity
- Risk assessment

**Tests (bk-tdd):**

- Test names matching acceptance criteria
- Edge cases covered
- Mocking for external dependencies
- Clear failure messages

**Implementation (bk-implement):**

- SPEC markers at function/module level
- Type-safe interfaces
- Error handling with explicit types
- Documentation for public APIs

**Verification (bk-verify):**

- Compliance percentage by requirement
- Gap analysis with severity
- Action items for missing items
- Historical tracking

## Legacy Code Note

This project evolves from `botpane`'s `libvault` crate. The Rust core has been copied and needs refactoring to fit Tauri's architecture:

- FFI bindings → Tauri commands
- Global state → Tauri managed state
- Platform abstractions → Tauri APIs

**Refactoring priorities:**

1. Extract pure business logic (no I/O) for testability
2. Wrap in Tauri command layer
3. Replace manual serialization with proper types
4. Add async where appropriate (Tauri commands are async)

## MCP Integration

Knot exposes a Model Context Protocol server for AI agents:

- **Tools:** `search_notes`, `get_note`, `list_tags`, `graph_neighbors`
- **Resources:** Notes as markdown, graph as JSON
- **Local only:** MCP server binds to localhost, no external exposure

## Bilingual Support

Bulgarian + English first-class support:

- Tantivy index with Bulgarian Snowball stemmer
- UI translations (i18n)
- Note content language detection (Cyrillic heuristic)

## Skills Reference

This project uses the bk-\* skill system. **Skills are MANDATORY, not optional.**

### Workflow Skills

| Skill                     | Purpose                        | When to Use                               | Output                               |
| ------------------------- | ------------------------------ | ----------------------------------------- | ------------------------------------ |
| `bk-bootstrap`            | Workflow selection and routing | Starting new work, unsure of next step    | Recommended skill to use             |
| `bk-design`               | Architecture specifications    | Creating new features, modifying existing | Spec document in `docs/specs/`       |
| `bk-plan`                 | Implementation planning        | After spec exists, before coding          | Implementation plan in `docs/plans/` |
| `bk-tdd`                  | Test-driven development        | Before writing any implementation code    | Failing tests in `tests/`            |
| `bk-implement-rust`       | Rust code generation           | After tests exist, implementing Rust      | Working code with SPEC markers       |
| `bk-implement-typescript` | TypeScript code generation     | After tests exist, implementing TS        | Working code with SPEC markers       |
| `bk-verify`               | Verification against specs     | After implementation completes            | Compliance report in `docs/audit/`   |

### Supporting Skills

| Skill              | Purpose                                       | When to Use                                       |
| ------------------ | --------------------------------------------- | ------------------------------------------------- |
| `bk-explore`       | Conversational exploration before formal spec | Starting new features, understanding requirements |
| `bk-ideate`        | Evaluate multiple approaches                  | Research shows multiple viable paths              |
| `bk-worktree`      | Create isolated git worktrees                 | Starting feature work needing isolation           |
| `bk-analyze`       | Reverse engineer code to specs                | Understanding brownfield code                     |
| `bk-debug`         | Systematic debugging                          | Encountering bugs or test failures                |
| `bk-execute`       | Execute plans with parallel subagents         | Independent tasks in worktrees                    |
| `bk-finish-branch` | Commit, verify, prepare PR                    | Implementation done and verified                  |
| `bk-ship`          | Release preparation                           | Preparing releases with verification              |

### Usage Rules

1. **ALWAYS load skill before starting work** - Use `skill` tool with appropriate name
2. **Follow skill workflow exactly** - Don't skip steps or take shortcuts
3. **Wait for completion** - One skill must finish before moving to next
4. **Don't mix workflows** - Complete one skill's workflow before invoking next
5. **Create artifacts** - Each skill produces specific outputs (see tracking table above)

**Example Correct Usage:**

```
User: Implement note editor

1. skill: bk-design → Create/update spec
2. Wait for bk-design completion
3. skill: bk-plan → Create implementation plan
4. Wait for bk-plan completion
5. skill: bk-tdd → Write tests
6. Wait for bk-tdd completion
7. skill: bk-implement-typescript → Write code
8. Wait for bk-implement-typescript completion
9. skill: bk-verify → Verify compliance
10. Wait for bk-verify completion
```

**Example Incorrect Usage:**

```
User: Implement note editor

❌ Read Editor.tsx, say "it's already done"
❌ Write code directly without tests
❌ Run tests manually without using bk-tdd
❌ Declare success without bk-verify
```

**Remember:** Skills enforce discipline. Bypassing them guarantees missed artifacts and incomplete work.

## Communication Style

- **Concise** - Prefer short, clear responses
- **Proactive** - Suggest next steps, don't wait for prompts
- **Evidence-based** - Show code, errors, or data when making claims
- **No noise** - Skip platitudes and unnecessary confirmations

## Constraints Summary

| Constraint               | Implication                                                         |
| ------------------------ | ------------------------------------------------------------------- |
| Distraction-free editing | ProseMirror with custom NodeViews                                   |
| Desktop + Android        | Tauri 2.0 mobile support                                            |
| Type discipline          | Strict TypeScript, no `any`                                         |
| Privacy-first            | Local-only, P2P sync, no cloud                                      |
| AI-native                | MCP server, RAG-ready                                               |
| Bulgarian + English      | Tantivy stemmers, i18n                                              |
| **Workflow discipline**  | bk-design → bk-plan → bk-tdd → bk-implement → bk-verify (MANDATORY) |
| **Artifact tracking**    | All steps must produce documented outputs in specific locations     |

---

**Project root:** `../knot` (sibling to `botpane`)
**Start date:** 2026-02-19
**Status:** Active development (Tauri 2.0 PoC)
