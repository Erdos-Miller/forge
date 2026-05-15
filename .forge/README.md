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

## Canonical Markdown Sections

Keep the body readable Markdown, but create tasks with the known sections in this order:

1. `Why`
2. `What success looks like`
3. `Acceptance Criteria`
4. `Dependencies`
5. `Verification`
6. `Notes`
7. `History`

The CLI should generate these sections for new tasks. Users may add extra `##` sections after the canonical sections when a task needs more context. Tools should render known sections first and preserve unknown sections rather than rejecting them.

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

## Cache Policy

Future tools may create a local cache or index, but cache files must be ignored by git. Markdown task files remain canonical.
