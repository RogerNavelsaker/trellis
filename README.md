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
- `trellis spec create|show|list|update`
- `trellis spec start|complete`
- `trellis plan create|show|list|update`
- `trellis plan start|block|resume|complete`
- `trellis handoff append|show`
- `trellis handoff list`
- `trellis template init|show`
- `trellis template placeholders|render`
- `trellis show` / `trellis inspect`
- a documented filesystem contract that Overstory can integrate against later

Planned storage layout:

```text
.trellis/
  specs/
  plans/
  handoffs/
  templates/
  locks/
  README.md
  .gitignore
```

See [docs/contract.md](docs/contract.md) for the concrete storage contract.
See [docs/lifecycle.md](docs/lifecycle.md) for how specs and plans fit into the rest of `os-eco`.

## Example

```bash
trellis init

trellis spec create auth-refresh \
  --title "Refresh token redesign" \
  --seed seed-123 \
  --objective "Move auth to short-lived access tokens with explicit refresh flow." \
  --constraint "No new daemon" \
  --acceptance "CLI login flow remains backward compatible"

trellis plan create auth-refresh-v1 \
  --title "Ship the first auth increment" \
  --seed seed-123 \
  --spec auth-refresh \
  --summary "Land storage and CLI wiring first." \
  --step "Define on-disk token format" \
  --step "Wire refresh into CLI flow"

trellis handoff append auth-refresh-v1 \
  --from lead \
  --to builder \
  --seed seed-123 \
  --spec auth-refresh \
  --summary "Implement storage and CLI changes, then hand off for review."

trellis plan block auth-refresh-v1 \
  --reason "Waiting for schema review" \
  --from lead \
  --to reviewer

trellis template render handoff \
  --data plan_id=auth-refresh-v1 \
  --data spec_id=auth-refresh \
  --data seed_id=seed-123 \
  --data from=lead \
  --data to=builder \
  --data summary="Implement storage and CLI changes" \
  --data next_step_1="Open PR and request review"

trellis inspect auth-refresh --json
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

This repo is being incubated under `RogerNavelsaker/trellis` with the intent to transfer it to the `os-eco` owner once the direction, naming, and Overstory follow-up integration are confirmed.
