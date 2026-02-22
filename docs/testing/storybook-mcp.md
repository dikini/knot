# Storybook MCP Configuration

Trace: `DESIGN-storybook-dx-001`
Spec: `docs/specs/component/storybook-dx-001.md`

## Purpose
Define the project-local configuration pattern for Storybook MCP integration.

## Configuration Path
- Template: `.mcp/storybook-mcp.example.json`
- Local (ignored/user-managed): `.mcp/storybook-mcp.json`

## Quick Start
1. Copy template:
```bash
mkdir -p .mcp
cp .mcp/storybook-mcp.example.json .mcp/storybook-mcp.json
```
2. Ensure Storybook is running:
```bash
npm run storybook
```
3. Run config smoke check:
```bash
npm run storybook:mcp:smoke
```

## Ownership
- Tooling owner updates template and smoke script.
- Agent workflows consume local `.mcp/storybook-mcp.json`.
- Any connector-specific secrets or environment details remain local.

## Agent Use Cases
- Discover story inventory for changed components.
- Correlate UI changes with Storybook docs coverage.
- Link review evidence to specific stories.

