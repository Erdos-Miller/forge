---
id: F-0092
title: "Add worktree status classification command"
kind: task
status: open
priority: urgent
area: "cli"
parent: "F-0000"
depends_on:
  - "F-0091"
claimed_by: ""
scope:
  - "packages/cli/**"
  - "packages/core/**"
  - ".forge/**"
created_at: 2026-05-21T12:03:14-05:00
updated_at: 2026-05-21T12:03:14-05:00
---
# Add worktree status classification command

## Why

Agents need a fast command that explains whether dirty worktree changes matter to the task they are about to work on.

## What success looks like

`forge worktree-status --json` classifies dirty files as blocking, non-blocking, or review-worthy for a selected task.

## Acceptance Criteria

- Add `forge worktree-status --json [--task <id>]`.
- Read git porcelain status without mutating the worktree.
- Classify dirty files against the selected task file, dependency path, task `scope`, and known shared-file patterns.
- Infer the task only when exactly one active claimed task exists.
- Return a JSON payload with `ok`, `task`, `summary`, `files`, and `recommendation`.
- Return a review-style result when task inference is ambiguous.
- Keep the command fast enough to run before every agent loop step.

## Execution Plan

Summary: Build a read-only worktree classifier for agent coordination.

Scope: CLI command handling, any shared core helper needed for classification, and tests.

Approach:
- Add a small classifier that consumes parsed task metadata and git status output.
- Keep file classification deterministic and explainable in JSON.
- Treat unrelated future task files as `non_blocking`.
- Treat dirty files in the selected task scope as `blocking`.
- Treat selected task file and dependency-chain task edits as `review`.
- Register the command in command metadata and agent help.

Verification:
- Focused CLI tests for clean, blocking, non-blocking, review, and ambiguous inference cases.
- `bun run harness:cli`.

Stop conditions:
- Stop if the classifier needs to shell out in a way that is not portable across supported local environments.

Human review triggers:
- Ask for review before adding broad shared-file heuristics that could block too many tasks.

## Dependencies

Tracked in frontmatter: F-0091.

## Verification

- Run focused `worktree-status` command tests.
- Run `bun run harness:cli`.

## Notes

This command should be advisory and read-only. It should not replace `git status`.

## History

- Created 2026-05-21T12:03:14-05:00.
