---
id: F-0021
title: Add agent prompt command
kind: task
status: done
priority: high
parent: F-0000
depends_on:
  - F-0004
claimed_by: ""
area: cli
scope:
  - packages/cli/**
  - .forge/tasks/**
created_at: 2026-05-15T00:00:00-05:00
updated_at: 2026-05-15T00:00:00-05:00
closed_at: "2026-05-15T00:00:00-05:00"
close_reason: "Implemented forge prompt for reusable agent goal prompts."
---

# Add agent prompt command

## Why

Agents and humans should not have to rewrite the same goal-mode prompt every time they want Codex or another coding agent to work a Forge task.

## What success looks like

The CLI can emit a reusable prompt for either the next ranked ready task or a specific task id.

## Acceptance Criteria

- `forge prompt next` prints a multiline prompt for the top ranked ready task.
- `forge prompt <id>` prints a multiline prompt for the requested task.
- The prompt includes the task id, title, task file path, status, priority, area, dependencies, scope, task body, and Forge operating-loop guidance.
- `forge prompt next` exits nonzero with a clear message when no task is ready.
- Invalid usage exits nonzero with a usage message.
- Tests cover next, explicit id, invalid usage, and no-ready-task behavior.

## Dependencies

Depends on `F-0004` because it extends the minimal CLI.

## Verification

- `bun test` passed in `packages/cli`.
- `bun packages/cli/src/index.ts prompt next` printed a prompt for `F-0010`.

## Notes

Implemented `forge prompt <id|next>` as a read-only CLI command. It uses the current ranked ready task helper for `next` and prints one compact multiline prompt suitable for Codex goal mode.

## History

- Created 2026-05-15T00:00:00-05:00.
- Completed 2026-05-15T00:00:00-05:00.
