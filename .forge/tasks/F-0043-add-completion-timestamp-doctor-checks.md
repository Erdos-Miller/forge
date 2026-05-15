---
id: F-0043
title: Add completion timestamp doctor checks
kind: task
status: done
priority: urgent
parent: F-0000
depends_on:
  - F-0016
claimed_by: ""
area: cli
scope:
  - packages/core/**
  - packages/cli/**
  - .forge/tasks/**
created_at: 2026-05-15T00:00:00-05:00
updated_at: 2026-05-15T05:30:00.000Z
closed_at: 2026-05-15T05:00:00.000Z
close_reason: "Backfilled by F-0045; timestamp is approximate."
---

# Add completion timestamp doctor checks

## Why

Completion analytics depend on accurate close metadata. Forge should detect completed tasks that predate `closed_at` or have inconsistent close timestamps.

## What success looks like

`forge doctor --json` reports completion timestamp problems with actionable diagnostics before any historical data repair happens.

## Acceptance Criteria

- Doctor reports `done` or `canceled` tasks missing `closed_at`.
- Doctor reports non-closed tasks that have `closed_at`.
- Doctor reports `closed_at` earlier than `created_at`.
- Diagnostics include task id, source path, severity, stable code, and repair hint.
- Valid closed tasks do not report diagnostics.
- Tests cover valid closed tasks and each invalid timestamp case.

## Dependencies

Depends on `F-0016` because this extends doctor diagnostics.

## Verification

- Run `bun test packages/core packages/cli`.
- Run `bun run quality:check`.
- Smoke-check doctor output on a fixture with one missing historical completion timestamp.

## Notes

Do not repair existing task data in this task. This only adds detection.

Prioritize this before other advisory doctor expansions because burndown and completion analytics depend on trustworthy `closed_at` data.

Implemented as doctor diagnostics rather than parser validation so historical task files remain readable while analytics can reject inconsistent close metadata.

Verification:
- `bun test packages/core packages/cli`
- `bun run quality:check`
- `bun test packages/cli/test/cli.test.ts -t "completion timestamp diagnostics"`

## History

- Created 2026-05-15T00:00:00-05:00.
- Reprioritized to urgent because completion timestamps feed the burndown chart.
- Implemented completion timestamp doctor checks and fixture coverage.
