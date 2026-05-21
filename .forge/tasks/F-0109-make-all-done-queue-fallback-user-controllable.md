---
id: F-0109
title: "Make all-done queue fallback user-controllable"
kind: task
status: done
priority: high
area: "web"
parent: "F-0000"
depends_on: []
claimed_by: ""
scope:
  - "packages/web/**"
  - ".forge/**"
created_at: 2026-05-21T14:50:37-05:00
updated_at: 2026-05-21T20:38:12.827Z
closed_at: 2026-05-21T20:38:12.827Z
close_reason: "Made Show done user-controllable and added the all-done empty state."
blocked_reason: ""
review_reason: ""
---
# Make all-done queue fallback user-controllable

## Why

The all-done queue fallback currently forces and disables the Show done checkbox, so users cannot hide completed tasks even when they want an unfinished-work view.

## What success looks like

All-done queues remain understandable, but Show done is always a user-controllable setting.

## Acceptance Criteria

- Stop disabling the Show done checkbox when all matching tasks are closed.
- Keep `showDone` as the user's actual setting.
- If Show done is off and no unfinished tasks match, show `No unfinished tasks match this filter.`
- Clear or avoid the done-task detail pane when no queue row is visible.
- Re-checking Show done restores completed rows.
- Tests cover all-done default, manual hide-done, empty queue messaging, detail clearing, and re-checking Show done.

## Execution Plan

Summary: Separate user Show done state from the all-done display fallback.

Scope: Web queue visibility, selection behavior, empty state copy, and tests.

Approach:
- Keep the checkbox controlled only by `showDone`.
- Remove disabled fallback behavior.
- Use an explicit empty state when unfinished tasks are absent and done is hidden.
- Ensure selection only follows visible queue rows.
- Update tests around F-0064 behavior to reflect the user-controllable model.

Verification:
- Focused web queue visibility tests.
- `bun run harness:web`.

Stop conditions:
- Stop if this requires changing task graph API semantics.

Human review triggers:
- Ask for review if the default all-done behavior should show done rows automatically or start with the empty unfinished-work state.

## Dependencies

None.

## Verification

- Run focused web queue visibility tests.
- Run `bun run harness:web`.

## Notes

This task is independent and should be prioritized before the larger Project migration.

Implemented user-controllable Show done behavior.

Changes:
- Removed the all-done fallback that coerced `showDone=false` into showing closed tasks.
- The Show done checkbox now reflects only the user's `showDone` state and is never disabled by the all-done fallback.
- When Show done is off and matching tasks are all closed, the queue shows `No unfinished tasks match this filter.`
- With no visible queue rows, the detail pane clears instead of showing a hidden done task.
- Re-checking Show done restores completed rows through the existing queue sorting and refresh selection path.

Decisions:
- Default behavior remains Show done off. All-done filters start with the unfinished-work empty state until the user checks Show done.
- Stop condition did not fire: no task graph API semantics changed.
- Human review trigger did not fire: the task acceptance criteria specified the Show done off empty state.

Verification:
- `bun test packages/web/test/app.test.tsx` passed: 35 tests.
- `bun test packages/web/test/scopes.test.ts packages/web/test/monorepo-projects.test.tsx` passed: 9 tests.
- `bun run harness:web` passed: 72 tests.

## History

- Created 2026-05-21T14:50:37-05:00.
