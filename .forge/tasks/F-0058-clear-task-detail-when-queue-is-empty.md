---
id: F-0058
title: Clear task detail when queue is empty
kind: task
status: done
priority: urgent
parent: F-0000
depends_on:
  - F-0049
claimed_by: ""
area: web
scope:
  - packages/web/**
  - .forge/tasks/**
created_at: 2026-05-15T00:00:00-05:00
updated_at: 2026-05-15T19:51:26.861Z
closed_at: 2026-05-15T19:51:26.861Z
close_reason: "Empty visible queue now clears task detail; web harness, quality gate, and done-only browser smoke pass."
blocked_reason: ""
review_reason: ""
---

# Clear task detail when queue is empty

## Why

When the queue has no visible rows, the web UI still shows a detail card for a hidden task, often a completed task. This makes "No tasks match this filter" look untrue.

## What success looks like

If the current queue/filter settings produce no visible queue tasks, the detail pane shows an empty state instead of stale task details.

## Acceptance Criteria

- Stop falling back from an empty visible queue to the first scoped task.
- If the selected task is not visible under the current filter and no visible queue task exists, clear the selected task detail.
- Show a clear empty-state message in the detail pane when no queue row is visible.
- Do not render blockers, task status, or task body for hidden done/canceled tasks when Show done is off.
- Preserve existing behavior when at least one queue task is visible: keep the selected visible task or fall back to the first visible queue task.
- Update refresh selection logic so live refresh does not reselect a hidden task after the queue becomes empty.
- Tests cover empty queue with hidden done tasks, scope filters with no matches, and normal fallback when visible tasks exist.

## Execution Plan

1. Inspect the current queue filtering, selected task derivation, and refresh fallback logic in `packages/web/src/App.tsx`.
2. Update selection fallback so an empty visible queue clears selection instead of falling back to a hidden scoped task.
3. Render an explicit detail-pane empty state when no visible queue row is selected, without rendering hidden done/canceled task metadata or body.
4. Add web component tests for hidden done tasks with Show done off, scope filters with no visible matches, live refresh into an empty queue, and normal fallback when visible tasks remain.
5. Verify with `bun run harness:web` and `bun run quality:check`, then close and commit the task with verification notes.

## Dependencies

Depends on `F-0049` because the fix should use the final visible queue grouping and availability behavior.

## Verification

- Run `bun test packages/web`.
- Run `bun run quality:check`.
- Manually inspect the web UI with Show done off and no active tasks.

## Notes

The empty left queue and right detail pane should agree. If there are no visible rows, the detail pane should not show a task.

Implemented empty-queue detail clearing.

Decisions:
- Detail selection now falls back only to visible queue rows, not the first scoped task.
- `selectTaskAfterRefresh` now considers the same visible queue set, including Show done, so live refresh cannot reselect a hidden done/canceled task when the queue becomes empty.
- The detail pane now renders `No queue row is visible for this filter.` when no queue row is visible.
- Hidden done/canceled task metadata and body are not rendered when Show done is off and the visible queue is empty.

Verification:
- `bun test packages/web/test/app.test.tsx`
- `bun run harness:web`
- `bun run quality:check`
- Manual smoke via local `forge web` against done-only fixture at `http://127.0.0.1:5188/`; headless Chrome rendered `No tasks match this filter.` and `No queue row is visible for this filter.` with no hidden task body.

## History

- Created 2026-05-15T00:00:00-05:00.
