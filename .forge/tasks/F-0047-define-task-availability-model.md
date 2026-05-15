---
id: F-0047
title: Define task availability model
kind: task
status: done
priority: high
parent: F-0000
depends_on:
  - F-0011
claimed_by: ""
area: core
scope:
  - packages/core/**
  - packages/cli/**
  - packages/web/**
  - .forge/tasks/**
created_at: 2026-05-15T00:00:00-05:00
updated_at: 2026-05-15T05:30:06.752Z
closed_at: 2026-05-15T05:30:06.752Z
close_reason: "Availability model defined and verified"
blocked_reason: ""
review_reason: ""
---

# Define task availability model

## Why

Forge currently blends true blockers with active and claimed state. That makes the UI and robot output describe in-progress work as blocked, which is confusing during dogfooding.

## What success looks like

Core analysis exposes a clear task availability classification while preserving existing ready queue behavior.

## Acceptance Criteria

- Add an availability classification for each task: `ready`, `active`, `claimed`, `blocked`, or `closed`.
- Keep dependency, graph, and data problems separate from status and claim state.
- Treat `doing` as `active`, not blocked.
- Treat open claimed tasks as `claimed`, not blocked.
- Treat unfinished dependencies, missing dependencies, cycles, and data diagnostics as `blocked`.
- Treat `done` and `canceled` as `closed`.
- Preserve existing ready-task behavior for `forge queue`, `forge next`, and ranking.
- Tests cover open ready, doing, claimed open, dependency-blocked, graph-error-blocked, done, and canceled tasks.

## Dependencies

Depends on `F-0011` because availability should build on the shared task graph engine.

## Verification

- Run `bun test packages/core packages/cli packages/web`.
- Run `bun run quality:check`.

## Notes

This task defines semantics and reusable data. UI wording changes should happen in `F-0048`.

Implementation decision: `analyzeTasks` now exposes `availabilityByTaskId` with the reusable classification. Ready tasks are derived from `availability === "ready"` so `forge queue`, `forge next`, and ranking keep the same ready-task behavior.

Blocker strings now represent actual dependency, graph, or data problems: unfinished dependencies, missing dependencies, duplicate ids, and dependency cycles. Claimed state and `doing` status are classified as `claimed` and `active` instead of being reported as blockers.

The web task graph payload includes `availabilityByTaskId` for every task so UI work can consume the classification without re-deriving it from status and blockers.

Verification:
- `bun test packages/core packages/cli packages/web` passed with 117 tests.
- `bun run quality:check` passed with 117 tests and the production web build.

## History

- Created 2026-05-15T00:00:00-05:00.
- Claimed by codex and implemented the shared availability model.
