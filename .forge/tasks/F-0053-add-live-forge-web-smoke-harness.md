---
id: F-0053
title: Add live Forge web smoke harness
kind: task
status: open
priority: urgent
area: test
parent: F-0000
depends_on:
  - F-0052
  - F-0054
  - F-0055
claimed_by: ""
scope:
  - packages/cli/**
  - packages/web/**
  - packages/core/**
  - package.json
  - .forge/tasks/**
created_at: 2026-05-15T00:00:00-05:00
updated_at: 2026-05-15T00:00:00-05:00
closed_at: ""
close_reason: ""
---

# Add live Forge web smoke harness

## Why

The web task API crash in `F-0052` escaped because tests exercised web API helpers in-process, not the real `forge web` server and `/api/tasks` route used by humans.

## What success looks like

The internal `harness:web` check starts Forge web against isolated fixture repos and proves the API and page entrypoint load tasks successfully.

## Acceptance Criteria

- Start the real `forge web` command against an isolated fixture repo.
- Request `/api/tasks` and assert `200`, valid JSON, tasks, queue data, and `availabilityByTaskId`.
- Load the root page or app shell and assert it does not render `Failed to load tasks`.
- Include a regression fixture where graph analysis lacks optional availability data, matching the `F-0052` failure mode.
- Ensure the spawned server is always cleaned up.
- Include clear failure output for server startup, API response, and app render failures.
- Wire the smoke to the internal `bun run harness:web` script and include it in the normal internal harness path.

## Dependencies

Depends on `F-0052` because the compatibility fix should land before preserving the smoke as a permanent gate.

Depends on `F-0054` and `F-0055` because the smoke should use generic fixtures and a stable internal harness command rather than a one-off task-specific script.

## Verification

- Run `bun run harness:web`.
- Run `bun run quality:check`.

## Notes

This should exercise the same command path a human uses, not only `getTaskGraphPayload` as an imported helper.

This is an internal developer/agent harness, not a new public `forge` command.

## History

- Created 2026-05-15T00:00:00-05:00.
- Refined 2026-05-15T00:00:00-05:00 to depend on generic fixture and harness script tasks.
