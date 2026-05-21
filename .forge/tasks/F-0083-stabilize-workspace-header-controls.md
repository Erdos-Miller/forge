---
id: F-0083
title: "Stabilize workspace header controls"
kind: task
status: done
priority: high
area: "web"
parent: "F-0000"
depends_on:
  - "F-0080"
claimed_by: ""
scope:
  - "packages/web/**"
  - ".forge/**"
created_at: 2026-05-21T11:54:53-05:00
updated_at: 2026-05-21T18:27:11.895Z
closed_at: 2026-05-21T18:27:11.895Z
close_reason: "Stabilized header control order, widths, and truncation with focused web tests, web harness, and Chrome desktop/mobile smoke passing."
blocked_reason: ""
review_reason: ""
---
# Stabilize workspace header controls

## Why

The header controls resize and shift when selected worktree or scope labels have different lengths.

## What success looks like

Worktree and Scope selectors keep stable dimensions, truncate long labels cleanly, and do not move the Queue and Analytics navigation.

## Acceptance Criteria

- Order header controls as Worktree first, then Scope.
- Give selectors stable responsive widths.
- Truncate long selected labels without expanding the header.
- Keep Queue and Analytics navigation visually pinned.
- Preserve usable mobile layout.
- Tests or visual smoke cover short and long worktree/scope labels.

## Execution Plan

Summary: Make the workspace header predictable regardless of selected label length.

Scope: Web header markup, CSS, and focused render or browser tests.

Approach:
- Rename or reorder header controls according to the terminology decision.
- Apply fixed or clamped widths with text truncation.
- Ensure nav placement is independent of selector content width.
- Add long-label fixture coverage.
- Verify desktop and narrow viewport layout.

Verification:
- `bun run harness:web`
- Browser or screenshot smoke for long labels.

Stop conditions:
- Stop if native select styling cannot provide acceptable truncation; plan a custom selector before forcing a fragile CSS workaround.

Human review triggers:
- Ask for visual review if the header layout changes materially.

## Dependencies

Tracked in frontmatter: F-0080.

## Verification

- Run focused web render tests.
- Run `bun run harness:web`.

## Notes

This task should not change scope matching behavior.

Stabilized the web header by separating brand, controls, and view nav. Worktree now appears before Scope, selectors use clamped widths with truncation, and the Queue / Analytics nav is pinned independently of control label length.

Visual smoke:
- Desktop Chrome screenshot at 1440x900 rendered Worktree, Scope, and pinned Queue / Analytics nav without shifting.
- Mobile Chrome screenshot at 390x844 rendered Worktree and Scope as stacked full-width controls with nav below them.

Verification:
- `bun test packages/web/test/app.test.tsx` passed: 28 tests, 111 expects.
- `bun run harness:web` passed: 53 tests, 208 expects.

## History

- Created 2026-05-21T11:54:53-05:00.
