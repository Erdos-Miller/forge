---
id: F-0033
title: Add forge plan command
kind: task
status: done
priority: high
parent: F-0000
depends_on:
  - F-0032
claimed_by: ""
area: cli
scope:
  - packages/core/**
  - packages/cli/**
  - .forge/tasks/**
created_at: 2026-05-15T00:00:00-05:00
updated_at: 2026-05-15T15:38:36.321Z
closed_at: 2026-05-15T15:38:36.321Z
close_reason: "forge plan command implemented and verified"
blocked_reason: ""
review_reason: ""
---

# Add forge plan command

## Why

Agents need one command that writes the plan they just produced into the task file without manually editing Markdown or risking frontmatter damage.

## What success looks like

`forge plan <id|next> --stdin` inserts or replaces the task's `## Execution Plan` section while preserving the rest of the task file.

## Acceptance Criteria

- Add `forge plan <id> --stdin`.
- Add `forge plan next --stdin` using the same ready-task selection as `forge prompt next`.
- Insert `## Execution Plan` in the documented canonical position when the task has no plan.
- Replace the full existing `## Execution Plan` section when one already exists.
- Preserve frontmatter, other known sections, unknown sections, and surrounding Markdown.
- Exit nonzero with clear messages for unknown task ids, no ready task for `next`, missing `--stdin`, and empty stdin.
- Tests cover explicit id, next, insert, replace, missing stdin, empty stdin, unknown id, and no-ready-task behavior.

## Execution Plan

Summary: Add a narrow CLI write command for the canonical Execution Plan section.

Scope: packages/core write helper, packages/cli command wiring, and tests.

Approach:
- Add a core helper that inserts or replaces ## Execution Plan while preserving frontmatter and surrounding Markdown.
- Add forge plan <id|next> --stdin using the same next-task selection as forge prompt next.
- Cover explicit id, next, insert, replace, and error cases in tests.

Verification:
- bun test packages/core packages/cli
- bun run quality:check
- Temp-store smoke with forge plan F-9001 --stdin

Stop conditions:
- Stop if section replacement loses unknown Markdown or frontmatter.

Human review triggers:
- None.

## Dependencies

Depends on `F-0032` for the settled Markdown section convention.

## Verification

- Run `bun test packages/core packages/cli`.
- Run `bun run quality:check`.
- Smoke-check `forge plan <id> --stdin` in a temporary Forge task store.

## Notes

This command should be narrow and task-file focused. It does not need to wait for the broader lifecycle write commands in `F-0015`.

Implemented `forge plan <id|next> --stdin` with a core write helper for inserting or replacing the canonical `## Execution Plan` section. The command preserves frontmatter, surrounding known sections, unknown sections, and updates `updated_at`.

Verification passed:
- bun test packages/core/test/write.test.ts packages/cli
- bun test packages/core packages/cli
- bun run quality:check
- Temp-store smoke: `forge plan F-9001 --stdin` wrote `## Execution Plan` before `## Dependencies` in /private/tmp/forge-plan-smoke-TyNLix.

## History

- Created 2026-05-15T00:00:00-05:00.
