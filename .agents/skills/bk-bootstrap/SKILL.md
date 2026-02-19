---
name: bk-bootstrap
description: Router for the bk-* ecosystem. Explains workflow selection and which skill to use for each phase of development.
triggers:
  - "which bk skill"
  - "bk-* workflow"
  - "bk ecosystem"
  - "explain bk skills"
  - "bk framework"
---

# bk-bootstrap: bk-* Ecosystem Router

## Purpose

The **bk-*** (build kit) skills are a framework for software development combining **process** (planning, design, verification) with **implementation** (coding, testing, shipping).

This skill helps you select the right skill for your current phase.

## Quick Decision Tree

```
Do you know exactly what to build?
├── YES → Is it well-understood?
│         ├── YES → bk-plan → bk-execute
│         └── NO  → bk-design → bk-plan → bk-execute
└── NO  → Do you know the problem space?
          ├── YES → bk-ideate (evaluate approaches)
          └── NO  → bk-explore (flesh out idea)
```

## Skill Categories

### Process Skills (What & How to Build)

| Skill | Use When | Output |
|-------|----------|--------|
| **bk-explore** | Vague idea, unclear requirements | Problem clarity |
| **bk-research** | Need to evaluate solutions | Comparison report |
| **bk-ideate** | Multiple viable approaches | Approach selection |
| **bk-design** | Ready to formalize design | Specification |
| **bk-plan** | Ready to implement | Task breakdown |
| **bk-verify** | Check spec compliance | Compliance report |
| **bk-ship** | Prepare release | Release artifacts |

### Implementation Skills (Writing Code)

| Skill | Use When | Output |
|-------|----------|--------|
| **bk-execute** | Execute plan with subagents | Implemented code in worktree |
| **bk-implement-rust** | Implement Rust code | Code + tests + markers |
| **bk-implement-typescript** | Implement TypeScript code | Code + tests + markers |
| **bk-tdd** | Test-driven development | Tests + implementation |
| **bk-debug** | Systematic debugging | Root cause + fix |
| **bk-verify-completion** | Pre-commit quality check | Pass/fail status |
| **bk-finish-branch** | Complete branch, prepare PR | PR description |
| **bk-worktree** | Create isolated workspace | Worktree directory |

## The Golden Path

Most common workflow:

```
bk-explore → bk-design → bk-plan → bk-execute → bk-verify → bk-finish-branch → bk-ship
```

**Simplified for well-understood work**:
```
bk-plan → bk-execute → bk-verify → bk-finish-branch
```

## Key Principles

### 1. Process Before Implementation
Use exploration/design/planning skills before writing code.

### 2. All Implementation via Subagents
`bk-execute` creates worktrees and dispatches subagents. Never implement directly in main workspace.

### 3. Sequential by Default
Use `bk-execute --mode=sequential` (one worktree, tasks in order) unless tasks are truly independent.

### 4. Verify Incrementally
Run `bk-verify-completion` after each task, `bk-verify` before shipping.

## Common Scenarios

### Scenario: "I have a vague idea"
```
bk-explore → clarify → bk-research (if novel) → bk-design → bk-plan → bk-execute
```

### Scenario: "I know what to build"
```
bk-design → bk-plan → bk-execute
```

### Scenario: "I have a spec, need to implement"
```
bk-plan → bk-execute
```

### Scenario: "Something's broken"
```
bk-debug → (bk-design if complex) → bk-implement-rust → bk-verify
```

### Scenario: "Ready to release"
```
bk-verify --scope=full → bk-ship
```

## Execution Modes

### bk-execute: Sequential (Recommended)
- **When**: Tasks dependent, build on each other, or share files
- **How**: One worktree, subagents execute tasks in order
- **Benefit**: No merge conflicts, linear history

### bk-execute: Parallel (Use Cautiously)
- **When**: Tasks are independent, different modules
- **How**: Multiple worktrees, simultaneous execution
- **Risk**: Manual merge required, potential conflicts

**Default**: If unsure, use sequential.

## Skill Reference Quick Lookup

| I need to... | Use |
|--------------|-----|
| Understand what to build | `bk-explore` |
| Research options | `bk-research` |
| Evaluate approaches | `bk-ideate` |
| Write a spec | `bk-design` |
| Plan implementation | `bk-plan` |
| Execute plan | `bk-execute` |
| Work in isolation | `bk-worktree` |
| Debug systematically | `bk-debug` |
| Use TDD | `bk-tdd` |
| Implement Rust code | `bk-implement-rust` |
| Implement TypeScript code | `bk-implement-typescript` |
| Check before commit | `bk-verify-completion` |
| Check spec compliance | `bk-verify` |
| Finish branch | `bk-finish-branch` |
| Release | `bk-ship` |

## Integration Example

```
bk-explore: "Add caching to provider system"
  ↓
bk-research: "Rust caching libraries" → recommends moka
  ↓
bk-design: Creates COMP-CACHE-001 spec
  ↓
bk-plan: Breaks down into 5 tasks
  ↓
bk-execute --mode=sequential: Implements in worktree
  └─ Subagents execute TS-001 through TS-005
  ↓
bk-verify: Checks compliance → 100%
  ↓
bk-finish-branch: Prepares PR
  ↓
bk-ship: Generates release docs
```

## References

For detailed examples, see:
- [workflows.md](references/workflows.md) - Full workflow walkthroughs, patterns, anti-patterns

## Next Steps

- **New user**: Start with `bk-explore` on a small idea
- **Have spec**: Use `bk-plan`
- **Have plan**: Use `bk-execute`
- **Questions**: Ask "How do I [X]?" and appropriate skill will activate
