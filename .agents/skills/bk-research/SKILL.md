---
name: bk-research
description: Research problem space, existing solutions, and trade-offs before committing to an approach. Use for novel problems, technology selection, or architecture decisions.
triggers:
  - "research"
  - "investigate"
  - "compare options"
  - "evaluate"
  - "what exists"
  - "how do others"
  - "technology selection"
---

# bk-research: Problem Space Research

## Purpose
Understand the problem space, evaluate existing solutions, and identify trade-offs before design.

## When to Use
- Novel problems
- Technology selection
- Architecture decisions
- Unfamiliar domains

## Inputs
```yaml
topic: string               # Required: What to research
scope: enum                 # Required: technology | architecture | domain | competitive
depth: enum                 # Optional: quick | standard | deep (see below)
decision_criteria: list     # Optional: Must-haves and nice-to-haves
```

## Research Depth Levels

Scope guides output size, not time:

| Depth | Output | Use When |
|-------|--------|----------|
| **Quick** | 1-page summary + comparison table | Well-understood problem, standard tech selection |
| **Standard** | Full report with detailed comparison | Important architectural decision, moderate complexity |
| **Deep** | Full report + prototypes/benchmarks | Novel problem, high stakes, long-term commitment |

**Note**: LLM agents work differently than humans. "Scope" refers to output detail, not hours spent.

## Research Tools

Use these for gathering evidence:

| Tool | Use For |
|------|---------|
| **WebSearch** | Ecosystem scanning, recent trends |
| **crates.io** | Rust library evaluation |
| **GitHub API** | Library activity, issues, gotchas |
| **WebFetch** | Documentation, API references |

## Workflow

### 1. Define Research Questions
- What exists? (Existing solutions, libraries, patterns)
- What works? (Proven approaches, best practices)
- What doesn't? (Failed approaches, limitations)
- What's missing? (Gaps in current solutions)
- What are trade-offs? (Performance, complexity, maintenance)

### 2. Gather Evidence
- Search for solutions (Web Search, crates.io)
- Analyze libraries (GitHub activity, issues)
- Review documentation (WebFetch)
- Check community discussions (GitHub issues, forums)

### 3. Comparative Analysis

Comparison matrix:

| Solution | Pros | Cons | Maturity | Complexity |
|----------|------|------|----------|------------|
| Option A | ... | ... | Mature | Low |
| Option B | ... | ... | Growing | Medium |
| Option C | ... | ... | New | High |

### 4. Synthesize Findings

**Quick** (1-page):
```markdown
# Research: <Topic>

## Recommendation
<Option X> because <reasoning>

## Comparison
<table>

## Key Risk
<primary risk>
```

**Standard** (full report):
```markdown
# Research: <Topic>

## Executive Summary
- Recommendation: <Option> with rationale
- Confidence: High | Medium | Low
- Key Risk: <primary risk>

## Existing Solutions
<For each option: overview, pros, cons, fit>

## Trade-off Analysis
<Comparison table>

## Decision Matrix
<Against criteria>

## Recommendation
<Primary, fallback, when to reconsider>

## References
<Links>
```

**Deep** (report + validation):
- Everything from Standard
- Plus: Minimal prototypes to validate claims
- Plus: Benchmarks if performance critical

### 5. Spike/Prototype (Deep only)

If research is inconclusive, create minimal prototype:
```rust
// This is NOT implementation - it's evidence gathering
// File: spike/<topic>-<option>.rs

// Minimal code to validate:
// - Can we integrate this library?
// - Does the API work as documented?
// - What's the performance like?
```

## When to Stop Researching

- **Diminishing returns**: New info doesn't change decision
- **Clear winner**: One option dominates on key criteria
- **Sufficient confidence**: Risk understood and acceptable

## Output

`docs/research/<topic>-<date>.md` - Research report

## Example

```
User: "Research local LLM provider options for gadulka"

bk-research --depth=standard:

Research Questions:
- What local LLM options exist in Rust?
- How do they compare on API compatibility?
- Integration complexity?
- Production usage?

Gathers Evidence:
- WebSearch: "rust local llm inference"
- crates.io: Search for "llm", "inference"
- Finds: Ollama (HTTP API), llama.cpp (FFI), kalosm (native Rust)

Comparison:
| Option | Pros | Cons | Complexity |
|--------|------|------|------------|
| Ollama | Easy, popular, HTTP API | Extra process | Low |
| llama.cpp | Fast, native | Complex FFI bindings | High |
| kalosm | Pure Rust | Early stage, limited models | Medium |

Recommendation:
- **Primary**: Ollama via HTTP for v1 (easy integration)
- **Fallback**: llama.cpp for performance-critical paths
- **Reconsider**: When native Rust options mature

Archives: docs/research/local-llm-providers-2026-02-18.md

→ Next: bk-design (if building) or bk-ideate (if evaluating approaches)
```

## Next Steps

- **bk-ideate**: If research shows multiple viable paths
- **bk-design**: If research yields clear path
- **bk-research** (deeper): If critical gaps remain
