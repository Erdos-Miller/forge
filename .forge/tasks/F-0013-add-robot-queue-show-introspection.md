---
id: F-0013
title: Add robot queue and introspection commands
kind: task
status: open
priority: urgent
parent: F-0000
depends_on:
  - F-0012
claimed_by: ""
area: cli
scope:
  - packages/cli/**
  - packages/core/**
  - .forge/tasks/**
created_at: 2026-05-15T00:00:00-05:00
updated_at: 2026-05-15T00:00:00-05:00
closed_at: ""
close_reason: ""
---

# Add robot queue and introspection commands

## Why

Agents need Beads-style robot commands for fast introspection without opening a viewer or parsing human text.

## What success looks like

The CLI exposes compact JSON commands for queue, task detail, blockers, and dependencies.

## Acceptance Criteria

- `forge queue --json` emits ranked queue entries from the core queue engine.
- `forge show <id> --json` emits a task bundle with id, title, status, priority, area, scope, dependencies, source path, and canonical Markdown sections when available.
- `forge blockers <id> --json` emits blockers and diagnostic context for one task.
- `forge deps <id> --json` emits direct dependencies and direct dependents.
- Unknown task ids return the documented error shape and nonzero exit code.
- CLI tests cover success and failure cases for each command.

## Dependencies

Depends on `F-0012` because commands should expose ranked queue data rather than raw ready-task ordering.

## Verification

- Run `bun test` in `packages/core` and `packages/cli`.
- Smoke-check `forge queue --json` from the repo root.

## Notes

Keep output compact and deterministic. Human pretty output can remain minimal or be deferred.

## History

- Created 2026-05-15T00:00:00-05:00.
