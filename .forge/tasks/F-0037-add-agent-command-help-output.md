---
id: F-0037
title: Add agent command help output
kind: task
status: done
priority: high
parent: F-0000
depends_on:
  - F-0036
claimed_by: ""
area: cli
scope:
  - packages/cli/**
  - .forge/tasks/**
created_at: 2026-05-15T00:00:00-05:00
updated_at: 2026-05-15T05:12:31.941Z
closed_at: 2026-05-15T05:12:31.941Z
close_reason: "Agent command help verified"
blocked_reason: ""
review_reason: ""
---

# Add agent command help output

## Why

Agents need a compact, current command reference they can request from Forge instead of relying on stale prose in prompts or docs.

## What success looks like

Forge exposes command metadata through both machine-readable JSON and concise agent-oriented help text.

## Acceptance Criteria

- Add `forge commands --json`.
- Add `forge help --agent`.
- `commands --json` emits versioned command metadata from the registry.
- `help --agent` groups commands by workflow: inspect, claim, plan, mutate, verify, and close.
- Both outputs include read/write classification.
- Usage errors for these commands follow existing CLI conventions.
- Tests cover JSON shape, stable ordering, workflow grouping, and read/write classification.

## Dependencies

Depends on `F-0036` because both outputs should be generated from the command registry.

## Verification

- Run `bun test packages/cli`.
- Run `bun run quality:check`.
- Smoke-check `forge commands --json` and `forge help --agent`.

## Notes

Keep the human output concise. The purpose is agent loop guidance, not full manual pages.

Implemented from the command registry plus a workflow map so both robot JSON and agent help stay in registry order.

Commands added:
- `forge commands --json`
- `forge help --agent`

Workflow groups are inspect, claim, plan, mutate, verify, and close. Both outputs include command classification.

Verification:
- `bun test packages/cli`
- `bun run quality:check`
- `forge commands --json`
- `forge help --agent`

## History

- Created 2026-05-15T00:00:00-05:00.
- Added agent command metadata and concise workflow help output.
