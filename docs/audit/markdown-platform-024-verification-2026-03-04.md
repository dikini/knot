# Markdown Platform 024 Verification (2026-03-04)

- Spec: `docs/specs/component/markdown-platform-024.md`
- Plan: `docs/plans/markdown-platform-024-plan.md`
- Scope: GFM-first frontend markdown-note pipeline, shared source/edit/view document model, native GFM tables and footnotes, extension registration seam, public parse/serialize cutover with fallback, and explicit raw-HTML policy.

## Compliance Summary

| Requirement | Evidence | Verification | Status |
| --- | --- | --- | --- |
| FR-1 GFM-first core markdown-note pipeline | `src/editor/markdown.ts`, `src/editor/markdown-gfm.ts`, `src/editor/markdown-bridge.ts` | `src/editor/markdown.test.ts`, `src/editor/markdown-engine.migration.test.ts`, `src/editor/markdown-syntax.test.ts` | ✅ Full |
| FR-2 Native GFM used for native constructs | `src/editor/markdown-gfm.ts`, `src/editor/markdown-prosemirror-gfm.ts` | table, footnote, task-list, autolink fixtures in `src/editor/markdown.test.ts` and `src/editor/markdown-engine.migration.test.ts` | ✅ Full |
| FR-3 Initial native baseline includes tables, task lists, strikethrough, autolinks, footnotes | `src/editor/schema.ts`, `src/editor/markdown-gfm.ts`, `src/editor/render.ts` | `src/editor/markdown.test.ts`, `src/editor/render.test.ts`, `src/editor/markdown-engine.migration.test.ts` | ✅ Full |
| FR-4 Custom syntax remains explicit extensions only | `src/editor/markdown-extensions.ts` | `src/editor/markdown-syntax.test.ts` extension-registry coverage | ✅ Full |
| FR-5 Initial extension set includes wikilinks, embeds, inline math, display math | `src/editor/markdown-extensions.ts`, `src/editor/schema.ts` | `src/editor/markdown.test.ts`, `src/editor/markdown-syntax.test.ts`, `src/editor/render.test.ts` | ✅ Full |
| FR-6 Frontend schema is the support contract | `src/editor/schema.ts`, `src/editor/plugins/index.ts`, `src/editor/commands.ts` | combined parser/render/editor tests below | ✅ Full |
| FR-7 View mode renders from the shared frontend document model | `src/editor/render.ts` | `src/editor/render.test.ts` | ✅ Full |
| FR-8 Source mode preserves canonical markdown for supported GFM and extensions | `src/editor/markdown.ts`, `src/editor/markdown-prosemirror-gfm.ts` | `src/editor/markdown.test.ts`, `src/editor/markdown-syntax.test.ts` | ✅ Full |
| FR-9 Explicit extension registration model exists | `src/editor/markdown-extensions.ts` | `src/editor/markdown-syntax.test.ts` | ✅ Full |
| FR-10 Extension registration carries implementation metadata | `src/editor/markdown-extensions.ts` | `src/editor/markdown-syntax.test.ts` (`defines a default extension registry`) | ✅ Full |
| FR-11 Markdown-note scope is kept separate from note-type behavior | markdown changes are isolated to `src/editor/*` and markdown docs | repo review of touched files | ✅ Full |
| FR-12 Non-markdown note types remain out of scope | no note-type feature coupling added in this slice | repo review of touched files | ✅ Full |
| FR-13 Backend work remains conditional and not assumed | no backend markdown feature parity claimed in this slice | repo review + absence of backend changes | ✅ Full |
| FR-14 Maintained upstream libraries used for GFM/tables/math fit | `remark-parse`, `remark-gfm`, `remark-stringify`, `prosemirror-tables`, existing math integration in `package.json`, `src/editor/markdown-gfm.ts`, `src/editor/schema.ts` | typecheck + focused test suite | ✅ Full |
| FR-15 Process docs for markdown extension development exist | `docs/process/markdown-extension-policy.md`, `docs/process/markdown-extension-authoring.md` | manual review + traceability below | ✅ Full |
| FR-16 Existing markdown-note behavior remains regression-safe during migration | `src/editor/markdown-engine.migration.test.ts`, `src/editor/markdown.test.ts`, `src/editor/render.test.ts` | commands below | ✅ Full |
| FR-17 Raw HTML unsupported on GFM path and preserved as literal text on public/frontend path | `src/editor/markdown-bridge.ts`, `src/editor/markdown.ts`, `src/editor/render.ts` | raw-HTML tests in `src/editor/markdown.test.ts` and `src/editor/render.test.ts` | ✅ Full |

## Commands Executed

```bash
npm run test -- --run src/editor/markdown.test.ts src/editor/markdown-engine.migration.test.ts src/editor/markdown-syntax.test.ts src/editor/render.test.ts src/editor/commands.test.ts src/editor/commands.table.test.ts
npm run typecheck
```

## Results

- Focused markdown/frontend tests: pass (`109/109`)
- Typecheck: pass
- Blocking issues in verified scope: none

## Verified Behaviors

- Public markdown parse/serialize is GFM-first with fallback when the GFM seam reports diagnostics.
- View mode renders from the same frontend document model used by the current edit/source flow.
- Native GFM support is covered for tables, footnotes, task lists, strikethrough, autolinks, and standard markdown constructs.
- Knot extensions are covered for wikilinks, embed wikilinks, inline math, and display math.
- Mixed fixtures are covered for:
  - nested formatting inside table cells
  - nested formatting inside footnote definitions
  - multiline footnotes with nested lists
  - mixed inline marks inside a single table cell
- Mermaid remains supported as fenced code plus view rendering, not as a dedicated schema node.
- Raw HTML is not treated as supported markdown-note content and is preserved as literal text on the public/frontend path.

## Gaps / Follow-ups

- The ProseMirror-to-GFM serializer bridge is custom infrastructure. It is covered for the verified surface but should be treated as a maintained seam, not a solved ecosystem problem.
- Backend parity is intentionally not claimed here.
- Output canonicalization currently prefers compact pipe tables. If product expectations change, serializer formatting policy should be revisited explicitly.
