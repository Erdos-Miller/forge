---
id: F-0046
title: Fix web priority ordering
kind: task
status: done
priority: urgent
parent: F-0000
depends_on:
  - F-0005
claimed_by: ""
area: web
scope:
  - packages/web/**
  - .forge/tasks/**
created_at: 2026-05-15T00:00:00-05:00
updated_at: 2026-05-15T04:34:14.924Z
closed_at: 2026-05-15T04:34:14.924Z
close_reason: ""
---

# Fix web priority ordering

## Why

The web UI must make priority semantics obvious. `urgent` should consistently appear above `high` anywhere the UI groups or orders by priority.

## What success looks like

Priority ordering in the queue UI follows `urgent`, `high`, `medium`, `low` consistently, including priority grouping.

## Acceptance Criteria

- Define one explicit priority order for the web UI: urgent, high, medium, low.
- When grouping by priority, render priority groups in that fixed order instead of insertion order.
- Within each priority group, preserve the existing queue ordering rules for the tasks in that group.
- When not grouping by priority, keep ready/recommended tasks first but ensure non-recommended tasks use the explicit priority order.
- Add web tests showing urgent appears before high in priority grouping.
- Add web tests showing non-recommended urgent tasks sort before non-recommended high tasks.

## Dependencies

Depends on `F-0005` because this fixes the existing web board behavior.

## Verification

- `bun test packages/web` passed.
- `bun run quality:check` passed from the repo root.
- Added focused render-level tests for priority grouping and non-recommended priority ordering using urgent and high tasks.

## Notes

Extracted queue sorting and grouping helpers so priority semantics are tested directly. Priority groups now render in the explicit urgent, high, medium, low order while preserving the existing task order inside each group.

## History

- Created 2026-05-15T00:00:00-05:00.
- Claimed and implemented 2026-05-15.
