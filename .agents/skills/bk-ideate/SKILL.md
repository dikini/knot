---
name: bk-ideate
description: Generate and evaluate multiple approaches before committing. Use when research shows multiple viable paths or when designing novel solutions. Time-boxed to ~30 minutes.
triggers:
  - "ideate"
  - "brainstorm"
  - "explore options"
  - "what are the approaches"
  - "generate ideas"
  - "compare approaches"
  - "design alternatives"
---

# bk-ideate: Approach Generation & Evaluation

## Purpose
Generate multiple viable approaches, evaluate systematically, and select the best path forward.

## When to Use
- Research shows multiple viable solutions
- Multiple technical paths possible
- Designing novel solutions
- Architecture decisions

**Time Budget**: ~30 minutes to produce 3 approaches

## Inputs
```yaml
problem: string             # Required: Problem statement
context: string             # Optional: Research context or prior knowledge
constraints: list           # Optional: Hard constraints
goals: list                 # Optional: Success criteria
```

## Workflow

### 1. Understand Context
Load:
- Research findings (if `bk-research` was run)
- Existing system constraints
- Related specs/interfaces

### 2. Generate 3 Approaches

Create 3-5 distinct approaches:

**Approach 1: <Name>**
- **Concept**: Brief description
- **How**: Mechanism
- **Pros**: Strengths
- **Cons**: Weaknesses
- **When**: Best fit scenarios

**Approach 2: <Name>**
...

### 3. Evaluation Matrix

Score each approach:

| Criterion | Approach 1 | Approach 2 | Approach 3 |
|-----------|------------|------------|------------|
| <Goal 1> | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| <Goal 2> | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ |
| Complexity | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ |
| Risk | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |

### 4. Recommendation

```markdown
**Selected**: <Approach N>
**Rationale**: <why this one>
**Confidence**: High | Medium | Low
**Reconsider if**: <trigger conditions>
```

### 5. Loop-Back (if needed)

If ideation reveals the problem is poorly defined:
```
"After exploring these approaches, the core problem seems unclear.

→ Return to bk-explore to clarify requirements"
```

## Ideation Patterns

Use these to generate diverse approaches:

| Pattern | Example Approaches |
|---------|-------------------|
| **Evolutionary** | Minimal change, Moderate refactor, Full rewrite |
| **Architecture** | Monolithic, Modular, Microservices |
| **Strategy** | Optimistic (retry), Pessimistic (circuit breaker), Adaptive (ML) |
| **Integration** | In-process, Sidecar, External service |

## Output Format

**Concise** (not full template):
```markdown
# Ideation: <Problem>

## Approaches

### 1. <Name>
- **How**: <mechanism>
- **Pros**: <list>
- **Cons**: <list>

### 2. <Name>
...

## Evaluation
<Scoring matrix>

## Recommendation
**Selected**: <Approach N>
**Why**: <rationale>
```

Save to: `docs/ideation/<problem>-<date>.md`

## Quality Checklist

Each approach should:
- [ ] Solve the core problem
- [ ] Be implementable within constraints
- [ ] Have clear trade-offs stated
- [ ] Be meaningfully different from others

## Example

```
User: "Ideate approaches for provider rate limiting"

bk-ideate:

Context:
- Current: No rate limiting
- Problem: Hitting 429 errors
- Goal: Prevent 429s, minimize latency

Approaches:

1. **Token Bucket (Client-side)**
   - Track limits locally
   - Pros: Fast, no server changes
   - Cons: Can drift from actual limits

2. **Adaptive Backoff (Server-aware)**
   - React to 429 responses
   - Pros: Accurate, handles dynamic limits
   - Cons: Allows some failures

3. **Request Queue + Scheduler**
   - Queue all, schedule within limits
   - Pros: Precise control, fair
   - Cons: Adds latency, complex

Evaluation:
| Criterion | 1 | 2 | 3 |
|-----------|---|---|---|
| Prevents 429s | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| Low latency | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| Simplicity | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ |

Recommendation: **Approach 2** (Adaptive Backoff)
- Best balance: effective + simple
- Confidence: High
- Reconsider if: >5% requests hit 429

→ Next: bk-design (create spec for approach 2)
```

## Next Steps

- **bk-design**: Create spec for selected approach
- **bk-research**: If approaches need deeper validation
- **bk-ideate**: Repeat if current set insufficient
