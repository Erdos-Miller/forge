---
id: F-0094
title: "Add coordination checks to closeout and doctor"
kind: task
status: open
priority: high
area: "cli"
parent: "F-0000"
depends_on:
  - "F-0092"
claimed_by: ""
scope:
  - "packages/cli/**"
  - "packages/core/**"
  - ".forge/**"
created_at: 2026-05-21T12:03:14-05:00
updated_at: 2026-05-21T12:03:14-05:00
---
# Add coordination checks to closeout and doctor

## Why

Workers need coordination warnings at closeout and during diagnostics, not only when they manually run the status command.

## What success looks like

`forge doctor --json` and `forge closeout --json` surface advisory diagnostics for dirty-worktree conflicts that affect claimed work.

## Acceptance Criteria

- Add doctor diagnostics for active claimed tasks with review-worthy or blocking dirty state.
- Add closeout diagnostics for the task being closed when dirty state conflicts with the task or its dependency path.
- Keep unrelated planner-created task files out of warning output.
- Include machine-readable diagnostic codes in JSON output.
- Keep checks advisory and non-mutating.
- Add focused tests for blocking, review, and non-blocking dirty states.

## Execution Plan

Summary: Reuse the worktree classifier in existing diagnostic surfaces.

Scope: Doctor output, closeout output, shared classifier wiring, and tests.

Approach:
- Reuse the F-0092 classification result instead of duplicating logic.
- Make doctor operate across active claimed tasks when possible.
- Make closeout operate against the task being closed or briefed.
- Preserve existing doctor and closeout contracts.
- Add concise human-readable messages backed by JSON codes.

Verification:
- Focused doctor and closeout tests.
- `bun run harness:cli`.

Stop conditions:
- Stop if doctor cannot determine claimed task context without becoming slow or noisy.

Human review triggers:
- Ask for review if diagnostics should fail the command instead of remaining advisory.

## Dependencies

Tracked in frontmatter: F-0092.

## Verification

- Run focused doctor and closeout tests.
- Run `bun run harness:cli`.

## Notes

This task should not make unrelated planner work a doctor failure.

## History

- Created 2026-05-21T12:03:14-05:00.
