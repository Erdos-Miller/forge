---
id: F-0124
title: "Fix header tab positioning under layout harness"
kind: task
status: open
priority: urgent
project: "forge"
area: "web"
parent: "F-0000"
depends_on:
  - "F-0123"
claimed_by: ""
scope:
  - "packages/web/**"
  - ".forge/tasks/**"
created_at: 2026-05-21T17:26:34-05:00
updated_at: 2026-05-21T17:26:34-05:00
closed_at: ""
close_reason: ""
blocked_reason: ""
review_reason: ""
---
# Fix header tab positioning under layout harness

## Why

The current header places Queue and Analytics in an unexpected far-right position in some workspace states. The fix should land only after the layout harness captures the regression.

## What success looks like

Queue and Analytics stay in the intended header position while Worktree and Project controls remain stable, responsive, and keyboard-accessible.

## Acceptance Criteria

- Fix the current Queue/Analytics tab drift using the failing layout contract from F-0123.
- Preserve Worktree before Project control order.
- Preserve stable control widths and long-label truncation.
- Preserve `[` and `]` Worktree cycling and `{` and `}` Project cycling behavior.
- Preserve usable narrow/mobile wrapping.
- Do not introduce screenshot-based verification.
- Verify with `harness:web:layout` and `harness:web`.

## Execution Plan

Summary: Make the header layout pass the browser-measured contract.

Scope: Header CSS, minimal markup adjustments if needed, and focused tests.

Approach:
- Start from the failing F-0123 layout contract.
- Adjust the header grid or flex structure so navigation placement is independent of selected control label length.
- Keep header controls clamped and text-overflow behavior intact.
- Avoid broad redesign of the queue or analytics views.

Verification:
- `bun run harness:web:layout`
- `bun run harness:web`

Stop conditions:
- Stop if native select rendering prevents reliable layout stability; plan a separate custom selector task before adding a brittle CSS workaround.

Human review triggers:
- Ask for review if the fix changes the visible header hierarchy beyond restoring the intended layout.

## Dependencies

Tracked in frontmatter: F-0123.

## Verification

- Run the layout harness.
- Run the full web harness.

## Notes

This is the first task in the sequence that should change the actual header layout.

## History

- Created 2026-05-21T17:26:34-05:00.
