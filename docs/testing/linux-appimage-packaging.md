# Linux AppImage Packaging (Deprecated)

As of 2026-03-05, AppImage packaging is intentionally disabled in this repository.

Use local packaging flows instead:

```bash
npm run release:local -- --version 0.1.0
```

This command emits:
- user-local tarball payload
- self-extracting installer shell archive
- `knot` + `knotd` binary `.deb`
- Debian source package artifacts (`.dsc`, `.orig.tar.gz`, `.debian.tar.xz`)

If you need launcher commands after install, use:

```bash
knot --help
knot mcp status
knot service status
```
