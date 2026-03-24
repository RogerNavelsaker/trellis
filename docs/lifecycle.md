# Trellis Lifecycle In The os-eco Ecosystem

Trellis does not replace any existing `os-eco` tool. It provides the workflow documents that connect them.

## 1. Seeds declares the work

Seeds remains the source of truth for issue state:

- issue IDs
- status
- dependencies
- readiness

A Trellis spec or plan may link to a Seeds issue through `seed: seed-123`, but Trellis never becomes the issue tracker.

## 2. Trellis captures intent as a spec

Use a spec when the work needs a durable statement of intent:

- what is being changed
- why it matters
- constraints
- acceptance criteria
- references

Specs should be stable enough to survive across multiple implementation attempts.

## 3. Trellis captures execution shape as a plan

Use a plan when the work needs an actionable execution path:

- a linked spec
- a linked Seeds issue when applicable
- a current status
- a summary of the approach
- concrete execution steps

Plans can be shorter-lived than specs and may be revised more often.

## 4. Canopy can supply document templates

Canopy remains the prompt system. Trellis should not absorb prompt management.

The intended interaction is:

- Canopy renders prompt content
- Trellis stores the resulting workflow documents
- templates in `.trellis/templates/` give both humans and agents a stable structure

## 5. Overstory orchestrates against Trellis artifacts

Overstory remains the orchestrator.

The intended integration path is:

- Overstory creates or updates Trellis specs/plans for workflow-mode work
- Overstory passes those artifacts into agents as context
- Overstory records durable handoffs into Trellis when work changes owners or phases

This is the future replacement path for the OpenSpec-shaped workflow output in `#130`.

## 6. Sapling consumes Trellis context

Sapling remains the headless coding runtime.

Trellis gives Sapling a stable set of repo-local documents to consume:

- spec for intent
- plan for execution
- handoff log for continuity

## 7. Mulch records durable learning after the work

Mulch remains the expertise system.

When a Trellis-backed effort is complete:

- Trellis keeps the workflow artifacts
- Mulch captures the reusable lessons, conventions, and patterns

That boundary matters: Trellis stores the workflow history, Mulch stores the reusable knowledge.

## Practical Rule

- Seeds answers: what work exists and what is its state?
- Trellis answers: what is the intended change and how are we executing it?
- Overstory answers: which agents are doing the work and how are they coordinated?
- Sapling answers: how does a coding agent execute the task?
- Canopy answers: what prompt/program should shape the interaction?
- Mulch answers: what should future agents remember?

