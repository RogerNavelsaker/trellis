# Trellis

Git-native specs, plans, handoffs, and workflow audit history.

[![npm](https://img.shields.io/npm/v/@os-eco/trellis-cli)](https://www.npmjs.com/package/@os-eco/trellis-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Trellis stores planning artifacts as plain YAML and JSONL files inside your repo. It is designed for the `os-eco` stack, but it works as a standalone CLI with no daemon or server.

Part of `os-eco`: Trellis sits alongside `seeds`, `mulch`, `canopy`, `sapling`, and `overstory` as the repo-local planning and workflow artifact tool.

Trellis gives you:
- durable specs for intent, constraints, acceptance, and references
- plans for execution shape and status transitions
- append-only handoffs between humans and agents
- event and audit history for blocked, stale, or orphaned work

## Install

Requires [Bun](https://bun.sh) v1.0+.

```bash
bun install -g @os-eco/trellis-cli
```

Or try without installing:

```bash
npx @os-eco/trellis-cli --help
```

### Development

```bash
git clone https://github.com/RogerNavelsaker/trellis.git
cd trellis
bun install
bun link              # Makes 'trellis' and 'tl' available globally

bun test
bun run lint
bun run typecheck
```

## Quick Start

```bash
cd your-project
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

trellis plan start auth-refresh-v1
trellis handoff append auth-refresh-v1 --from lead --to builder --summary "Implement storage and CLI changes."
trellis timeline auth-refresh-v1
```

## Commands

Every command supports `--json` where noted. ANSI colors respect `NO_COLOR`.

| Area | Commands |
| --- | --- |
| Project | `init`, `doctor`, `show`, `inspect`, `timeline` |
| Specs | `spec create`, `spec show`, `spec update`, `spec start`, `spec complete`, `spec list` |
| Plans | `plan create`, `plan show`, `plan update`, `plan start`, `plan block`, `plan resume`, `plan complete`, `plan list` |
| Handoffs | `handoff append`, `handoff show`, `handoff latest`, `handoff list` |
| Audit | `audit blocked`, `audit stale`, `audit orphaned`, `event list` |
| Templates | `template init`, `template show`, `template placeholders`, `template render` |
| Shell | `completions bash|zsh|fish` |

## Storage

Trellis keeps its state inside `.trellis/`:

```text
.trellis/
  specs/
    <spec-id>.yaml
  plans/
    <plan-id>.yaml
  handoffs/
    <plan-id>.jsonl
  events.jsonl
  templates/
  locks/
  README.md
  .gitignore
```

See [docs/contract.md](docs/contract.md) for the storage contract and [docs/json-contract.md](docs/json-contract.md) for stable `--json` output.

## Part of os-eco

Trellis is part of the `os-eco` toolchain, but it does not replace the other tools:

- `seeds` owns issue state, readiness, and dependencies
- `mulch` owns expertise and durable lessons
- `canopy` owns prompts and prompt composition
- `sapling` owns headless coding-runtime execution
- `overstory` owns orchestration, worktrees, and coordination
- `trellis` owns repo-local specs, plans, handoffs, and workflow audit history

That means Trellis can link to a Seeds issue with `seed: seed-123`, but it never becomes the issue tracker. It can store rendered templates, but it does not become the prompt system.

See [docs/lifecycle.md](docs/lifecycle.md) for the full lifecycle model.

## Design Principles

Trellis follows the same core principles as the rest of `os-eco`:

- Git-native storage: YAML and JSONL files that merge cleanly and need no external database
- Zero runtime dependencies: a single Bun CLI with no daemon or server
- Multi-agent safe: advisory file locking for concurrent writes
- CLI-first: every operation is a shell command with `--json`
- Consistent UX: shell completions, help screens, and flag conventions aligned with the stack

## Integration

Trellis works standalone, but it is designed to compose cleanly with the rest of the ecosystem.

Current downstream usage is:
- humans can create and update specs and plans directly with `trellis`
- Overstory can bootstrap co-creation specs into `.trellis/specs/`
- Trellis remains the ongoing edit path for richer planning state

The important boundary is:
- Overstory bootstraps and orchestrates
- Trellis owns the planning artifacts and audit trail

See [docs/positioning.md](docs/positioning.md) for the responsibility boundary and integration targets.

## Release Notes

Before cutting a release:

```bash
bun test
bun x tsc --noEmit
bunx @biomejs/biome check .
```

Release expectations:
- keep `--json` payloads backward-compatible per [docs/json-contract.md](docs/json-contract.md)
- keep `.trellis/` storage backward-compatible per [docs/contract.md](docs/contract.md)
- prefer additive changes over renames or removals
- keep help, version, and completion behavior aligned with the `os-eco` CLI style

## Part of os-eco

Trellis is intended to live alongside the rest of the `os-eco` toolchain:

- `seeds` for issue state
- `mulch` for expertise
- `canopy` for prompts
- `sapling` for coding-runtime execution
- `overstory` for orchestration
- `trellis` for repo-local specs, plans, handoffs, and workflow audit history

## Transfer Intent

Trellis is being incubated under `RogerNavelsaker/trellis` with the intent to transfer it into the `os-eco` umbrella once the direction and ownership path are confirmed.
