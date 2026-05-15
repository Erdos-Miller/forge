---
id: F-0016
title: Add doctor JSON command
kind: task
status: open
priority: high
parent: F-0000
depends_on:
  - F-0011
claimed_by: ""
area: cli
scope:
  - packages/core/**
  - packages/cli/**
  - .forge/tasks/**
created_at: 2026-05-15T00:00:00-05:00
updated_at: 2026-05-15T00:00:00-05:00
closed_at: ""
close_reason: ""
---

# Add doctor JSON command

## Why

If Markdown files are canonical, Forge needs a fast validator that agents can run before trusting or closing work.

## What success looks like

`forge doctor --json` reports graph and task-store problems with source paths, stable diagnostic codes, and actionable messages.

## Acceptance Criteria

- Doctor reports malformed YAML, missing frontmatter, duplicate ids, missing dependencies, dependency cycles, invalid timestamps, invalid enum values, merge conflict markers, and invalid block or review field usage.
- Diagnostics include stable code, severity, message, task id when known, and source path when known.
- Clean task stores return success with an empty diagnostics list.
- Invalid task stores return the documented nonzero exit code.
- Tests cover every diagnostic category.

## Dependencies

Depends on `F-0011` because doctor should use the shared graph engine and diagnostics.

## Verification

- Run `bun test` in `packages/core` and `packages/cli`.
- Smoke-check `forge doctor --json` on the Forge repo and on malformed temp fixtures.

## Notes

Doctor should be useful to agents. Prefer actionable diagnostics over generic parse failures.

## History

- Created 2026-05-15T00:00:00-05:00.
