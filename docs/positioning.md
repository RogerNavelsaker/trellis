# Trellis Positioning

Trellis is the proposed `os-eco` answer to repo-local specs, plans, and handoff documents.

## Core Thesis

Overstory should not own every workflow artifact format itself. Its job is to orchestrate agents and sessions. Structured specification and planning artifacts belong in a sibling tool that:

- stores plain files in the repo
- can be used without Overstory
- gives Overstory a stable external contract instead of an embedded workflow-specific layout

## Why Not Keep OpenSpec In Overstory

- It couples orchestration and planning too tightly.
- It makes workflow support feel framework-specific instead of ecosystem-native.
- It complicates upstreaming because the concern boundary is unclear.

## Trellis Responsibility Boundary

Trellis should own:

- spec document layout
- plan and handoff document layout
- handoff artifacts between humans and agents
- future validation and migration commands

Trellis should not own:

- issue tracking
- issue status or dependency graphs
- agent spawning
- prompt rendering
- expertise capture
- long-term project memory

## Integration Targets

- Overstory can read and write Trellis specs/plans during workflow execution.
- Sapling can consume Trellis handoff artifacts as task context.
- Seeds can link issue IDs to Trellis plan/spec files while remaining authoritative for issue state.
- Canopy can template Trellis document bodies.
- Mulch can capture durable lessons from completed Trellis work without Trellis becoming an expertise store.
