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
  events.jsonl
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
- `completedAt` optional
- `completionSummary` optional until the spec reaches `done`
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
- `completedAt` optional
- `completionSummary` optional until the plan reaches `done`
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

## Event Schema

File: `.trellis/events.jsonl`

Each line is a JSON object with:

- `timestamp`
- `type`: `spec.transition` | `plan.transition` | `handoff.append`
- `artifactKind`
- `artifactId`
- `fromStatus` optional
- `toStatus` optional
- `from` optional
- `to` optional
- `summary` optional
- `spec` optional
- `seed` optional
- `plan` optional

## Initial Command Surface

- `trellis init`
- `trellis doctor`
- `trellis spec create|show|list|update`
- `trellis spec start|complete`
- `trellis plan create|show|list|update`
- `trellis plan start|block|resume|complete`
- `trellis handoff append|show`
- `trellis handoff latest|list`
- `trellis audit blocked|stale|orphaned`
- `trellis event list`
- `trellis template init|show`
- `trellis template placeholders|render`
- `trellis show`
- `trellis inspect`
- `trellis timeline`

## Lifecycle Rules

- spec: `draft -> active -> done`
- plan: `draft -> active|blocked`, `active -> blocked|done`, `blocked -> active|done`
- blocking a plan requires a reason
- completing a spec requires a completion summary and all linked plans to be `done`
- completing a plan requires a completion summary
- blocking or completing a plan can also record a durable handoff when `from`, `to`, and the relevant summary/reason are provided
- all transitions and handoff appends are recorded in `.trellis/events.jsonl`

## Follow-up Overstory Integration Target

The follow-up Overstory PR should:

- stop writing `openspec/changes/<task-id>/tasks.md`
- write Trellis specs/plans instead when workflow mode needs structured artifacts
- keep issue identifiers in Seeds and reference them through Trellis `seed` fields
- keep prompt selection in Canopy / Overstory workflow profiles
- use Trellis handoffs for durable workflow payloads when appropriate
