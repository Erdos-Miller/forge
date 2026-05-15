---
id: F-0013
title: Add robot queue and introspection commands
kind: task
status: done
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
updated_at: 2026-05-15T05:30:00.000Z
closed_at: 2026-05-15T05:00:00.000Z
close_reason: "Backfilled by F-0045; timestamp is approximate."
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

- `bun test packages/cli/test/cli.test.ts` passed.
- `bun run quality:check` passed from the repo root.
- `forge queue --json` returned a ranked JSON payload from the repo root.

## Notes

Added JSON-only `queue`, `show`, `blockers`, and `deps` commands. The queue command exposes the core ranked queue reasons; `show` includes parsed Markdown `##` sections; task lookup failures use the documented robot error envelope and exit `3`.

## History

- Created 2026-05-15T00:00:00-05:00.
- Claimed and implemented 2026-05-15.
