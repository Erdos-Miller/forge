---
id: F-0042
title: Add closeout guidance command
kind: task
status: done
priority: medium
parent: F-0000
depends_on:
  - F-0016
  - F-0037
  - F-0041
claimed_by: ""
area: cli
scope:
  - packages/core/**
  - packages/cli/**
  - .forge/tasks/**
created_at: 2026-05-15T00:00:00-05:00
updated_at: 2026-05-15T16:27:22.007Z
closed_at: 2026-05-15T16:27:22.007Z
close_reason: "Verified closeout tests, quality check, and temp-store closeout smoke."
blocked_reason: ""
review_reason: ""
---

# Add closeout guidance command

## Why

Before an agent marks a task done, Forge should provide a concise checklist of missing evidence or review concerns without making the workflow brittle.

## What success looks like

Forge exposes an advisory closeout guidance path that tells an agent what remains before closing a task.

## Acceptance Criteria

- Add a read-only closeout guidance command or doctor sub-report for a specific task.
- Output whether an execution plan is present.
- Output whether verification notes are present.
- Output the expected quality command when available.
- Output blockers, review notes, or stop-condition text when present in the task body.
- Return JSON suitable for agents.
- Keep findings advisory; do not block `forge done`.
- Tests cover ready-to-close, missing plan, missing verification, and review-needed cases.

## Execution Plan

1. Add `forge closeout <id> --json` as a read-only advisory command in the close workflow.
2. Report execution plan presence, verification evidence in Notes, expected quality command from root package scripts, blockers, review context, stop conditions, and advisory findings.
3. Keep the command advisory only; it does not change `forge done` behavior.
4. Add focused CLI tests for ready-to-close, missing plan, missing verification, and review-needed cases.
5. Verify with package tests, quality check, and closeout smoke on task fixtures.

## Dependencies

Depends on `F-0016` for doctor diagnostics, `F-0037` for command guidance shape, and `F-0041` for the review/check-in convention.

## Verification

- Run `bun test packages/core packages/cli`.
- Run `bun run quality:check`.
- Smoke-check closeout guidance on tasks with and without verification notes.

## Notes

Pick the exact command name during implementation only if doctor's final shape makes a sub-report clearly better. Otherwise use a small explicit command.

Implemented `forge closeout <id> --json` as a read-only advisory closeout check. It reports execution plan presence, verification notes, expected quality command from root package scripts, blockers, review context, stop conditions, and warning findings without changing `forge done` behavior.

Verification:
- `bun test packages/cli/test/closeout.test.ts`
- `bun test packages/core packages/cli`
- `bun run quality:check`
- Temp-store smoke at `/private/tmp/forge-closeout-smoke-XYGDWD` returned ready-to-close output for `F-0001` and missing plan/verification findings for `F-0002`.

## History

- Created 2026-05-15T00:00:00-05:00.
