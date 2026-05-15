---
id: F-0012
title: Build ranked queue engine
kind: task
status: done
priority: urgent
parent: F-0000
depends_on:
  - F-0011
claimed_by: ""
area: core
scope:
  - packages/core/**
  - .forge/tasks/**
created_at: 2026-05-15T00:00:00-05:00
updated_at: 2026-05-15T05:30:00.000Z
closed_at: 2026-05-15T05:00:00.000Z
close_reason: "Backfilled by F-0045; timestamp is approximate."
---

# Build ranked queue engine

## Why

Agents need Forge to recommend the next task instead of manually scanning ready tasks. Ranking should be explainable so agents and humans can trust why a task surfaced first.

## What success looks like

`@forge/core` returns a deterministic ranked queue of ready tasks with machine-readable recommendation reasons.

## Acceptance Criteria

- Ready tasks are ranked by priority, downstream unblock count, then stable task id.
- Queue entries include recommendation reasons such as priority, downstream unblock count, and no blockers.
- Blocked and claimed tasks are excluded from the ready queue.
- Ranking output can be reused by both CLI robot commands and the web UI.
- Tests cover priority ordering, downstream ordering, tie-breaks, blocked tasks, claimed tasks, and reason output.

## Dependencies

Depends on `F-0011` because ranking should use the shared task graph engine.

## Verification

- `bun test` passed in `packages/core`.
- `bun test packages/cli/test/cli.test.ts` passed from the repo root.
- Stable queue output is covered by the tie-break test running the same fixture in reversed input order.

## Notes

Added `rankReadyTaskQueue` as the reusable queue output and kept `rankReadyTasks` as the compatibility wrapper. Queue entries include rank, task id, task, priority rank, downstream unblock count, blockers, and typed recommendation reasons.

## History

- Created 2026-05-15T00:00:00-05:00.
- Claimed and implemented 2026-05-15.
