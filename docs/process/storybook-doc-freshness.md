# Storybook Documentation Freshness Policy

Trace: `DESIGN-storybook-dx-001`
Spec: `docs/specs/component/storybook-dx-001.md`

## Purpose
Keep Storybook documentation synchronized with UI code and specifications.

## Policy
If a PR changes UI primitives or behavior contracts, it must also include one of:
1. new/updated stories in `src/**/*.stories.tsx`, and/or
2. explicit documentation updates in:
   - `docs/testing/storybook-dx.md`
   - `docs/testing/ui-review-artifacts.md`
   - relevant spec/status docs.

## Skill/Workflow Augmentations
- `bk-design`: include a **Storybook Impact** section for UI-facing specs.
- `bk-plan`: include Storybook story/doc tasks for UI behavior changes.
- `bk-verify`: include Storybook coverage freshness checks when UI code changes.

## Optional New Skill
- `bk-storybook-docs` (future): update stories/docs based on changed UI components and specs.

## Reviewer Checklist
1. Do changed UI components have story coverage?
2. Are behavior-critical states represented in stories?
3. Are Storybook docs/runbooks updated when process changes?

