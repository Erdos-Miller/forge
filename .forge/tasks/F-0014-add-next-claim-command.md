---
id: F-0014
title: Add next claim command
kind: task
status: done
priority: urgent
parent: F-0000
depends_on:
  - F-0013
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

# Add next claim command

## Why

Dogfooding depends on one command that lets an agent ask Forge what to do next and optionally claim that task immediately.

## What success looks like

`forge next --claim --by codex --json` selects the top ranked ready task, claims it in one write, and emits the task bundle the agent needs to start work.

## Acceptance Criteria

- `forge next --json` returns the top ranked ready task without mutating files.
- `forge next --claim --by <agent> --json` claims the top ranked ready task and returns the claimed task bundle.
- The command returns a clear empty-queue response when no task is ready.
- Claim writes update `status`, `claimed_by`, and `updated_at`.
- The command does not claim tasks with blockers or existing claims.
- Tests cover read-only next, claimed next, empty queue, and claim persistence.

## Dependencies

Depends on `F-0013` because `next` should reuse the robot task bundle and queue contract.

## Verification

- `bun test packages/cli/test/cli.test.ts` passed.
- `bun run quality:check` passed from the repo root.
- `forge next --json` returned the top ranked real repo task without mutating files.
- Temp-repo CLI tests cover `forge next --claim --by codex --json` persistence.

## Notes

Added JSON-only `next` with read-only selection, optional claim, empty queue response, and `--by` validation. Claim mode ranks first, writes the selected ready task, and returns the claimed bundle with the original rank and reasons.

## History

- Created 2026-05-15T00:00:00-05:00.
- Claimed and implemented 2026-05-15.
