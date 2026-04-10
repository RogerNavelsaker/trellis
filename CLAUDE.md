# Trellis CLAUDE.md

Git-native specs, plans, and handoff artifacts for the `os-eco` toolchain.

## Quick Reference

```bash
tl init              # Initialize .trellis/ in current repo
tl doctor            # Run repo health checks
tl spec create <id>  # Create a new specification
tl plan create <id>  # Create a new execution plan
tl handoff append <id> --from <role> --to <role> --summary "..."
tl timeline <id>     # View audit trail and lifecycle transitions
```

## Tech Stack

- **Runtime:** Bun (runs TypeScript directly, no build step)
- **Language:** TypeScript with strict mode (`noUncheckedIndexedAccess`, no `any`)
- **Linting:** Biome (formatter + linter in one tool)
- **Runtime dependencies:** `chalk` (v5, ESM-only color output), `commander` (CLI framework)
- **Core I/O:** Bun built-in APIs (`Bun.file`, `Bun.write`, etc.), `node:fs/promises`
- **External CLIs:** `sd` (seeds) for issue tracking, `mulch` for expertise, `git`

## Directory Structure

```text
trellis/
  package.json
  tsconfig.json
  biome.json
  CLAUDE.md
  CHANGELOG.md
  README.md
  docs/                        # Architecture and storage contracts
  scripts/
    version-bump.ts            # Bump version in package.json + src/index.ts
  src/
    index.ts                   # CLI entry + command router + VERSION constant
    types.ts                   # Shared types, interfaces, and constants
    commands/                  # One file per CLI subcommand
      spec.ts                  # trellis spec create|show|update|start|complete|list
      plan.ts                  # trellis plan create|show|update|start|block|resume|complete|list
      audit.ts                 # trellis audit blocked|stale|orphaned
      handoff.ts               # trellis handoff append|show|latest|list
      event.ts                 # trellis event list
      template.ts              # trellis template init|show|placeholders|render
      artifact.ts              # trellis show|inspect|timeline
      completions.ts           # trellis completions (bash/zsh/fish)
    storage/                   # Data persistence layer
      specs.ts                 # Spec create/read/update/list (YAML)
      plans.ts                 # Plan create/read/update/list (YAML)
      handoffs.ts              # Append-only handoff logs (JSONL)
      events.ts                # Shared transition + handoff event log
      validate.ts              # Input and stored-data validation
      yaml.ts                  # YAML parsing and serialization (standardized)
    system/                    # Core runtime utilities
      json.ts                  # Standardized JSON output envelope
      init.ts                  # .trellis/ scaffold + constants
      doctor.ts                # Repo health and consistency checks
      errors.ts                # Typed error classes
      lock.ts                  # Advisory file locking for concurrent updates
      output.ts                # Forest palette (brand/accent/muted), printSuccess/printError
      templates.ts             # Template placeholder contracts
      render.ts                # Template rendering for artifacts
      utils.ts                 # Shared CLI helpers (handleCommandError, formatters, resolvers)
    workflow/                  # Business logic
      transitions.ts           # Lifecycle transition rules and enforcement
      audit.ts                 # Blocked, stale, or orphaned artifact audits
      patch.ts                 # Partial update helpers
    *.test.ts                  # Tests colocated with source
```

## Conventions

- **Git-native:** Artifacts are plain YAML/JSONL, designed to be diffable and mergeable.
- **Zero Daemon:** No background processes or servers. Pure CLI tool.
- **Strict TypeScript:** `noUncheckedIndexedAccess` enabled, no `any`, use `unknown`.
- **Minimal Dependencies:** Prefer Bun built-in APIs over npm packages.
- **Concurrent-safe:** Advisory file locks + atomic writes for all state changes.
- **Standardized Output:** Every command supports `--json` with a stable envelope.
- **Explicit Transitions:** Lifecycle changes are logged with actor, timestamp, and intent.

## Quality Gates

Before finishing a task:
```bash
bun test                           # Run all tests
bun run lint                       # Biome check
bun run typecheck                  # Type check (tsc --noEmit)
```

## Session Completion Protocol

When ending a work session:

1. **File Issues:** Create `sd` issues for remaining or blocked work.
2. **Quality Gates:** Run all quality gates (test + lint + typecheck).
3. **Commit & Push:** Ensure all changes are committed and pushed to remote.
   ```bash
   git pull --rebase
   sd sync
   git push
   ```
4. **Hand Off:** Provide a concise summary of current state and next steps.

<!-- mulch:start -->
<!-- mulch:end -->
