# Forge Files

`.forge` contains the repo-local source of truth for Forge work.

## Task Format

Tasks live in `.forge/tasks/*.md`.

Use plain YAML frontmatter followed by a normal Markdown body:

```markdown
---
id: F-0001
title: Define task format
kind: task
status: open
priority: high
parent: F-0000
depends_on: []
claimed_by: ""
area: core
scope:
  - .forge/**
created_at: 2026-05-14T00:00:00-05:00
updated_at: 2026-05-14T00:00:00-05:00
closed_at:
close_reason:
---

# Define task format

## Why

...

## What success looks like

...

## Acceptance Criteria

- ...

## Execution Plan

Summary: ...

Scope: ...

Approach:
- ...

Verification:
- ...

Stop conditions:
- ...

Human review triggers:
- ...

## Dependencies

None.

## Verification

- ...

## Notes

...

## History

- Created 2026-05-14T00:00:00-05:00.
```

## Canonical Fields

- `id`: stable task id, unique inside the repo.
- `title`: short human label.
- `kind`: `task` or `spec`.
- `status`: `open`, `doing`, `blocked`, `done`, or `canceled`.
- `priority`: `urgent`, `high`, `medium`, or `low`.
- `parent`: optional parent spec/task id.
- `depends_on`: task ids that must finish first.
- `claimed_by`: optional human or agent identifier.
- `area`: optional human grouping for project, package, app, or subsystem.
- `scope`: optional file globs the task expects to touch.
- `created_at`: ISO timestamp.
- `updated_at`: ISO timestamp.
- `closed_at`: optional ISO timestamp for completed or canceled work.
- `close_reason`: optional human-readable completion or cancellation reason.
- `blocked_reason`: optional human-readable reason the task is blocked.
- `review_reason`: optional human-readable reason the task needs review.

## Expected Task Markdown Fields

Keep the body readable Markdown. Forge expects every well-formed task brief to
have these Markdown sections:

1. `Why`
2. `What success looks like`
3. `Acceptance Criteria`
4. `Verification`
5. `Notes`

These are expected fields, not frontmatter schema. Missing fields should be
reported as quality warnings by tools, not task parse errors. Direct Markdown
edits are valid for rich task body changes as long as frontmatter stays intact.

Forge also supports these standard sections when the task needs them:

- `Execution Plan`
- `Dependencies`
- `History`

`Execution Plan` lives in the Markdown body, not frontmatter. It is the durable
per-task plan an agent or human can update before implementation begins and as
the work changes. Use this default shape:

- `Summary`: the short implementation intent.
- `Scope`: the files, packages, or behaviors expected to change.
- `Approach`: the ordered implementation steps.
- `Verification`: the checks that should prove the task is complete.
- `Stop conditions`: blockers or risk signals that should pause execution.
- `Human review triggers`: judgment calls that need explicit review.

The CLI should generate expected fields for new tasks. Users may add extra `##`
sections when a task needs more context. Tools should render known sections
first, preserve existing execution plans, and preserve unknown sections rather
than rejecting them.

## Check-In Convention

Task files are the check-in surface. Record evidence in Markdown first; do not
add frontmatter fields for review policy or closeout notes unless Forge later
needs a general machine-readable rule.

Use these sections for check-ins:

- `Execution Plan`: record the current approach before implementation starts.
  Update `Stop conditions` when a task should pause, and `Human review
  triggers` when a judgment call needs a person.
- `Verification`: keep the planned checks for the task.
- `Notes`: append actual decisions, blockers, review requests, and verification
  results as work happens.
- `History`: keep durable lifecycle events such as task creation. Tools may
  append concise lifecycle entries, but routine work evidence belongs in
  `Notes`.

When work is done and verified:

```markdown
## Notes

Implemented the queue keyboard navigation and kept the change inside
`packages/web/**`.

Verification:
- `bun test packages/web`
- `bun run quality:check`
```

Then set `status: done`, clear `claimed_by`, set `closed_at`, and write a short
`close_reason`.

When work is blocked:

```markdown
## Notes

Blocked: the API contract for persisted claims is not decided. Stop until the
planning agent records whether claims are local-only or shared.
```

Then set `status: blocked` and write the same short reason in `blocked_reason`.

When work needs human review but can keep its current status:

```markdown
## Notes

Review needed: the implementation works, but the visual hierarchy in the task
detail card is a product judgment. Do not close until the user reviews the
browser screenshot.
```

Then keep the task claimed or open as appropriate and write the short reason in
`review_reason`. If the task cannot continue without that answer, block it
instead.

App-specific review policy belongs in task Markdown or repository agent
instructions such as `AGENTS.md`, not in Forge's generic task schema. For
example, a web app may require a browser screenshot before closeout, while a
library task may require API compatibility notes.

## Storage Model

Use one tracked `.forge/` directory at the git repository root.

Do not create nested `.forge/` directories inside packages, apps, or modules in v0.
Nested stores split the task graph and make dependencies harder to reason about.

Relate work to projects or directories with:

- `scope` for machine-readable file globs.
- `area` for human grouping such as `core`, `cli`, `web`, or `docs`.

## Derived Relationships

Do not store reverse edges unless there is a strong reason.

- `children` is derived by scanning `parent`.
- `blocks` is derived by scanning `depends_on`.
- `ready` is derived from `status`, `depends_on`, and `claimed_by`.

## Ready Rule

A task is ready when:

- `status` is `open`
- `claimed_by` is empty
- every task in `depends_on` is `done` or `canceled`

## Internal Harness Commands

Forge keeps internal developer and agent checks as package scripts, not as
customer-facing `forge` CLI commands.

- `bun run harness:cli` runs the focused CLI workflow harness.
- `bun run harness:web` runs the current web harness checks.
- `bun run harness:check` runs the aggregate in-repo harness and test suite.
- `bun run quality:check` runs `harness:check` and the production web build.

Use the focused harness when a task touches one surface:

- Web UI, Vite server, or `/api/tasks` changes should name
  `bun run harness:web`.
- CLI workflow, command, prompt, or robot JSON changes should name
  `bun run harness:cli`.
- Broad behavior, graph, task-store, or cross-surface changes should name
  `bun run harness:check`.

Use `bun run quality:check` before closing broad or cross-surface work. These
checks are advisory task guidance, not schema fields, and they should be written
in the task `Verification` or `Notes` sections when relevant.

## Cache Policy

Future tools may create a local cache or index, but cache files must be ignored
by git. Markdown task files remain canonical.
