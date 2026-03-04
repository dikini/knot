# UI Review Artifacts Guide

Trace: `DESIGN-ui-qa-dx-001`

## Purpose
Define how UI verification artifacts are produced and reviewed by humans and agents.

## Artifact Sources
- Browser lane Playwright run:
  - `npm run test:e2e:browser`
- CI UI gate workflow:
  - `.github/workflows/ui-quality.yml`
- Storybook artifact workflow:
  - `.github/workflows/storybook.yml`
- Native cadence workflow:
  - `.github/workflows/native-smoke.yml`

## Artifact Types
- Playwright traces and failure context:
  - `test-results/`
- Playwright HTML report (when enabled/generated):
  - `playwright-report/`
- CI job logs for gate and native smoke runs.
- Storybook static build artifact:
  - `storybook-static/` (uploaded from CI)

## Human Review Checklist
1. Confirm all required UI quality gate jobs are green.
2. For any failed UI test, open trace + failure context first.
3. Validate expected screen state and behavior at failure point.
4. Classify issue as:
   - regression,
   - flaky infrastructure,
   - test expectation drift.
5. Record decision and follow-up in PR comments.

## Agent Review Expectations
- Use test names and file paths as primary evidence anchors.
- Prefer trace/failure artifact references over speculative reasoning.
- When proposing doc updates, link to the exact failing/passing test IDs.

## Coverage Reference
Current browser journey suite:
- `e2e/browser/app-shell.spec.ts`
- `e2e/browser/markdown-gfm.spec.ts`
- `e2e/browser/markdown-mermaid.spec.ts`
- `e2e/browser/ui-journeys.spec.ts`

## Enforcement
- PR CI enforces UI evidence/documentation synchronization:
  - script: `scripts/validate-ui-doc-sync.mjs`
  - workflow step: `.github/workflows/ui-quality.yml`
- Local checks:
```bash
npm run qa:docsync:staged
```
