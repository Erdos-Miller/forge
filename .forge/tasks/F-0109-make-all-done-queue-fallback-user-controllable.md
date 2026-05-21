---
id: F-0109
title: "Make all-done queue fallback user-controllable"
kind: task
status: open
priority: high
area: "web"
parent: "F-0000"
depends_on: []
claimed_by: ""
scope:
  - "packages/web/**"
  - ".forge/**"
created_at: 2026-05-21T14:50:37-05:00
updated_at: 2026-05-21T14:50:37-05:00
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

## History

- Created 2026-05-21T14:50:37-05:00.
