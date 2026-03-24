# Trellis Contract

Trellis is a repo-local document layer for the `os-eco` ecosystem.

It stores three artifact classes:

- specs: durable statement of intent and acceptance criteria
- plans: execution shape linked to a spec and optionally to a Seeds issue
- handoffs: append-only JSONL coordination records between humans and agents

## Storage Layout

```text
.trellis/
  specs/
    <spec-id>.yaml
  plans/
    <plan-id>.yaml
  handoffs/
    <plan-id>.jsonl
  templates/
  locks/
  README.md
  .gitignore
```

## Responsibility Boundaries

- Seeds owns issue state, dependency graphs, and readiness
- Mulch owns expertise and lessons
- Canopy owns prompts
- Overstory owns orchestration
- Trellis owns the richer workflow documents those tools can reference

This means a Trellis record may include `seed: seed-123`, but Trellis never becomes the authority for issue status.

## Spec Schema

Files: `.trellis/specs/<spec-id>.yaml`

Fields:

- `id`
- `title`
- `seed` optional
- `status`
- `createdAt`
- `updatedAt`
- `objective`
- `constraints`
- `acceptance`
- `references`

## Plan Schema

Files: `.trellis/plans/<plan-id>.yaml`

Fields:

- `id`
- `title`
- `seed` optional
- `spec` optional
- `status`
- `createdAt`
- `updatedAt`
- `summary`
- `steps`

## Handoff Schema

Files: `.trellis/handoffs/<plan-id>.jsonl`

Each line is a JSON object with:

- `timestamp`
- `plan`
- `from`
- `to`
- `summary`
- `spec` optional
- `seed` optional

## Initial Command Surface

- `trellis init`
- `trellis doctor`
- `trellis spec create|show|list|update`
- `trellis spec start|complete`
- `trellis plan create|show|list|update`
- `trellis plan start|block|resume|complete`
- `trellis handoff append|show`
- `trellis handoff list`
- `trellis template init|show`
- `trellis template placeholders|render`
- `trellis show`
- `trellis inspect`

## Lifecycle Rules

- spec: `draft -> active -> done`
- plan: `draft -> active|blocked`, `active -> blocked|done`, `blocked -> active|done`
- blocking a plan requires a reason
- blocking or completing a plan can also record a durable handoff when `from`, `to`, and `reason` are provided

## Follow-up Overstory Integration Target

The follow-up Overstory PR should:

- stop writing `openspec/changes/<task-id>/tasks.md`
- write Trellis specs/plans instead when workflow mode needs structured artifacts
- keep issue identifiers in Seeds and reference them through Trellis `seed` fields
- keep prompt selection in Canopy / Overstory workflow profiles
- use Trellis handoffs for durable workflow payloads when appropriate
