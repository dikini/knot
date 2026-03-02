# Verification Report: Mermaid Render Regression

## Metadata
- Date: `2026-03-02`
- Scope: `component`
- Spec: `docs/specs/component/mermaid-diagrams-001.md`
- Plan: `docs/plans/2026-03-02-mermaid-render-regression-plan.md`

## Summary
- Status: `pass`
- Focus: restore Mermaid diagram rendering in view mode after regression.
- Root cause:
  The Mermaid wrapper was being produced correctly, and the adapter could render SVG successfully, but a later React rerender of the view surface reset `dangerouslySetInnerHTML` back to the pre-hydrated wrapper.
  Because Mermaid hydration previously only reran on `[editorMode, renderedHtml]`, that reset left view mode showing raw Mermaid source until another manual hydration occurred.

## Compliance Matrix
| Requirement | Evidence | Status |
| --- | --- | --- |
| FR-3 View mode renders Mermaid fences as diagrams | Explicit Mermaid container passed in [render.ts](/home/dikini/Projects/knot/src/editor/render.ts); view-surface hydration reruns in [index.tsx](/home/dikini/Projects/knot/src/components/Editor/index.tsx); focused adapter and rerender regression tests in [render.test.ts](/home/dikini/Projects/knot/src/editor/render.test.ts) and [mermaid-rerender.test.tsx](/home/dikini/Projects/knot/src/components/Editor/mermaid-rerender.test.tsx) | ✅ Full |
| FR-4 Invalid Mermaid remains non-crashing | Existing guarded `try/catch` fallback path preserved in [render.ts](/home/dikini/Projects/knot/src/editor/render.ts) | ✅ Full |
| FR-8 Mermaid rendering remains bounded | View-mode-only invocation remains scoped in [index.tsx](/home/dikini/Projects/knot/src/components/Editor/index.tsx); rendered-state guard preserved in [render.ts](/home/dikini/Projects/knot/src/editor/render.ts), so repeated view rerenders do not redraw already rendered diagrams | ✅ Full |
| FR-9 Non-Mermaid behavior remains regression-safe | Focused markdown/editor unit suites still passing | ✅ Full |

## Verification Evidence
```bash
npm test -- --run src/components/Editor/mermaid-rerender.test.tsx src/editor/render.test.ts src/components/Editor/index.test.tsx
```

Result:
- `3` test files passed
- `55` tests passed

```bash
npm run -s typecheck
```

Result:
- passed with no reported errors

## Notes
- Browser-harness reproduction against the live Vite app confirmed the final fixed state:
  `.editor-mermaid[data-mermaid-rendered="true"]` present and SVG output attached automatically after normal view-mode rendering.
- Browser-lane Mermaid coverage in `e2e/browser/markdown-mermaid.spec.ts` remains affected by an existing note-selection harness issue in the mocked browser environment, so this verification relied on focused unit coverage plus the runtime adapter fix.
