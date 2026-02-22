# Storybook DX Runbook

Trace: `DESIGN-storybook-dx-001`
Spec: `docs/specs/component/storybook-dx-001.md`

## Purpose
Operational runbook for Storybook setup, local usage, and CI artifact generation.

## Install (Agent-Automatable)
Dependencies are committed in `package.json`. Bootstrap command:
```bash
npm install
```

## Local Development
Run Storybook:
```bash
npm run storybook
```
Default URL:
- `http://127.0.0.1:6006`

Smoke-test Storybook startup:
```bash
npm run storybook:smoke
```

Build static Storybook:
```bash
npm run storybook:build
```
Output:
- `storybook-static/`

## CI
Workflow:
- `.github/workflows/storybook.yml`

Job responsibilities:
1. install dependencies
2. run `storybook:build`
3. upload `storybook-static` artifact

## Baseline Coverage (Current)
- `src/components/IconButton/IconButton.stories.tsx`
- `src/components/Shell/ToolRail.stories.tsx`
- `src/components/Shell/ContextPanel.stories.tsx`
- `src/components/VaultSwitcher/VaultSwitcher.stories.tsx`

