# Changelog

## [0.1.0] - 2026-03-03

_Draft for the first tagged release; this repository does not yet publish release URLs, so references point to internal design and verification records._

### Changed

- Tighten repository workflow enforcement and canonical registry alignment so specs, plans, audits, hooks, and roadmap state stay in sync ([workflow freshness], [documentation registry], [pre-release cleanup]).
- Raise the local release bar so TypeScript, Storybook, browser E2E, native smoke, and repo-managed daemon smoke all participate in the default pre-release verification path ([pre-release cleanup], [knotd dev lifecycle]).
- Refine the daemon-oriented runtime workflow around `knotd`, including bridge operations, MCP handoff behavior, and local packaging/release support documentation ([knotd ops], [linux packaging]).

### Added

- Add repo-managed `knotd` daemon smoke orchestration for `ci:local`, including aligned socket defaults, automatic bootstrap/teardown, and explicit non-release skip messaging ([knotd dev lifecycle]).
- Add a maintained component-level specification trail for recent cleanup and workflow hardening workstreams, so the current release state is traceable through specs, plans, and audits ([pre-release cleanup], [workflow freshness]).

### Fixed

- Fix Storybook and App verification instability so the frontend suite now runs cleanly without the prior mix of runtime leakage, stale matrix parsing, and noisy warning canaries ([storybook stability], [pre-release cleanup]).
- Fix local CI’s previous daemon-triage gap where `ci:local` could silently skip `knotd` checks because it looked at a different socket path than the repo-managed lifecycle scripts ([knotd dev lifecycle]).
- Fix MCP bridge and packaging rough edges that blocked reliable local runtime use and Linux packaging follow-through ([knotd ops], [linux packaging]).

[0.1.0]: docs/audit/pre-release-cleanup-023-verification-2026-03-03.md
[documentation registry]: docs/audit/documentation-registry-alignment-020-verification-2026-03-03.md
[workflow freshness]: docs/specs/component/workflow-freshness-hardening-021.md
[storybook stability]: docs/specs/component/storybook-app-stability-022.md
[pre-release cleanup]: docs/audit/pre-release-cleanup-023-verification-2026-03-03.md
[knotd dev lifecycle]: docs/audit/knotd-dev-lifecycle-011-verification-2026-03-03.md
[knotd ops]: docs/specs/component/knotd-mcp-ops-008.md
[linux packaging]: docs/specs/component/linux-appimage-packaging-018.md
