---
id: F-0014
title: Add next claim command
kind: task
status: open
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
updated_at: 2026-05-15T00:00:00-05:00
closed_at: ""
close_reason: ""
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

- Run `bun test` in `packages/core` and `packages/cli`.
- Smoke-check `forge next --json` and `forge next --claim --by codex --json` in a temp repo fixture.

## Notes

This is the main dogfood unlock. Keep the normal path to one parse, one rank, one optional write, and one compact JSON response.

## History

- Created 2026-05-15T00:00:00-05:00.
