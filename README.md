# Trellis

Git-native specs, plans, handoffs, and workflow audit history.

[![npm](https://img.shields.io/npm/v/@os-eco/trellis-cli)](https://www.npmjs.com/package/@os-eco/trellis-cli)
[![CI](https://github.com/RogerNavelsaker/trellis/actions/workflows/ci.yml/badge.svg)](https://github.com/RogerNavelsaker/trellis/actions/workflows/ci.yml)
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

## Architecture

Trellis is a small Bun CLI with a file-backed workflow model:

- `specs.ts` and `plans.ts` own YAML-backed workflow artifacts
- `handoffs.ts` owns append-only JSONL handoff logs
- `events.ts` owns the shared event log for transitions and handoffs
- `transitions.ts` enforces lifecycle rules
- `lock.ts` provides advisory write locking for concurrent updates
- `validate.ts` and `yaml.ts` keep storage reads and writes consistent

## How It Works

Trellis keeps workflow state in the repo as plain files. Humans and agents create specs and plans, advance their lifecycle, append handoffs, and inspect the resulting audit trail through the CLI.

```text
1. trellis init           -> creates .trellis/ in your repo
2. trellis spec create    -> writes durable intent, constraints, and references
3. trellis plan create    -> captures an execution path for the spec
4. trellis handoff append -> records ownership/context transfer
5. trellis timeline       -> reads back lifecycle and audit history
```

## Project Structure

```text
trellis/
  src/
    index.ts            CLI entry point
    specs.ts            Spec create/read/update/list
    plans.ts            Plan create/read/update/list
    handoffs.ts         Append-only handoff logs
    events.ts           Event log helpers
    transitions.ts      Lifecycle transition rules
    lock.ts             Advisory file locking
    validate.ts         Input and stored-data validation
    render.ts           Template rendering
    templates.ts        Template placeholder contracts
    doctor.ts           Repo health checks
    audit.ts            Blocked/stale/orphaned audits
    yaml.ts             YAML parsing and serialization
    json.ts             Standard JSON output envelope
  docs/
    contract.md         Storage contract
    json-contract.md    Stable JSON response contract
    lifecycle.md        Ecosystem lifecycle model
    positioning.md      Responsibility boundary
```

## What's in `.trellis`

Trellis keeps its state inside `.trellis/`:

```text
.trellis/
├── specs/
│   └── <spec-id>.yaml     # one YAML file per spec
├── plans/
│   └── <plan-id>.yaml     # one YAML file per plan
├── handoffs/
│   └── <plan-id>.jsonl    # append-only JSONL log per plan
├── events.jsonl           # shared transition + handoff event log
├── templates/             # repo-local document templates
├── locks/                 # advisory lock files
├── README.md              # local usage note
└── .gitignore             # keep runtime files out of version control
```

See [docs/contract.md](docs/contract.md) for the storage contract and [docs/json-contract.md](docs/json-contract.md) for stable `--json` output.

## How It Fits

Trellis is part of the `os-eco` toolchain, but it does not replace the other tools:

```text
overstory (orchestrates structured work)
  ├── trellis  (stores specs, plans, handoffs, audit history)
  ├── sapling  (consumes Trellis context during coding execution)
  ├── mulch    (records expertise and durable lessons)
  ├── seeds    (tracks issue state and readiness)
  └── canopy   (renders prompts and templates)
```

That means Trellis can link to a Seeds issue with `seed: seed-123`, but it never becomes the issue tracker. It can store rendered templates, but it does not become the prompt system.

See [docs/lifecycle.md](docs/lifecycle.md) for the full lifecycle model.

## Design Principles

Trellis follows the same core principles as the rest of `os-eco`:

- Git-native storage: YAML and JSONL files that merge cleanly and need no external database
- Zero runtime dependencies: a single Bun CLI with no daemon or server
- Multi-agent safe: advisory file locking for concurrent writes
- CLI-first: every operation is a shell command with `--json`
- Consistent UX: shell completions, help screens, and flag conventions aligned with the stack

## Concurrency & Multi-Agent Safety

Trellis is designed for concurrent human and agent use in the same repo:

- writes go through advisory file locks
- specs and plans are stored as individual YAML files to reduce merge pressure
- handoffs and events are append-only JSONL where that model fits better
- lifecycle transitions are explicit so tools can reason about blocked, active, and completed work safely

## Integration with Overstory

Trellis works standalone, but it is designed to compose cleanly with Overstory.

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

Trellis is part of the [os-eco](https://github.com/jayminwest/os-eco) AI agent tooling ecosystem.

<p align="center">
  <img src="https://raw.githubusercontent.com/jayminwest/os-eco/main/branding/logo.png" alt="os-eco" width="444" />
</p>

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Transfer Intent

Trellis is being incubated under `RogerNavelsaker/trellis` with the intent to transfer it into the `os-eco` umbrella once the direction and ownership path are confirmed.

## License

MIT
