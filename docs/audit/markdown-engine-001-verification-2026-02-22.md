# Markdown Engine 001 Verification (2026-02-22)

- Spec: `docs/specs/component/markdown-engine-001.md`
- Plan: `docs/plans/markdown-engine-001-plan.md`
- Scope: markdown engine routing, next-engine parser/serializer integration, reference links, wikilink parity, and runtime engine switching

## Compliance Summary

| Requirement | Evidence | Verification | Status |
| --- | --- | --- | --- |
| FR-1 Engine migration boundary and routing | `src/editor/markdown.ts`, `src/editor/markdown-next.ts` | `src/editor/markdown-engine.migration.test.ts` | ✅ Full |
| FR-2 Existing syntax compatibility | `src/editor/markdown.ts`, `src/editor/markdown-next.ts` | `src/editor/markdown.test.ts` | ✅ Full |
| FR-3 Wikilink support preserved | `src/editor/markdown.ts`, `src/editor/markdown-next.ts` | `src/editor/markdown-engine.migration.test.ts` (`supports wikilinks through next-engine route`) | ✅ Full |
| FR-4 Reference links supported (full/collapsed/shortcut) | `src/editor/markdown.ts` reference parsing + mark attrs | `src/editor/markdown-engine.migration.test.ts` reference-link tests | ✅ Full |
| FR-5 Reference definitions preserved through round-trip | `src/editor/markdown.ts` definition extraction + serialization | `src/editor/markdown-engine.migration.test.ts` (`preserves reference link definitions`) | ✅ Full |
| FR-6 View-mode rendering resolves links through migrated pipeline | `src/editor/render.ts` (`parseMarkdownAuto`) | `src/components/Editor/index.test.tsx`, `src/editor/markdown-engine.migration.test.ts` | ✅ Full |
| FR-7 Feature-gated fallback available | `src/editor/markdown.ts` (`setMarkdownEngineConfig`, `parseMarkdownAuto`, `serializeMarkdownAuto`) + `src/App.tsx` runtime toggle | `src/App.test.tsx` (`defaults markdown engine to next and toggles to legacy`) | ✅ Full |
| FR-8 Expanded migration/compat verification suite | `src/editor/markdown-engine.migration.test.ts`, `src/App.test.tsx` | command results below | ✅ Full |

## Commands Executed

```bash
npm test -- --run src/App.test.tsx src/components/Editor/index.test.tsx src/editor/markdown-engine.migration.test.ts src/editor/markdown.test.ts
npm run -s typecheck
```

## Results

- Targeted tests: pass (`94/94`)
- Typecheck: pass
- Blocking issues: none

## Gaps / Follow-ups

- Runtime default remains `legacy` at module level for standalone safety; app boot explicitly switches to `next` for dogfooding.
- No blocking gaps for current scope.
