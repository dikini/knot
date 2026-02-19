---
name: bk-explore
description: Conversational exploration of ideas before formal specification. Use when starting new features, understanding requirements, or exploring possibilities. Time-boxed to 10-30 minutes.
triggers:
  - "explore"
  - "think about"
  - "what if"
  - "how might we"
  - "let's discuss"
  - "idea for"
---

# bk-explore: Conversational Exploration

## Purpose
Explore ideas informally before committing to formal research or design. Clarify what you want to build through dialogue.

## When to Use
- You have a vague idea and need to flesh it out
- You're not sure what problem you're solving
- You want to bounce ideas around
- You're exploring multiple possibilities

**Skip if**: Requirements are already clear → go to `bk-research` or `bk-design`

## Philosophy

- **Conversation over ceremony** - Dialogue, not forms
- **Questions over assumptions** - One question at a time
- **YAGNI from the start** - Ruthlessly remove unnecessary complexity
- **Bridge to structure** - Transition to formal workflow when ready
- **Time-boxed** - 10-30 minutes max

## Workflow

### Phase 1: Understand Context (Auto)
Read current state:
- `docs/specs/system/spec-map.md` - What's already built
- Recent changes in relevant crates

### Phase 2: Explore Through Dialogue

Ask **one question at a time**:

**The Problem**:
- What are you trying to solve?
- Who is this for?
- What does success look like?

**The Context**:
- What constraints exist?
- Are there dependencies?

**The Approach**:
- Have you thought about...?
- What if we did X instead of Y?
- How does this fit with existing architecture?

Use **multiple choice** when possible:
> "Are you thinking of:
> a) A new component
> b) An extension to existing component X
> c) A cross-cutting concern?"

### Phase 3: Synthesize & Propose

Once understanding emerges, propose 2-3 approaches with trade-offs:

```
Based on our discussion:

**Approach A: Minimal Change**
- Pros: Low risk, fast
- Cons: Doesn't solve Y completely
- Best if: Time is tight

**Approach B: New Component**
- Pros: Clean separation, testable
- Cons: More work
- Best if: This will grow

My recommendation: **B** because you mentioned this needs to scale.

What do you think?
```

### Phase 4: Transition to Next Skill

Once direction is clear:

| Condition | Next Skill | Why |
|-----------|------------|-----|
| Novel/unfamiliar | `bk-research` | Need to understand solution space |
| Multiple paths | `bk-ideate` | Need systematic evaluation |
| Clear direction | `bk-design` | Ready for formal spec |
| Trivial/known | `bk-plan` | Skip spec, just plan implementation |

## Time-Boxing

**10-30 minutes** is the target.

If still uncertain after 30 min:
- **Option A**: Transition to `bk-research` (need more information)
- **Option B**: Park the idea (not ready yet)

Don't over-explore. Exploration has diminishing returns.

## Output Artifacts

**During exploration** (optional):
- `docs/explore/<topic>-<date>.md` (rough notes)

**On transition**:
- Summary of findings
- Recommended next skill
- Key decisions made
- Open questions

## Example Session

```
User: I want to add caching to the provider system

bk-explore:

Q: "What kind of caching?
   a) API responses
   b) Model configurations
   c) Computed embeddings"

User: Mostly API responses - we're hitting rate limits

Q: "Cache key strategy:
   a) Same prompt + model = cache hit
   b) Semantic similarity
   c) Time-based windows"

User: Exact match - same prompt + model + params

Q: "TTL strategy:
   a) Fixed duration
   b) Model-specific
   c) Content-aware"

User: Model-specific - OpenAI vs local differ

Synthesis:
"So: Model-aware caching, exact-match keys, model-specific TTLs.

**Approach A: Simple HashMap** (in-memory, fast, no persistence)
**Approach B: Use moka crate** (production-ready, TTL, eviction)
**Approach C: Pluggable backend** (flexible, more complex)

Recommendation: **B** - production-ready with TTLs you need.

Sound good?"

User: Yes

→ Transitioning to bk-design (clear enough to spec)
```

## Guardrails

- **One question at a time** - Don't overwhelm
- **Validate understanding** - "Let me check if I understand..."
- **Be flexible** - Go back if needed
- **Know when to stop** - Clear direction → Transition
- **No code during exploration** - Hard gate until design/spec

## Next Steps

- **bk-research** - If solution space unfamiliar
- **bk-ideate** - If multiple approaches need evaluation
- **bk-design** - If ready to create formal spec
- **bk-plan** - If trivial, skip spec
