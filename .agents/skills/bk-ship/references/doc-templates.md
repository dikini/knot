# Documentation Generation Templates

Templates for generating release documentation from specs (used when `--generate-docs=true`).

## API Reference Template

From interface specs (`IF-*`):

```markdown
# API Reference: <Interface Name>

**Spec**: [<spec-id>](<spec-path>)
**Status**: <status>
**Since**: <version>

## Overview
<purpose from spec>

## Interface Definition
```rust
<code from spec>
```

## Methods

### `<method_name>`
<description>

**Parameters**:
- `param`: <type> - <description>

**Returns**: <type> - <description>

**Errors**: <error conditions>

**Spec Reference**: SPEC-FR-N

## Examples
```rust
<from acceptance criteria>
```

## Concerns
| Concern | Implementation |
|---------|----------------|
| REL-001 | <how handled> |
```

## Architecture Guide Template

From system specs + design decisions:

```markdown
# Architecture Overview

Generated from specs on <date>

## System Components

### <Component Name>
- **Purpose**: <from spec>
- **Interfaces**: <links to IF-*>
- **Depends on**: <upstream>
- **Used by**: <downstream>

<component diagram from design decisions>

### Design Decisions
| Decision | Rationale | Trade-off |
|----------|-----------|-----------|
<from spec>

## Cross-Cutting Concerns
<from concern-registry.yaml>

## Data Flow
<diagram from specs>
```

## User Guide Template

From feature specs + acceptance criteria:

```markdown
# User Guide: <Feature>

## Quick Start

```rust
use <crate>::<module>;

let <feature> = <Feature>::new();
<feature>.method();
```

**From**: <spec-id> acceptance criteria

## Configuration

<from CONF concerns in spec>

## Examples

### Example 1: <Use Case>
<from acceptance criteria>

### Example 2: <Use Case>
<from acceptance criteria>
```

## Operations Guide Template

From concern registry + deployment specs:

```markdown
# Operations Guide: <Component>

## Monitoring

### Metrics
- `<metric_name>`: <description> (from OBS-001)
- `<metric_name>`: <description> (from OBS-002)

### Alerts
- **Alert**: <metric> < <threshold>
- **Severity**: Critical | Warning | Info
- **Action**: <remediation>

## Health Checks

From REL concerns:
```rust
async fn health_check() -> HealthStatus {
    // Check: <from spec>
}
```

## Troubleshooting

Common issues from spec concerns:

| Issue | Cause | Resolution |
|-------|-------|------------|
| <symptom> | <from concern> | <fix> |
```
