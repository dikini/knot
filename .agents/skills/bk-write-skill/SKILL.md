---
name: bk-write-skill
description: Create new bk-* skills. Defines skill structure, triggers, workflow, and documentation. Use when extending the bk-* ecosystem.
triggers:
  - "write a skill"
  - "create skill"
  - "new skill"
  - "skill definition"
---

# bk-write-skill: Create New Skills

## Purpose
Create new skills that extend the bk-* ecosystem.

## When to Use
- You need a skill that doesn't exist
- You want to add a new `bk-implement-*` for another language
- You want to add a specialized process skill

## When NOT to Use
- A similar skill already exists (use that)
- It's a one-off script (use `bk-implement-*`)

## Quality Criteria for Skills

Before creating a skill, verify:
- **Size**: < 200 lines for focused skills, < 400 for orchestrators
- **Token budget**: Aim for < 2KB per skill, < 5KB for complex ones
- **Triggers**: 3+ words to avoid false activation (avoid single words)
- **Uniqueness**: No > 30% overlap with existing skills
- **References**: Move examples/templates to `references/` directory

## Skill Structure

```markdown
---
name: bk-<name>
description: <Clear, specific description>
triggers:
  - "<verb phrase 1>"  # Good: "implement in python"
  - "<verb phrase 2>"  # Bad: "implement"
---

# bk-<name>: <Title>

## Purpose
<What this skill does and when to use it>

## When to Use
- <Situation 1>
- <Situation 2>

## When NOT to Use
- <Anti-pattern 1>
- <Anti-pattern 2>

## Inputs
```yaml
param1: type    # Required: Description
param2: type    # Optional: Description (default: value)
```

## Workflow
1. <Step 1>
2. <Step 2>
3. <Step 3>

## Output
- <Output 1>
- <Output 2>

## Example
```
<Brief example showing skill in action>
```

## Next Steps
- <Suggested next skill>

## References
- [detailed-examples.md](references/detailed-examples.md) - If needed
```

## Trigger Design Guidelines

**Good triggers** (specific, verb phrases):
- "implement in rust"
- "execute plan"
- "test driven development"
- "verify completion"

**Bad triggers** (too generic, single words):
- "implement" (too broad)
- "test" (too vague)
- "run" (ambiguous)
- "help" (too generic)

**Length**: 3-5 words optimal, 2 words minimum.

## Workflow

### 1. Define Purpose
- What problem does this solve?
- Which phase of development? (exploration, design, implementation, verification, release)
- Process or implementation skill?

### 2. Identify Integration
- **Upstream**: Which skills lead to this one?
- **Downstream**: Which skills does this lead to?
- **Inputs**: What does it consume? (specs, plans, code)
- **Outputs**: What does it produce? (specs, plans, code, reports)

### 3. Write Skill
- Create `.codex/skills/bk-<name>/SKILL.md`
- Use structure template above
- Define triggers (3+ words, specific)
- Document workflow (< 7 steps)
- Add brief example (< 20 lines)

### 4. Create References (if needed)
If skill needs > 150 lines for examples/templates:
- Create `references/` subdirectory
- Move detailed content there
- Link from main SKILL.md

### 5. Test Integration
**Manual walkthrough**:
```bash
# Simulate upstream skill output
echo "<output from upstream>" > /tmp/test-input

# Test this skill with that input
<trigger skill> --input=/tmp/test-input

# Verify output format matches downstream expectations
```

**Check for overlap**:
```bash
# Search for similar triggers
rg "<trigger-phrase>" .codex/skills/*/SKILL.md

# If found, compare:
# - Do both skills serve same purpose?
# - Can they be merged?
# - Are boundaries clear?
```

### 6. Update bk-bootstrap
Add entry to `bk-bootstrap/SKILL.md`:
```markdown
| **bk-<name>** | <When to use> | <Output> |
```

## Testing Methodology

### Unit Test (Skill Isolation)
1. Create test scenario
2. Invoke skill with test inputs
3. Verify output format
4. Verify output content

### Integration Test (Workflow)
1. Start with upstream skill output
2. Run your skill
3. Pass output to downstream skill
4. Verify full workflow completes

### Overlap Test
1. List all bk-* skills
2. Compare triggers
3. Compare workflows
4. Identify > 30% similarity
5. Either merge or document clear boundaries

## Example Session

```
User: "Create a skill for Python implementation"

bk-write-skill:

1. Purpose:
   - Generate Python code from plans
   - Phase: Implementation
   - Type: Implementation skill

2. Integration:
   - Upstream: bk-plan (produces task breakdown)
   - Downstream: bk-verify-completion (checks code quality)
   - Inputs: plan_path, task_ref
   - Outputs: Python code + tests

3. Write skill:
   File: .codex/skills/bk-implement-python/SKILL.md
   Triggers:
     - "implement in python"
     - "write python code"
     - "python implementation"

4. Test:
   - Trigger: "implement in python --task=TS-001"
   - Output: Python file with code + tests
   - Integration: bk-plan → bk-implement-python → bk-verify-completion ✓

5. Update bk-bootstrap:
   Added: | bk-implement-python | Python code generation | Code + tests |
```

## Quality Checklist

Before considering skill complete:
- [ ] Size < 200 lines (or < 400 for orchestrator)
- [ ] Triggers are 3+ word phrases (no single words)
- [ ] No > 30% overlap with existing skills
- [ ] Example is < 20 lines, clear
- [ ] References created for detailed content (if > 150 lines total)
- [ ] Tested in isolation (correct output format)
- [ ] Tested in workflow (integrates with upstream/downstream)
- [ ] Added to bk-bootstrap skill table
- [ ] Token estimate < 2KB (or < 5KB for complex)

## Output
- `.codex/skills/bk-<name>/SKILL.md`
- `references/` (if needed)
- Updated `bk-bootstrap/SKILL.md` (added to table)

## Next Steps
- Test the skill in a real scenario
- Get feedback from users
- Iterate based on usage patterns
