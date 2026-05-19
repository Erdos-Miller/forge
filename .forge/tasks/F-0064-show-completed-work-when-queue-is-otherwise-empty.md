---
id: F-0064
title: "Show completed work when queue is otherwise empty"
kind: task
status: done
priority: high
area: "web"
parent: ""
depends_on: []
claimed_by: ""
scope:
  - "packages/web/**"
  - ".forge/tasks/**"
created_at: 2026-05-19T21:15:13.164Z
updated_at: 2026-05-19T21:18:44.424Z
closed_at: 2026-05-19T21:18:16.905Z
close_reason: "All-done web queues now show completed work by default; tests, harness, live check, and quality pass."
blocked_reason: ""
review_reason: ""
---
# Show completed work when queue is otherwise empty

## Why

An all-done repo currently renders an empty queue by default, even though the task API has completed work to inspect.

## What success looks like

When a scope has only done or canceled tasks, the web queue shows those closed tasks instead of an empty board.

## Acceptance Criteria

- Normal scopes with unfinished tasks still hide done tasks until Show done is enabled.
- Scopes with no unfinished tasks automatically render closed tasks.
- The detail pane selects a visible closed task in the all-done case.
- Tests cover the all-done default.

## Execution Plan

Summary: Avoid an empty queue when the selected scope only contains closed tasks.

Scope: `packages/web/**` and this task file.

Approach:
- Add a small helper that decides when done tasks should be visible even if the checkbox state is off.
- Use that effective visibility in queue sorting and refresh selection.
- Keep the normal unfinished-work case unchanged.
- Add a web rendering test for an all-done payload.

Verification:
- `bun test packages/web/test/app.test.tsx`
- `bun run harness:web`
- Headless browser check against the running viewer.

Stop conditions:
- Stop if this requires changing task graph semantics or CLI output.

Human review triggers:
- Ask before removing the explicit Show done control.

## Dependencies

None.

## Verification

- TODO: Add verification commands or evidence.

## Notes

TODO: Add implementation context.

Implemented all-done queue visibility.

Decisions:
- The queue now computes an effective Show done state: if a scope has closed tasks and no unfinished tasks, closed tasks are visible even when the user has not enabled the checkbox.
- Normal scopes with ready, active, claimed, or blocked work still hide done tasks by default.
- Moved the visibility helper out of `App.tsx` to stay inside the readability budget.

Verification:
- `bun test packages/web/test/app.test.tsx`
- `bun run harness:web`
- Live check while F-0064 was active confirmed the page no longer showed the generic empty-board message and rendered the visible queue state.
- `bun run quality:check`

Post-close live check:
- After F-0064 was marked done, the running viewer rendered done task groups instead of `No tasks match this filter.`
- The Show done checkbox rendered checked and disabled because the selected scope has no unfinished tasks.

## History

- Created 2026-05-19T21:15:13.164Z.
