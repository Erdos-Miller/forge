---
id: F-0050
title: Hide closed tasks from default list
kind: task
status: done
priority: urgent
parent: F-0000
depends_on:
  - F-0036
claimed_by: ""
area: cli
scope:
  - packages/cli/**
  - .forge/tasks/**
created_at: 2026-05-15T00:00:00-05:00
updated_at: 2026-05-15T15:13:48.997Z
closed_at: 2026-05-15T15:13:48.997Z
close_reason: "Closed tasks hidden from default list and verified"
blocked_reason: ""
review_reason: ""
---

# Hide closed tasks from default list

## Why

`forge list` should be useful for current work at a glance. Showing done and canceled tasks by default makes the command noisy as the repo task history grows.

## What success looks like

`forge list` shows active task records by default, while closed tasks remain available behind an explicit flag.

## Acceptance Criteria

- Change `forge list` to exclude `done` and `canceled` tasks by default.
- Add `forge list --all` to include every task, including closed tasks.
- Add `forge list --closed` to show only `done` and `canceled` tasks.
- Reject incompatible flags such as `--all --closed`.
- Update command metadata, usage output, examples, and agent help to document the flags.
- Preserve the existing tabular output format.
- Keep `forge ready` unchanged.
- Tests cover default active-only output, `--all`, `--closed`, invalid flag combinations, and unexpected arguments.

## Dependencies

Depends on `F-0036` because command usage and examples should come from the command metadata registry.

## Verification

- Run `bun test packages/cli`.
- Run `bun run quality:check`.
- Smoke-check `forge list`, `forge list --all`, and `forge list --closed` in the Forge repo.

## Notes

Active means any task whose status is not `done` or `canceled`. This task should not change robot JSON queue behavior or the web app's Show done toggle.

Prioritize this after the queue clarity pass because default CLI output should focus on current work.

Implementation decision: forge list now defaults to active tasks only. Added --all for every task and --closed for done/canceled tasks, with --all --closed and other unexpected arguments rejected by the same usage path.

Updated command metadata, generated usage, examples, and agent help through the command registry. The tab-separated task line format is unchanged, and forge ready still uses the existing ready-task path.

Verification:
- bun test packages/cli passed with 61 tests.
- Smoke checks in this repo: forge list showed F-0050 but hid closed F-0049/F-0054/F-0055; forge list --all and forge list --closed showed the closed tasks; forge list --all --closed returned usage with exit 1.
- bun run quality:check passed with 136 tests and the web production build.

## History

- Created 2026-05-15T00:00:00-05:00.
- Reprioritized to urgent to reduce CLI list noise during dogfooding.
