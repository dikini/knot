# Tool Rail + Context Policy Verification (2026-02-21)

- Spec: `docs/specs/component/tool-rail-context-policy-001.md`
- Plan: `docs/plans/tool-rail-context-001-plan.md`
- Scope: hybrid tool activation policy, context panel fold behavior, and rail styling constraints

## Compliance Summary

| Requirement | Evidence | Verification | Status |
| --- | --- | --- | --- |
| FR-1 Narrower tool rail width | `src/components/Shell/ToolRail.css` | CSS inspection + shell render tests | ✅ Full |
| FR-2 Two panel states (`folded` invisible, `unfolded` visible) | `src/components/Shell/ContextPanel.tsx` | `src/components/Shell/ContextPanel.test.tsx` | ✅ Full |
| FR-3 No in-panel fold/unfold button | `src/components/Shell/ContextPanel.tsx` | `src/components/Shell/ContextPanel.test.tsx` | ✅ Full |
| FR-4 Active tool click toggles panel | `src/App.tsx` (`handleToolModeSelect`) | `src/App.test.tsx` | ✅ Full |
| FR-5 Inactive tool click switches mode/content | `src/App.tsx` + `src/components/Shell/ToolRail.tsx` | `src/App.test.tsx` | ✅ Full |
| FR-6 Policy classes (`required`, `optional`, `independent`) | `src/App.tsx` (`TOOL_PANEL_POLICY`) | `src/App.test.tsx` policy transition cases | ✅ Full |
| FR-7 Current mapping notes/search required, graph optional | `src/App.tsx` policy map | `src/App.test.tsx` required/optional behavior cases | ✅ Full |
| FR-8 Rail border spans viewport height | `src/components/Shell/ToolRail.css`, `src/components/Shell/ContextPanel.css` | CSS inspection + visual shell behavior | ✅ Full |

## Commands Executed

```bash
npm test -- --run src/components/Shell/ContextPanel.test.tsx src/App.test.tsx
npm test -- --run src/components/Shell/ToolRail.test.tsx src/components/Shell/ContextPanel.test.tsx src/App.test.tsx
npm run -s typecheck
npx eslint src/App.tsx src/App.test.tsx src/components/Shell/ToolRail.tsx src/components/Shell/ContextPanel.tsx src/lib/store.ts
```

## Results

- Targeted tests: pass
- Typecheck: pass
- ESLint (TypeScript files): pass
- Residual note: existing React `act(...)` warnings remain in `src/App.test.tsx` from pre-existing async effects; no test failures.

## Gaps / Follow-ups

- No blocking gaps for the scoped requirements.
- Follow-up status:
  - `App`, `SearchBox`, and `GraphView` warning paths were cleaned up in subsequent reliability pass.
  - One known non-blocking Sidebar warning remains intentionally deferred.
  - See decision record: `docs/audit/sidebar-act-warning-decision-2026-02-21.md`.
