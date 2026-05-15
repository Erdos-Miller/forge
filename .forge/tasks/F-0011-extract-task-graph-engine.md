---
id: F-0011
title: Extract task graph engine
kind: task
status: open
priority: urgent
parent: F-0000
depends_on:
  - F-0010
claimed_by: ""
area: core
scope:
  - packages/core/**
  - .forge/tasks/**
created_at: 2026-05-15T00:00:00-05:00
updated_at: 2026-05-15T00:00:00-05:00
closed_at: ""
close_reason: ""
---

# Extract task graph engine

## Why

Robot commands need one reusable graph model instead of each command recomputing partial views of dependencies, blockers, and derived relationships.

## What success looks like

`@forge/core` exposes a task graph engine that computes forward and reverse relationships, blockers, diagnostics, and downstream unblock counts from the canonical Markdown tasks.

## Acceptance Criteria

- The graph model exposes `tasksById`, `childrenByParent`, `dependentsById`, `blockersByTaskId`, diagnostics, and downstream unblock counts.
- Existing ready-task behavior is preserved.
- Duplicate ids, missing dependencies, and dependency cycles remain first-class diagnostics.
- Graph construction remains deterministic for stable command output.
- Tests cover linear dependencies, fan-in, fan-out, missing dependencies, duplicate ids, and cycles.

## Dependencies

Depends on `F-0010` so the engine supports the robot JSON contracts rather than drifting into UI-only shapes.

## Verification

- Run `bun test` in `packages/core`.
- Confirm existing CLI tests still pass after core graph extraction.

## Notes

This is an engine refactor. Avoid adding new CLI commands here except minimal exports needed for tests.

## History

- Created 2026-05-15T00:00:00-05:00.
