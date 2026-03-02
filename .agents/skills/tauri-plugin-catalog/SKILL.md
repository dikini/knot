---
name: tauri-plugin-catalog
description: Use when you need a normalized catalog of public Tauri plugins with metadata for selection, comparison, or architecture decisions.
triggers:
  - "list tauri plugins"
  - "catalog tauri plugins"
  - "compare tauri plugins"
  - "find tauri plugin"
  - "what tauri plugins exist"
---

# tauri-plugin-catalog

## Purpose
Build a normalized catalog of publicly available Tauri plugins across official and community sources.

Use this skill when the task is not "pick one plugin from memory" but "produce a defensible plugin inventory with metadata the team can filter later".

## When to Use
- Plugin discovery for a feature
- Build-vs-buy decisions around Tauri capabilities
- Ecosystem comparison before design
- Auditing whether an official plugin exists before adopting a community one

## When NOT to Use
- Internal Knot plugin architecture work
- Non-Tauri package discovery
- Deep technical evaluation of a single plugin after selection

## Required Metadata

Every plugin entry should be normalized to this schema:

```yaml
name: string
origin: official | community
description: string
platforms: [desktop | android | ios | linux | macos | windows | web | unknown]
production_state: production | beta | experimental | archived | inactive | unknown
repository: string
source_of_truth: string
tauri_version: v1 | v2 | mixed | unknown
notes: string
```

`origin` is mandatory metadata. Do not split official and community into separate incompatible formats.

## Source Priority

Use primary sources first:

1. Official Tauri plugin workspace and docs
2. Plugin repository README / docs
3. Curated community lists such as Awesome Tauri
4. Repository metadata signals: archived status, recent activity, releases, issues

If curated lists conflict with the repository, trust the repository.

## Production State Rubric

Apply one label per plugin:

| State | Use When |
|-------|----------|
| `production` | Stable public plugin, maintained, documented, no clear warning against production use |
| `beta` | Marked beta, preview, release candidate, or missing stability guarantees |
| `experimental` | Explicitly experimental, early-stage, or proof-of-concept |
| `archived` | Repository archived or clearly discontinued |
| `inactive` | Not archived, but maintenance appears stalled and signals suggest risk |
| `unknown` | Not enough evidence to classify safely |

When evidence is indirect, say so in `notes`.

## Workflow

### 1. Gather Candidate Plugins
- Collect official plugins from `tauri-apps/plugins-workspace`
- Collect community plugins from curated public lists and direct repository discovery
- Exclude private, unpublished, or obviously unrelated repositories

### 2. Normalize Metadata
For each plugin, extract:
- concise description
- supported platforms
- origin
- production state
- repository URL
- source-of-truth URL
- supported Tauri generation when discoverable
- notable caveats

Prefer explicit platform statements. If only implied, mark `unknown` and explain in `notes`.

### 3. Assess Production Readiness
Use explicit repository wording first, then maintenance signals:
- archived badge or repository state
- release cadence
- issue activity
- documentation completeness
- examples / install instructions

Do not overstate confidence. `unknown` is better than invented certainty.

### 4. Present the Catalog
Default output is a Markdown table plus a machine-friendly JSON block using the same schema.

Recommended Markdown columns:

| Plugin | Origin | Description | Platforms | State | Tauri | Repository | Notes |
|--------|--------|-------------|-----------|-------|-------|------------|-------|

### 5. Summarize Decision Guidance
After the catalog, add short takeaways such as:
- official option exists / does not exist
- strongest production-ready options
- mobile-specific gaps
- plugins needing extra diligence

## Output Contract

Return:
- one normalized catalog covering both official and community plugins
- explicit source links
- a short section for gaps and uncertain classifications

## Example

```markdown
Need: "Find Tauri plugins for storage and networking."

Approach:
- Query official workspace first
- Add community candidates from Awesome Tauri
- Normalize all entries with `origin`
- Mark `sql` and `store` as `official`
- Mark a third-party MQTT plugin as `community`
- Flag uncertain maintenance as `inactive` or `unknown` with notes
```

## Next Steps

- Use `bk-research` if the catalog needs deeper comparative analysis
- Use `bk-design` once plugin choice affects architecture
