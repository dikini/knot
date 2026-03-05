# Debian Packaging Scaffold for knot and knotd

## Metadata
- ID: `COMP-DEB-PACKAGING-027`
- Scope: `component`
- Status: `draft`
- Concerns: `[REL, COMP, CONF]`
- Created: `2026-03-05`
- Updated: `2026-03-05`

## Purpose
Provide reproducible scripts and minimal Debian packaging scaffolding to generate binary `.deb` packages for `knot` and `knotd`, plus a Debian source package (`.dsc`, `.orig.tar.*`, `.debian.tar.*`).

## Contract

### Functional Requirements
- FR-1: Repository MUST provide a script to generate `knot_<version>_<arch>.deb` and `knotd_<version>_<arch>.deb` from supplied binaries.
- FR-2: Binary package script MUST create deterministic package layout with metadata files and explicit runtime dependency fields.
- FR-3: Repository MUST provide Debian source package scaffolding (`debian/` templates) suitable for `dpkg-source -b`.
- FR-4: Repository MUST provide a script that assembles source tree, injects changelog metadata, and emits Debian source artifacts.
- FR-5: Scripts MUST support override inputs for version, arch, and binary paths for CI and local testing.

## Acceptance Criteria
- AC-1: Binary package script emits two `.deb` files in output directory for provided test binaries.
- AC-2: Source package script emits `.dsc`, `.orig.tar.gz`, and `.debian.tar.xz` (or `.debian.tar.gz`) artifacts.
- AC-3: Generated scaffolding contains package stanzas for both `knot` and `knotd`.

## Verification Strategy
- Automated script tests with temporary fake binaries.
- `dpkg-deb --info` checks for resulting binary packages.
- `dpkg-source -b` smoke check for source artifacts.
