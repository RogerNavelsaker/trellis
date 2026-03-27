# Trellis JSON Contract

Every `trellis` command supports `--json`.

The top-level contract is stable:

- success responses:
  - `success: true`
  - `command: <command-name>`
  - command-specific payload fields
- error responses:
  - `success: false`
  - `command: <command-name>`
  - `error: <message>`

When `--json` is enabled, Trellis must emit exactly one JSON object to stdout for the command result.
That means:

- no ANSI color codes in the JSON payload
- no human-readable status lines mixed into stdout
- no stray `console.log` or `console.error` output outside the JSON envelope
- top-level failures should still resolve to the same envelope shape

## Top-Level Success Shapes

Commands that operate on a single artifact return a named record:

- `spec create|show|update|start|complete`
  - `spec`
- `plan create|show|update|start|block|resume|complete`
  - `plan`
- `handoff append`
  - `handoff`

Commands that return collections also return `count` when the shape is list-like:

- `spec list`
  - `specs`
  - `count`
  - `filters`
- `plan list`
  - `plans`
  - `count`
  - `filters`
- `handoff show`
  - `plan`
  - `handoffs`
  - `count`
- `handoff list`
  - `handoffs`
  - `count`
- `event list`
  - `events`
  - `count`
- `audit blocked`
  - `blocked`
  - `count`
- `audit stale`
  - `stale`
  - `count`
  - `days`

Commands with structured but non-list payloads:

- `init`
  - `root`
  - `trellisDir`
- `doctor`
  - `root`
  - `checks`
  - `failed`
- `handoff latest`
  - `plan`
  - `handoff`
- `audit orphaned`
  - `specsWithoutPlans`
  - `plansWithMissingSpecs`
  - `handoffsForMissingPlans`
- `template init`
  - `written`
  - `count`
- `template show`
  - `kind`
  - `template`
- `template placeholders`
  - `kind`
  - `placeholders`
- `template render`
  - `kind`
  - `data`
  - `output`
- `show`
  - resolved artifact payload
- `inspect`
  - resolved artifact payload
  - `handoffs`
  - `handoffCount`
- `timeline`
  - resolved artifact payload
  - `events`
  - `handoffs`
- `version`
  - `name`
  - `version`
  - `runtime`

## Artifact Field Stability

These record fields are intended to remain stable:

- spec:
  - `id`
  - `title`
  - `seed`
  - `status`
  - `createdAt`
  - `updatedAt`
  - `completedAt`
  - `completionSummary`
  - `objective`
  - `constraints`
  - `acceptance`
  - `references`
- plan:
  - `id`
  - `title`
  - `seed`
  - `spec`
  - `status`
  - `createdAt`
  - `updatedAt`
  - `completedAt`
  - `completionSummary`
  - `summary`
  - `steps`
- handoff:
  - `timestamp`
  - `plan`
  - `from`
  - `to`
  - `summary`
  - `spec`
  - `seed`
- event:
  - `timestamp`
  - `type`
  - `artifactKind`
  - `artifactId`
  - `fromStatus`
  - `toStatus`
  - `from`
  - `to`
  - `summary`
  - `spec`
  - `seed`
  - `plan`

## Compatibility Rule

Trellis may add new fields in future releases, but it should avoid:

- renaming existing top-level payload keys
- removing existing top-level payload keys
- changing existing record fields to incompatible types
- changing `success` / `command` / `error` semantics
