---
name: bk-ship
description: Release preparation with verification, changelog, and optional documentation generation. Use when preparing releases.
triggers:
  - "prepare release"
  - "ship version"
  - "release ready"
  - "cut release"
---

# bk-ship: Release Preparation

## Purpose
Prepare releases with verification, changelog updates, and optional documentation generation.

## When to Use
- Ready to release a version
- Completing a milestone
- Preparing release artifacts

## Inputs
```yaml
version: string             # Required: Version (e.g., "0.5.0")
scope: enum                 # Required: patch | minor | major
verify_first: bool          # Optional: Run verification (default: true)
generate_docs: bool         # Optional: Generate docs from specs (default: false)
update_changelog: bool      # Optional: Update CHANGELOG (default: true)
```

## Version Numbering

| Scope | Change | Example |
|-------|--------|---------|
| patch | x.y.Z+1 | 0.5.0 → 0.5.1 (bug fixes) |
| minor | x.Y+1.0 | 0.5.0 → 0.6.0 (features, compatible) |
| major | X+1.0.0 | 0.5.0 → 1.0.0 (breaking changes) |

## Workflow

### 1. Verification (if verify_first)

```bash
bk-verify --scope=full

# If fails:
#   - Fix gaps
#   - Re-run bk-verify
#   - Proceed when ✅
```

Block release if critical gaps found.

### 2. Update Changelog

Add to `CHANGELOG.md`:

```markdown
## [0.5.0] - 2026-02-18

### Added
- Cache layer with TTL ([COMP-CACHE-001](docs/specs/component/cache-001.md))
- Provider health checks ([COMP-HEALTH](docs/specs/component/health-001.md))

### Changed
- Updated scheduler policy ([SYS-SCHEDULER](docs/specs/system/scheduler.md))

### Fixed
- Race condition in cleanup ([SPEC-CONS-001](docs/specs/cross-cutting/cons-001.md))

### Compliance
- Spec compliance: 95%
- Critical gaps: 0
- Test coverage: 87%
```

### 3. Generate Documentation (if generate_docs)

**Uses templates from** [references/doc-templates.md](references/doc-templates.md)

Generates:
- `docs/releases/<version>/api-reference.md` (from IF-* specs)
- `docs/releases/<version>/architecture-guide.md` (from system specs)
- `docs/releases/<version>/user-guide.md` (from component specs)
- `docs/releases/<version>/ops-guide.md` (from concerns)

**Skip if** `--generate-docs=false` (default).

### 4. Create Release Artifacts

Create `docs/releases/<version>/`:
```
docs/releases/0.5.0/
├── README.md                 # Release summary
├── CHANGELOG.md             # This version's changes
├── verification-report.md   # Compliance report (if verified)
├── api-reference.md         # (if --generate-docs)
├── architecture-guide.md    # (if --generate-docs)
└── migration-guide.md       # (if breaking changes)
```

### 5. Post-Release

- Update planning:
  - Mark workstreams as `done` in `docs/planning/roadmap-index.md`
- Archive specs:
  - Copy current specs to `docs/releases/<version>/specs/`
- Tag git:
  - `git tag v<version>`

## Release Checklist

Auto-generated:

- [ ] Verification passed (or skipped)
- [ ] All critical gaps resolved (if verified)
- [ ] Changelog updated
- [ ] Documentation generated (if requested)
- [ ] Migration guide (if breaking changes)
- [ ] Workstreams marked complete
- [ ] Git tag created

## Example: Minimal Release (No Docs)

```bash
bk-ship --version=0.5.1 --scope=patch --verify-first=true

[Verification]
  Running bk-verify --scope=full...
  ✅ 95% compliance, 0 critical gaps

[Changelog]
  Updated CHANGELOG.md:
  - ## [0.5.1] - 2026-02-18
  - ### Fixed
  -   Race condition in cleanup

[Artifacts]
  Created: docs/releases/0.5.1/
  ├── README.md
  ├── CHANGELOG.md
  └── verification-report.md

[Post-release]
  Updated: roadmap-index.md (1 workstream → done)
  Tagged: git tag v0.5.1

✅ Release 0.5.1 ready
```

## Example: Full Release with Docs

```bash
bk-ship --version=0.6.0 --scope=minor --generate-docs=true

[Verification]
  ✅ Passed

[Changelog]
  Updated CHANGELOG.md:
  - 3 features added
  - 2 bugs fixed
  - 1 breaking change

[Documentation]
  Generating from specs...
  ✅ API reference (12 interfaces)
  ✅ Architecture guide (8 components)
  ✅ User guide (15 features)
  ✅ Operations guide (monitoring, alerts)

[Artifacts]
  Created: docs/releases/0.6.0/
  ├── README.md
  ├── CHANGELOG.md
  ├── verification-report.md
  ├── api-reference.md
  ├── architecture-guide.md
  ├── user-guide.md
  ├── ops-guide.md
  └── migration-guide.md (breaking change detected)

[Post-release]
  Updated: roadmap-index.md (3 workstreams → done)
  Tagged: git tag v0.6.0

✅ Release 0.6.0 ready
```

## Rollback Guidance

If release is broken after deployment:

1. **Revert tag**: `git tag -d v<version>`
2. **Revert changelog**: `git revert <commit-hash>`
3. **Communicate**: Update stakeholders
4. **Fix**: Address issue, prepare patch release

## Output

1. Updated `CHANGELOG.md`
2. `docs/releases/<version>/` - Release artifacts
3. Updated `docs/planning/roadmap-index.md`
4. Git tag (optional, manual: `git tag v<version>`)

## Next Steps

- Deploy to production
- Monitor for issues
- Plan next release (`bk-design`, `bk-plan`)

## References

- [doc-templates.md](references/doc-templates.md) - Documentation generation templates (used when --generate-docs=true)
