# Verification: COMP-DEB-PACKAGING-027

- Date: 2026-03-05
- Spec: `docs/specs/component/debian-packaging-scaffold-027.md`

## Commands

```bash
npx vitest run src/debian-packaging.test.ts
```

Result: pass (2 tests).

```bash
bash scripts/create-deb-packages.sh --version 0.1.0-test --arch amd64 --output-dir <tmp> --knot-bin <tmp>/knot --knotd-bin <tmp>/knotd
bash scripts/create-deb-source.sh --version 0.1.0-test --output-dir <tmp>
ls -la <tmp>
```

Result: pass; emitted:
- `knot_0.1.0-test_amd64.deb`
- `knotd_0.1.0-test_amd64.deb`
- `knot_0.1.0-test-1.dsc`
- `knot_0.1.0-test.orig.tar.gz`
- `knot_0.1.0-test-1.debian.tar.xz`

## Requirement Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| FR-1 | pass | `scripts/create-deb-packages.sh` + test `creates knot and knotd binary .deb packages` |
| FR-2 | pass | explicit control metadata and dependency fields in script-generated control files |
| FR-3 | pass | `packaging/debian/control` with `Package: knot` and `Package: knotd` |
| FR-4 | pass | `scripts/create-deb-source.sh` uses `dpkg-source -b` and emits source artifacts |
| FR-5 | pass | scripts accept version/arch/path overrides and are exercised in tests |

## Notes

- `dpkg-deb` may warn about non-root ownership in local temp dirs; artifacts are still produced for scaffold validation.
