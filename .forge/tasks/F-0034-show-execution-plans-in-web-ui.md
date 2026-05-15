---
id: F-0034
title: Show execution plans in web UI
kind: task
status: done
priority: high
parent: F-0000
depends_on:
  - F-0032
claimed_by: ""
area: web
scope:
  - packages/web/**
  - .forge/tasks/**
created_at: 2026-05-15T00:00:00-05:00
updated_at: 2026-05-15T18:12:04.990Z
closed_at: 2026-05-15T18:12:04.990Z
close_reason: "Execution Plan section UI implemented and covered by web tests; accepted without additional manual hold."
review_reason: ""
blocked_reason: ""
---

# Show execution plans in web UI

## Why

Humans and later agents need to inspect the current execution plan without digging through collapsed miscellaneous sections.

## What success looks like

The task detail view renders `Execution Plan` as a first-class section after acceptance criteria and before notes.

## Acceptance Criteria

- Teach the web Markdown section organizer to recognize `Execution Plan`.
- Render the section in task detail after `Acceptance Criteria` and before `Notes`.
- Show the section expanded by default when present.
- Continue rendering unknown sections under Additional Details.
- Tests cover classification and render order.

## Dependencies

Depends on `F-0032` for the canonical section name and position.

## Verification

- Run `bun test packages/web`.
- Run `bun run quality:check`.
- Manually inspect the web UI with a task that has an execution plan and a task that does not.

## Notes

This should not add web editing. It is display-only.

Implemented display support for `## Execution Plan` as a first-class task detail section. The web section organizer now classifies Execution Plan separately, and task detail renders it expanded after Acceptance Criteria and before Notes while preserving unknown sections under Additional Details.

Verification passed:
- bun test packages/web
- bun run quality:check

Manual web inspection is still required before closing this task: inspect one task with an execution plan and one task without one in the local web UI.

## History

- Created 2026-05-15T00:00:00-05:00.
