# trellis

Git-native specs, plans, and handoff artifacts for the `os-eco` toolchain.

Trellis is a candidate replacement for the OpenSpec-shaped workflow artifacts introduced in `overstory` PR `#130`. The intent is to move specification and plan artifacts into their own first-class tool so Overstory can stay focused on orchestration while Trellis owns repo-local workflow documents.

## Why this exists

OpenSpec is useful as a workflow vocabulary, but it does not fit the `os-eco` model cleanly:

- it is not aligned with the current `os-eco` naming and packaging surface
- it pushes specification concerns into Overstory instead of keeping them as a separate repo-local tool
- it makes workflow output shape feel bolted on instead of native to the ecosystem

Trellis is the proposed replacement direction:

- Git-native storage inside the repo
- zero runtime dependencies beyond Bun
- CLI-first with `--json`
- multi-agent safe filesystem mutations
- designed to compose with Overstory, Sapling, Seeds, Mulch, and Canopy

## Relationship To The Existing Tools

- `overstory`: orchestration, worktrees, sessions, coordination
- `sapling`: headless coding runtime
- `seeds`: issue tracking and dependency state
- `mulch`: expertise and conventions
- `canopy`: prompts and prompt composition
- `trellis`: specs, plans, handoff artifacts, and workflow structure

Trellis complements existing tools:

- it does not replace Seeds as the source of truth for issue state
- it does not replace Mulch as the source of truth for expertise
- it does not replace Canopy as the source of truth for prompts
- it gives those tools a shared, repo-native place to point at richer workflow documents

## Initial Scope

The first version focuses on:

- `trellis init` to scaffold a repo-local `.trellis/` tree
- `trellis doctor` to validate that tree
- a documented filesystem contract for future `spec`, `plan`, and `handoff` commands

Planned storage layout:

```text
.trellis/
  specs/
  plans/
  handoffs/
  templates/
  README.md
  .gitignore
```

## Tooling

This repo uses Bun, TypeScript, Commander, and Biome.

## Development

```bash
bun install
bun test
bun x tsc --noEmit
bunx @biomejs/biome check .
```

## Transfer Intent

This repo is being incubated under `RogerNavelsaker/trellis` with the intent to transfer it to the `os-eco` owner once the direction and naming are confirmed.
