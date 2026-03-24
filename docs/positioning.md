# Trellis Positioning

Trellis is the `os-eco` tool for repo-local specs, plans, handoffs, and workflow audit history.

## What Trellis Owns

Trellis owns the planning artifacts that should live in the repo as plain files:

- specs
- plans
- handoffs
- workflow event history
- validation and audit commands around those artifacts

Trellis does not own:

- issue tracking
- issue status or dependency graphs
- agent spawning
- prompt composition
- expertise capture
- long-term memory

## Why This Is Separate From Overstory

Overstory is the orchestrator. Trellis is the planning-artifact tool.

Keeping those concerns separate matters because:

- Overstory can stay focused on sessions, worktrees, coordination, and runtime integration
- Trellis can stay focused on stable repo-local workflow documents
- other `os-eco` tools can point at Trellis artifacts without inheriting Overstory-specific layout choices

## Integration Targets

- Overstory can read and write Trellis specs/plans during workflow execution.
- Sapling can consume Trellis handoff artifacts as task context.
- Seeds can link issue IDs to Trellis plan/spec files while remaining authoritative for issue state.
- Canopy can template Trellis document bodies.
- Mulch can capture durable lessons from completed Trellis work without Trellis becoming an expertise store.

## Immediate Goal

The immediate goal is not to reproduce OpenSpec one-to-one. It is to give Overstory and the rest of `os-eco` a native workflow document target so structured work can point at Trellis without pushing planning state back into the orchestrator.
