---
id: F-0024
title: Add guidance command
kind: task
status: done
priority: urgent
parent: F-0000
depends_on:
  - F-0023
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

# Add guidance command

## Why

Agents should be able to request contextual guidance directly from Forge without relying on a prompt command or manually finding guidance files.

## What success looks like

The CLI exposes `forge guidance` for cwd-based, task-based, and explicit path-based guidance lookup, with compact text and JSON output.

## Acceptance Criteria

- `forge guidance` resolves guidance from the current working directory.
- `forge guidance --json` emits a stable machine-readable guidance bundle.
- `forge guidance --for-task F-123` resolves guidance from a task's `area` and `scope`.
- `forge guidance --path <path>` resolves guidance for explicit paths.
- `forge guidance --full` includes full matched guidance content instead of only prompt summaries.
- Usage errors and missing task ids return documented nonzero behavior.
- Tests cover text output, JSON output, cwd mode, task mode, path mode, full mode, and errors.

## Dependencies

Depends on `F-0023` because the command should use the shared core resolver.

## Verification

- `bun test packages/cli/test/cli.test.ts` passed.
- `bun run quality:check` passed from the repo root.
- `forge guidance --json` returned stable JSON from the repo root.
- `forge guidance --json` returned stable JSON from `packages/cli/src`.

## Notes

Added `forge guidance` with concise text output by default and JSON output with `--json`. The command supports cwd, `--for-task`, repeated `--path`, and `--full`; missing task ids return the robot `task_not_found` envelope for JSON callers.

## History

- Created 2026-05-15T00:00:00-05:00.
- Claimed and implemented 2026-05-15.
