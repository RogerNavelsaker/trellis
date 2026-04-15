# Trellis — Command Surface Parity

## Motivation

`sd` (seeds), `ml` (mulch), and `cn` (canopy) all expose a consistent top-level verb set that agents learn once and apply across the toolchain. `tl` (trellis) is missing most of them, which forces callers (skills, priming flows, review loops) to stitch together 2–3 subcommands or fall back to raw filesystem reads.

| Command | sd | ml | cn | **tl** |
|---|---|---|---|---|
| `prime` | ✅ | ✅ | ✅ | ❌ |
| `list` (top-level) | ✅ | — | ✅ | ❌ (only `tl plan list`, `tl spec list`) |
| `ready` | ✅ | ✅ | — | ❌ |
| `sync` | ✅ | ✅ | ✅ | ❌ |
| `stats` | ✅ | — | ✅ | ❌ |
| `onboard` | ✅ | ✅ | ✅ | ❌ |
| `search` | — | ✅ | — | ❌ |

Goal: add these seven verbs so `tl` matches the "agent surface contract" of its siblings. All are **read-side or orchestration** (except `sync`); none alter artifact semantics. No storage-layer changes required beyond what `specs.ts`, `plans.ts`, `handoffs.ts`, `events.ts` already expose.

## Non-goals

- Renaming or removing existing commands.
- Changing artifact YAML/JSONL shape.
- Adding daemons, indexes, or search infrastructure. Search is substring over in-memory loaded artifacts — good enough for thousands of records, which is the realistic ceiling.
- Building a GitHub-style unified feed. Keep `tl list` filterable but simple.

## Tasks

### 1. `tl prime` — agent priming context

Sibling shape: `sd prime`, `ml prime`, `cn prime`. Emits a compact, agent-friendly summary of current trellis state.

**Output (default / markdown):**
- Active specs (title, id, linked seeds issue)
- Active plans (title, id, status, step count, seeds/spec links)
- Blocked plans with block reasons
- Recent handoffs (last N, default 10; `--since <iso>` override)

**Flags:**
- `--json` — machine-readable envelope (match `sd prime --json`)
- `--compact` (default) / `--full` — `--full` includes step notes and handoff summaries
- `--budget <tokens>` — soft token cap, mirrors `ml prime`
- `--since <iso|relative>` — filter handoffs by time
- `--status <list>` — override which statuses count as "active" (default: `draft,active,blocked`)

**Implementation:**
- New file: `src/commands/prime.ts`
- Reuses `listSpecs`, `listPlans`, `listHandoffs` from `storage/`
- Register in `src/index.ts` next to `spec`, `plan`, etc.
- Markdown rendering via `src/system/render.ts`

**Tests:** `src/commands/prime.test.ts` — fixture repo with 2 specs, 3 plans (1 blocked), 5 handoffs; assert shape and `--json` envelope.

---

### 2. `tl list` — unified top-level list

Sibling shape: `sd list`, `cn list`. A single entry point that returns specs, plans, and handoffs in one view, filterable.

**Flags:**
- `--type <spec|plan|handoff|all>` — default `all`
- `--status <list>` — comma-separated, filters plans/specs
- `--since <iso|relative>` — for handoffs (and event-based filtering for specs/plans)
- `--plan <slug>` — restrict handoffs to one plan
- `--limit <n>` — cap rows per type
- `--json` — structured output; each row has `{kind, id, title, status, updated_at, ...}`

**Implementation:**
- New file: `src/commands/list.ts`
- Thin wrapper over `listSpecs`, `listPlans`, `listHandoffs`; merges and sorts by `updated_at`.
- Keep `tl spec list` and `tl plan list` as-is (don't break existing callers).

**Tests:** `src/commands/list.test.ts` — assert filters compose, `--limit` works per-type, `--json` envelope stable.

---

### 3. `tl ready` — unblocked work ready to act on

Sibling shape: `sd ready`, `ml ready`. Surfaces what an agent can pick up *now*.

**Definition:**
- Plans in `draft` or `active` that are **not** blocked.
- Specs in `active` that have no linked plan yet (planning gap).
- Optionally: handoffs addressed to caller that are unacknowledged (future; start with plans+specs).

**Flags:**
- `--agent <name>` — filter handoffs (when added) by recipient
- `--json`

**Implementation:**
- New file: `src/commands/ready.ts`
- Logic sits alongside `workflow/audit.ts` — consider whether a shared `readiness.ts` module is worth extracting. For v1, inline the predicate in the command.

**Tests:** `src/commands/ready.test.ts` — fixtures covering: blocked-plan excluded, spec-without-plan included, completed-plan excluded.

---

### 4. `tl sync` — stage and commit `.trellis/`

Sibling shape: `sd sync`, `ml sync`, `cn sync`. Convenience wrapper over `git add .trellis/ && git commit`.

**Flags:**
- `--message <text>` — override default commit message
- `--dry-run` — print what would be staged
- `--json`

**Default commit message:** `"trellis: sync artifacts"` followed by an auto-generated body listing changed files (`git diff --cached --name-status .trellis/`).

**Implementation:**
- New file: `src/commands/sync.ts`
- Shells out to `git` (like `sd sync` does). Confirm equivalent behavior in `@upstream/seeds`.
- Must **not** silently skip when outside a git repo — error with guidance.
- Must **not** create empty commits (`git diff --cached --quiet` check).

**Tests:** `src/commands/sync.test.ts` — use a tmp git repo fixture; assert commit created, no-op when clean, dry-run doesn't stage.

---

### 5. `tl stats` — aggregate counts

Sibling shape: `sd stats`, `cn stats`. One-shot view of counts by status.

**Output:**
- Specs: counts by status (draft / active / done)
- Plans: counts by status (draft / active / blocked / done) + total step count active vs done
- Handoffs: total, last 7d, last 30d
- Orphans: specs without plans, plans without seeds links (reuse `workflow/audit.ts`)

**Flags:**
- `--json`

**Implementation:**
- New file: `src/commands/stats.ts`
- Compose existing list + audit calls; no new storage code.

**Tests:** `src/commands/stats.test.ts` — assert counts against fixture set.

---

### 6. `tl onboard` — emit AGENTS.md/CLAUDE.md snippet

Sibling shape: `sd onboard`, `ml onboard`, `cn onboard`. Adds or updates a `trellis` section in the consuming repo's `CLAUDE.md` / `AGENTS.md`.

**Behavior:**
- If `CLAUDE.md` or `AGENTS.md` exists in `cwd`, inject or replace a marked `<!-- trellis:start -->`/`<!-- trellis:end -->` block. Idempotent.
- If neither exists, print the snippet to stdout.

**Snippet content:**
- Link to `tl init`, `tl prime`, `tl plan create`, `tl handoff append`.
- Pointer: "Never read `.trellis/` directly — use `tl` commands."

**Flags:**
- `--stdout` — never write, always print
- `--file <path>` — target a specific file
- `--json`

**Implementation:**
- New file: `src/commands/onboard.ts`
- Marker-block insert/replace helper — extract to `src/system/markers.ts` if `sd`/`ml`/`cn` have repeatable logic worth copying. Otherwise inline.

**Tests:** `src/commands/onboard.test.ts` — tmp dir fixtures: fresh write, update existing marker, respects `--stdout`.

---

### 7. `tl search` — substring search across artifacts

Sibling shape: `ml search`. Substring match over spec titles/summaries, plan titles/step notes, handoff summaries.

**Flags:**
- `--type <spec|plan|handoff|all>` — default `all`
- `--json`
- `--limit <n>`

**Implementation:**
- New file: `src/commands/search.ts`
- Load all artifacts via `listSpecs`/`listPlans`/`listHandoffs`, filter in-memory. Case-insensitive substring is fine for v1.
- For large repos later: add optional ripgrep path that shells to `rg .trellis/`.

**Tests:** `src/commands/search.test.ts` — fixtures with known tokens; assert type filter, limit, match counts.

---

## Sequencing

Do in order of agent-workflow impact (highest first):

1. **`tl prime`** — biggest skill-pain win; unlocks `priming-context` parity.
2. **`tl list`** — powers status queries from skills and review loops.
3. **`tl sync`** — removes the `git add .trellis/` skill workaround.
4. **`tl ready`** — enables "what can I start now" flows.
5. **`tl stats`** — review/health dashboards.
6. **`tl search`** — useful but not blocking.
7. **`tl onboard`** — one-shot per repo; lowest frequency.

Each task is independent. Land one per PR.

## Quality gates (per task)

```
bun test
bun run lint
bun run typecheck
```

Plus:
- `src/cli-smoke.test.ts` extended with the new verb.
- README.md quick-reference updated.
- CHANGELOG.md entry under an unreleased section.

## Open questions

- **`tl ready` scope.** Should it also surface handoffs whose recipient matches `$USER` / an env var? Out of v1; punt to a later `tl inbox`.
- **`tl list --since` semantics.** `since` as artifact `updated_at` or as event timestamp? Default to `updated_at`; allow `--since-event` later.
- **`tl prime` budget behavior.** If `--budget` exceeded, drop oldest handoffs first, then plan step notes, then handoffs entirely. Confirm against `ml prime` order.
- **`tl sync` and signed commits.** Respect `commit.gpgsign` from user config; never pass `--no-gpg-sign`. (Matches the repo's hard rule.)
- **`tl onboard` marker conflict.** If a user-authored `<!-- trellis:... -->` block exists without the matching `start`/`end`, error rather than overwrite.

## Docs to update on completion

- `README.md` — Quick Reference table.
- `CLAUDE.md` — Quick Reference.
- `AGENTS.md` — add `tl prime` / `tl ready` to the top.
- `CHANGELOG.md` — one entry per command landed.
- Downstream: `mini-volition/.llm/skills/priming-context/SKILL.md` — switch from `tl plan list --status active` + `tl spec list --status active` to a single `tl prime`.
- Downstream: `mini-volition/.llm/skills/closing-sessions/SKILL.md` — replace the `git add .trellis/` note with `tl sync`.
