# User-Local Installer and Self-Extracting Package

## Metadata
- ID: `COMP-LOCAL-INSTALLER-026`
- Scope: `component`
- Status: `draft`
- Concerns: `[REL, CONF, COMP]`
- Created: `2026-03-05`
- Updated: `2026-03-05`

## Purpose
Provide a clean user-local installation flow that avoids AppImage/FUSE behavior while keeping uninstall deterministic and safe.

## Contract

### Functional Requirements
- FR-1: Build tooling MUST produce a versioned tarball payload containing `knot`, `knotd`, and installer assets for user-local deployment.
- FR-2: Build tooling MUST produce a self-extracting shell installer that embeds the tarball payload and supports at least `install` and `uninstall` commands.
- FR-3: Installer MUST install into `~/.local/opt/knot/<version>` and create stable command symlinks under `~/.local/bin`.
- FR-4: Installer MUST write a per-version manifest in `~/.local/share/knot/` that records all installed files and symlinks it created.
- FR-5: Uninstaller MUST remove only paths listed in the manifest and MUST NOT use broad/glob destructive deletion.
- FR-6: Uninstaller MUST be idempotent and return success when target version (or default current version) is already absent.
- FR-7: Installer and uninstaller MUST support prefix overrides for testing (`KNOT_INSTALL_ROOT`, `KNOT_BIN_DIR`, `KNOT_SHARE_DIR`) while defaulting to user-local paths.

### Behavior
- Given a built release and package command
- When operator runs self-extracting installer with `install`
- Then binaries are installed in a versioned user-local directory, symlinks are refreshed, and manifest is written.

- Given an installed version with manifest
- When operator runs self-extracting installer with `uninstall`
- Then only manifest-recorded paths are deleted and empty parent directories are cleaned conservatively.

## Design Decisions
| Decision | Rationale | Trade-off |
|----------|-----------|-----------|
| Versioned install root (`~/.local/opt/knot/<version>`) | Enables safe upgrades/rollbacks and uninstalls | More directories to manage |
| Manifest-based uninstall | Deterministic and safe removal boundaries | Requires accurate manifest bookkeeping |
| Self-extracting shell artifact | Single download + command UX | Script generation complexity |
| Overrideable roots for tests | Enables hermetic automated testing | Slightly more argument/env surface |

## Concern Mapping
| Concern | Requirement | Implementation Strategy |
|---------|-------------|------------------------|
| REL | FR-4, FR-5, FR-6 | Strict manifest writes, idempotent uninstall, predictable path operations |
| CONF | FR-2, FR-3 | Simple `install|uninstall` interface and stable user-local symlinks |
| COMP | FR-1, FR-7 | POSIX shell + tar tooling, environment overrides for multiple Linux setups |

## Acceptance Criteria
- AC-1: Running package script produces `dist/knot-local-<version>-linux-<arch>.tar.gz`.
- AC-2: Running self-extracting package script produces `dist/knot-installer-<version>-linux-<arch>.sh`.
- AC-3: Running installer `install` creates binaries and symlinks in overridden test roots and writes manifest.
- AC-4: Running installer `uninstall` removes manifest-recorded files/symlinks and succeeds on repeat runs.
- AC-5: Uninstall path handling uses exact-path deletions from manifest (no wildcard/glob removal).

## Verification Strategy
- Script-focused automated tests for install/uninstall behavior under temp directories.
- Packaging tests for tarball and self-extracting script generation.
- Targeted manual smoke command in a user-local path.

## Related
- Depends on: `COMP-LINUX-PACKAGING-018`
- Enables: local non-AppImage distribution workflow
