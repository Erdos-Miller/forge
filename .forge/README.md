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

## Canonical Markdown Sections

Keep the body readable Markdown, but create tasks with the known sections in this order:

1. `Why`
2. `What success looks like`
3. `Acceptance Criteria`
4. `Execution Plan`
5. `Dependencies`
6. `Verification`
7. `Notes`
8. `History`

`Execution Plan` lives in the Markdown body, not frontmatter. It is the durable
per-task plan an agent or human can update before implementation begins and as
the work changes. Use this default shape:

- `Summary`: the short implementation intent.
- `Scope`: the files, packages, or behaviors expected to change.
- `Approach`: the ordered implementation steps.
- `Verification`: the checks that should prove the task is complete.
- `Stop conditions`: blockers or risk signals that should pause execution.
- `Human review triggers`: judgment calls that need explicit review.

The CLI should generate these sections for new tasks. Users may add extra `##`
sections after the canonical sections when a task needs more context. Tools
should render known sections first, preserve existing execution plans, and
preserve unknown sections rather than rejecting them.

## Storage Model

Use one tracked `.forge/` directory at the git repository root.

Do not create nested `.forge/` directories inside packages, apps, or modules in v0.
Nested stores split the task graph and make dependencies harder to reason about.

Relate work to projects or directories with:

- `scope` for machine-readable file globs.
- `area` for human grouping such as `core`, `cli`, `web`, or `docs`.

## Guidance Routing

Forge can route repo guidance into agent prompts with a committed
`.forge/guidance.yml` file and shared Markdown files in `.forge/guidance/*.md`.
This keeps project-specific instructions near the task graph without baking
product rules into the CLI.

Use this shape:

```yaml
version: 1
routes:
  - include: guidance/forge.md
    when:
      area:
        - core
      scope:
        - packages/core/**
      path:
        - packages/core/src/**
      cwd:
        - packages/core/**
```

`include` is relative to `.forge/`. A route matches when every present `when`
field matches the current context. Values inside one field are alternatives.

- `area` matches the task `area`.
- `scope` matches task `scope` globs.
- `path` matches explicit repo-relative paths under consideration.
- `cwd` matches the current working directory relative to the repo root.

Shared guidance files should use `## Prompt Summary` for the default excerpt
included in agent prompts. Content after that section may hold deeper notes for
humans and future tooling.

Include order is deterministic:

1. Read routes from `.forge/guidance.yml` in file order.
2. Include matching shared guidance files in route order.
3. De-duplicate by normalized repo-relative guidance path.
4. Include ignored local user guidance from `.forge/guidance.local.md` last when
   that file exists.

Local guidance is for machine-specific preferences or temporary notes. It must
not be required for the repo to work.

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
