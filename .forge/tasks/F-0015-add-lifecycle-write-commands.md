---
id: F-0015
title: Add lifecycle write commands
kind: task
status: open
priority: high
parent: F-0000
depends_on:
  - F-0014
claimed_by: ""
area: cli
scope:
  - .forge/**
  - packages/cli/**
  - packages/core/**
created_at: 2026-05-15T00:00:00-05:00
updated_at: 2026-05-15T00:00:00-05:00
closed_at: ""
close_reason: ""
---

# Add lifecycle write commands

## Why

Agents should not hand-edit task files for normal lifecycle updates. Blocking, unblocking, adding notes, requesting review, and closing work should be safe CLI operations.

## What success looks like

Forge supports the common agent lifecycle with commands that preserve Markdown and update structured fields consistently.

## Acceptance Criteria

- Add minimal schema support for `blocked_reason` and `review_reason`.
- `forge note <id> --stdin` appends text to the task Notes section.
- `forge block <id> --reason <text>` sets `status: blocked`, records `blocked_reason`, and updates `updated_at`.
- `forge unblock <id>` clears `blocked_reason`, sets `status: open`, and updates `updated_at`.
- `forge review <id> --reason <text>` records `review_reason` without changing the status enum.
- `forge done <id> --reason <text> --json` records `status: done`, clears claim/block/review fields, sets `closed_at`, records `close_reason`, and returns JSON when requested.
- Tests cover each write path and body preservation.

## Dependencies

Depends on `F-0014` so lifecycle commands share task bundle and JSON behavior with robot-mode selection.

## Verification

- Run `bun test` in `packages/core` and `packages/cli`.
- Inspect generated task files to verify frontmatter and Markdown body preservation.

## Notes

Keep schema additions minimal. Do not introduce a richer review workflow until dogfooding proves the need.

## History

- Created 2026-05-15T00:00:00-05:00.
