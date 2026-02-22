# Design Token Inventory (Facts on the Ground)

Trace: `DESIGN-ui-qa-dx-001`
Spec: `docs/specs/component/ui-quality-assurance-dx-001.md`

## Source of Truth
- Global tokens: `src/styles/global.css`
- Editor-scoped token remap: `src/components/Editor/Editor.css`

## Color Tokens (Global)
Defined in `src/styles/global.css`:
- `--color-bg: #121518`
- `--color-bg-secondary: #1b1f24`
- `--color-bg-tertiary: #272d34`
- `--color-text: #ddd7cf`
- `--color-text-muted: #aca395`
- `--color-text-subtle: #8a8074`
- `--color-accent: #7398c8`
- `--color-accent-hover: #6387b7`
- `--color-border: #3a352f`
- `--color-on-accent: #f5f8ff`
- `--color-heading: #eee8df`
- `--color-link: #9cbfe9`
- `--color-code-bg: #2d2823`
- `--color-code-text: #ddd7cf`
- `--color-blockquote: #b1a89d`

## Typography Tokens
Defined in `src/styles/global.css`:
- `--font-sans: "Manrope", "Avenir Next", "Segoe UI", sans-serif`
- `--font-serif: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, serif`
- `--font-mono: "JetBrains Mono", "Fira Code", Consolas, monospace`
- `--font-size-base: 16px`
- `--line-height: 1.6`

## Spacing Tokens
Defined in `src/styles/global.css`:
- `--spacing-xs: 0.25rem`
- `--spacing-sm: 0.5rem`
- `--spacing-md: 1rem`
- `--spacing-lg: 1.5rem`
- `--spacing-xl: 2rem`

## Layout Tokens
Defined in `src/styles/global.css`:
- `--sidebar-width: 280px`
- `--header-height: 48px`

## Component-Scoped Token Overrides
`src/components/Editor/Editor.css` maps editor-specific variables onto shared semantic names:
- editor palette maps into `--color-text`, `--color-heading`, `--color-link`, `--color-code-bg`, `--color-border`, `--color-accent`, `--color-on-accent`, etc.

Implication:
- Editor theme can vary while retaining semantic token contract used by shared styles.

## Token Governance Notes
1. Introduce new tokens in `src/styles/global.css` first.
2. Use semantic names in component CSS (`--color-*`, `--spacing-*`) instead of hardcoded values.
3. Reserve hardcoded color literals for exceptional one-off visual details only.
4. Any token contract change should update Storybook stories and UI docs in same PR.

