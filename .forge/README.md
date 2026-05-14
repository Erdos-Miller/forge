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
scope:
  - .forge/**
created_at: 2026-05-14T00:00:00-05:00
updated_at: 2026-05-14T00:00:00-05:00
---

# Define task format

## Context

...

## Acceptance Criteria

- ...

## Notes

...
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
- `scope`: optional file globs the task expects to touch.
- `created_at`: ISO timestamp.
- `updated_at`: ISO timestamp.

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
