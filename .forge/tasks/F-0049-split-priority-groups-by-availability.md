---
id: F-0049
title: Split priority groups by availability
kind: task
status: done
priority: urgent
parent: F-0000
depends_on:
  - F-0048
claimed_by: ""
area: web
scope:
  - packages/web/**
  - .forge/tasks/**
created_at: 2026-05-15T00:00:00-05:00
updated_at: 2026-05-15T15:10:21.727Z
closed_at: 2026-05-15T15:10:21.727Z
close_reason: "Priority groups split by availability and verified"
blocked_reason: ""
review_reason: ""
---

# Split priority groups by availability

## Why

Priority grouping should show all urgent work without making unavailable urgent tasks look like the next actionable items.

## What success looks like

Within each priority group, the web queue separates ready, in-progress, claimed, blocked, and optionally done work.

## Acceptance Criteria

- Render priority groups in fixed order: urgent, high, medium, low.
- Inside each priority group, separate rows into `Ready`, `In progress`, `Claimed`, `Blocked`, and `Done` when done tasks are shown.
- Keep ready rows first within each priority group.
- Hide or de-emphasize rank on non-ready rows so full-list position is not mistaken for priority rank.
- Preserve existing task ordering within each availability subsection.
- Tests cover an urgent group with one ready task, one active task, one claimed task, and one blocked task.

## Dependencies

Depends on `F-0048` because the subsection layout should build on availability-aware row badges.

## Verification

- Run `bun test packages/web`.
- Run `bun run quality:check`.
- Manually inspect the queue grouped by priority with mixed availability states.

## Notes

This is a follow-up clarity improvement. The misleading badge fix in `F-0048` should land first.

Keep this immediately after `F-0048` so the web queue explains urgent unavailable work clearly.

Implementation decision: priority and area queue groups now render availability subsections in a fixed order: Ready, In progress, Claimed, Blocked, Done. Ready rows keep the actionable queue rank; non-ready rows render a muted placeholder so their full-list position is not mistaken for the next execution rank.

Added web tests for a mixed urgent priority group containing ready, active, claimed, blocked, and done tasks. Added a static render assertion that non-ready rows do not show an actionable rank.

Verification:
- bun test packages/web passed with 15 tests.
- bun run quality:check passed with 133 tests and the web production build.
- Interactive visual inspection was not run because no browser inspection tool is available in this session; the mixed priority grouping and rank behavior are covered by static render tests.

## History

- Created 2026-05-15T00:00:00-05:00.
- Reprioritized to urgent to complete the queue clarity pass after `F-0048`.
