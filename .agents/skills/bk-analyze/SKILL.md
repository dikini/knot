---
name: bk-analyze
description: Reverse engineer brownfield code to specifications. Extract business rules, interfaces, and behaviors from existing implementations to generate BK-compatible specs.
triggers:
  - "analyze codebase"
  - "extract specs from"
  - "reverse engineer"
  - "brownfield analysis"
  - "understand existing code"
  - "generate spec from code"
---

# bk-analyze: Brownfield Code Analysis

## Purpose
Transform existing code into formal specifications that integrate with the BK development workflow. Enables incremental modernization, refactoring, and compliance documentation of legacy systems.

## When to Use
- Starting work on an unfamiliar brownfield codebase
- Documenting legacy systems that lack specifications
- Preparing for refactoring or migration
- Generating compliance documentation from existing code
- Bridging knowledge gaps in maintained systems

## When NOT to Use
- Greenfield development (use `bk-explore` → `bk-design` instead)
- Codebases already have comprehensive specs (use `bk-verify`)
- Simple bug fixes (use `bk-debug` → `bk-tdd`)

## Inputs
```yaml
codebase_path: path        # Required: Root path to analyze
component_name: string     # Required: Logical name for extracted component
depth: enum                # Optional: surface | standard | deep (default: standard)
entry_points: list         # Optional: Specific files/modules to focus analysis
exclude_patterns: list     # Optional: Patterns to exclude (e.g., ["tests/", "vendor/"])
```

## Discovery Conventions

This skill relies on filesystem discovery rather than status fields. Downstream skills locate specs via:

```
docs/specs/extracted/*.md    # Machine-generated specs
docs/specs/component/*.md    # Human-designed components
docs/specs/interface/*.md    # Human-designed interfaces
```

The `spec-map.md` registry tracks immutable metadata only:
```yaml
spec_id: string      # e.g., AUTH-001
source: enum         # extracted | designed
path: string         # relative to docs/specs/
concerns: list       # [SEC, REL, CAP, OBS, ...]
```

## Workflow

### 1. Discovery Phase

Scan the codebase to understand structure:

**Structural mapping:**
- Identify modules, crates, packages
- Map public APIs (functions, traits, structs)
- Find entry points and external boundaries
- Locate test files for behavior inference

**Source analysis:**
- Language detection (Rust, Python, Go, etc.)
- Framework identification
- Dependency graph (internal and external)

**Output artifact:** `docs/analysis/<component>-structure.md` (optional, for deep analysis)

### 2. Extraction Phase

Extract specifications from code:

**Functional requirements (FR-*)**
- Public methods → interface requirements
- Business logic → behavioral requirements
- Configuration → operational requirements

**Interfaces (IF-*)**
- Function signatures
- Data structures / DTOs
- Error types and handling patterns

**Cross-cutting concerns**
- Security boundaries → SEC
- Retry/circuit breaker → REL
- Metrics/logging → OBS
- Rate limits/backpressure → CAP

**Inference heuristics:**
```
fn validate_token(&self, token: &str) -> Result<Claims, AuthError>
↓
FR-1: Validate authentication token
IF-1: Input: token string, Output: Claims or AuthError
SEC-1: Authentication boundary

#[test]
fn test_expired_token_rejected()
↓
FR-2: Reject expired tokens
Acceptance: Expired tokens return AuthError::Expired
```

### 3. Synthesis Phase

Generate formal BK specification:

**File:** `docs/specs/extracted/<component>-<nnn>.md`

**Template:**
```markdown
# <Component Name>

## Metadata
- ID: `<SCOPE>-<COMPONENT>-<NNN>` (e.g., COMP-AUTH-001)
- Source: `extracted`
- Component: `<component_name>`
- Depth: `<surface|standard|deep>`
- Extracted: `<date>`
- Concerns: [<inferred concerns>]

## Source Reference
- Codebase: `<codebase_path>`
- Entry Points: [<entry files>]
- Lines Analyzed: <count>

## Confidence Assessment
| Requirement | Confidence | Evidence | Needs Review |
|-------------|------------|----------|--------------|
| FR-1: ... | high | Clear implementation + tests | no |
| FR-2: ... | medium | Inferred from behavior | yes |

## Contract

### Functional Requirements
**FR-1**: <Extracted requirement>
- Evidence: `<file>:<line>`
- Confidence: <high|medium|low>

**FR-2**: <Extracted requirement>
...

### Interface
```<language>
<Extracted signatures>
```

### Behavior
**Given** <precondition>
**When** <action>
**Then** <outcome>
- Evidence: `<test file>:<line>` (if from test)

## Design Decisions (Inferred)
| Decision | Evidence | Confidence |
|----------|----------|------------|
| Uses async runtime | `src/main.rs:23` | high |
| Token expiry = 1hr | `src/auth.rs:45` | medium |

## Uncertainties
- [ ] <Question about unclear code>
- [ ] <Ambiguous business rule>

## Acceptance Criteria (Derived from Tests)
- [ ] <Test-derived criterion>

## Related
- Extracted from: `<codebase_path>`
- Depends on: [<other specs if detected>]
- Used by: [<detected consumers>]
```

### 4. Registration Phase

Update `docs/specs/system/spec-map.md`:

```markdown
## Components
| Spec | Source | Path | Concerns |
|------|--------|------|----------|
| COMP-AUTH-001 | extracted | extracted/auth-001.md | [SEC, REL] |
```

**Rules:**
- Generate next available `<nnn>` for component (001, 002, ...)
- Set `source: extracted` (immutable)
- Infer `concerns` from code patterns
- Never duplicate existing spec IDs

## Confidence Levels

Every extracted requirement has a confidence level:

| Level | Criteria | Action |
|-------|----------|--------|
| **high** | Clear code + comprehensive tests | Use as-is |
| **medium** | Clear code OR tests, not both | Review recommended |
| **low** | Inferred from indirect evidence | Must review |

Downstream skills can filter by confidence if needed.

## Output

1. **Primary:** `docs/specs/extracted/<component>-<nnn>.md` - Formal specification
2. **Registry:** Updated `docs/specs/system/spec-map.md` with immutable metadata
3. **Optional:** `docs/analysis/<component>-structure.md` - Detailed structural analysis (deep mode)

## Downstream Integration

### With bk-plan
```
User: Plan implementation for auth module

1. LLM scans spec-map.md for auth-related specs
2. Finds COMP-AUTH-001 with source=extracted
3. Loads spec from docs/specs/extracted/auth-001.md
4. Notes confidence levels for planning
5. Proceeds with normal bk-plan workflow
```

**Considerations:**
- Low-confidence requirements may need research tasks
- Uncertainties become planning questions
- Extracted interfaces may need refinement

### With bk-verify
```
bk-verify --scope=full

1. Discovers spec in extracted/ directory
2. Scans codebase for SPEC-COMP-AUTH-001 markers
3. Reports coverage: which extracted requirements are marked in code
```

Note: Extracted specs may initially have no markers. The goal is to add markers during refactoring to establish traceability.

### With bk-design
```
User: Refine the extracted auth spec

bk-design --spec-path=docs/specs/extracted/auth-001.md

1. Moves spec from extracted/ to component/ or interface/
2. Updates source from extracted → designed
3. Now treated as authoritative specification
```

## Example Workflow

### Analyzing Legacy Authentication

```
User: Analyze the auth module in src/auth/

bk-analyze:

1. Discovery:
   - Scans src/auth/ (12 files, 2,400 LOC)
   - Identifies: token validation, session management, refresh flow
   - Finds: 23 tests covering main paths

2. Extraction:
   - FR-1: Validate JWT signature (high confidence - tests present)
   - FR-2: Refresh expired tokens (medium - inferred from flow)
   - IF-1: Auth trait with validate(), refresh()
   - Concerns: [SEC, REL] inferred from code patterns

3. Synthesis:
   Generates: docs/specs/extracted/auth-001.md
   
4. Registration:
   Updates: docs/specs/system/spec-map.md
   | COMP-AUTH-001 | extracted | extracted/auth-001.md | [SEC, REL] |

Output: Extracted 8 requirements with 75% high confidence. 
        2 uncertainties flagged for review.
```

### Chaining to Planning

```
User: Plan refactoring for the auth module

bk-plan:

1. Discovery:
   - Scans spec-map.md for auth specs
   - Finds COMP-AUTH-001, source=extracted
   - Loads: docs/specs/extracted/auth-001.md

2. Analysis:
   - Sees FR-2 (refresh tokens) has medium confidence
   - Sees uncertainty about rate limiting
   - Adds research task for unclear requirements

3. Planning:
   - Creates tasks for high-confidence requirements
   - Adds "clarify rate limiting" task for uncertainty
   - Generates: docs/plans/auth-refactor-plan-001.md
```

## Guardrails

1. **Never overwrite existing specs** - Generate new `<nnn>` if conflict
2. **Mark all uncertainties explicitly** - Don't guess business intent
3. **Preserve evidence** - Every requirement cites source file/line
4. **Confidence honesty** - Don't inflate confidence to appear complete
5. **Source separation** - Keep extracted specs in dedicated directory

## Limitations

- Cannot infer implicit business knowledge
- Tests may not cover all production behaviors
- Legacy code may have dead/unreachable paths
- Extracted specs represent "as-is", not "should-be"

## Future Enhancements (Out of Scope)

- Multi-language analysis
- Cross-repository dependency mapping
- Automated confidence improvement via test analysis
- Diff-based re-extraction for evolving codebases
