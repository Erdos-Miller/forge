---
id: F-0110
title: "Add Worktree and Project cycling hotkeys"
kind: task
status: done
priority: medium
area: "web"
parent: "F-0000"
depends_on:
  - "F-0115"
claimed_by: ""
scope:
  - "packages/web/**"
  - ".forge/**"
created_at: 2026-05-21T14:57:56-05:00
updated_at: 2026-05-21T21:51:47.913Z
closed_at: 2026-05-21T21:51:47.913Z
close_reason: "Added Worktree and Project cycling shortcuts and verified web harness."
blocked_reason: ""
review_reason: ""
---
# Add Worktree and Project cycling hotkeys

## Why

Workspace mode needs fast keyboard navigation across Worktrees and Projects without forcing users to tab into header selects.

## What success looks like

Users can cycle Worktrees with bracket keys and first-class task Projects with shifted bracket keys, with discoverable help and no interference while typing.

## Acceptance Criteria

- `[` selects the previous Worktree when multiple Worktrees are available.
- `]` selects the next Worktree when multiple Worktrees are available.
- `{` selects the previous Project when multiple Projects are available.
- `}` selects the next Project when multiple Projects are available.
- Shortcuts are ignored while focus is inside inputs, selects, textareas, buttons, links, or contenteditable elements.
- `?` opens a compact shortcuts help overlay or equivalent discoverable reference.
- The help text documents bracket Worktree cycling and shifted-bracket Project cycling.
- Project cycling uses the same Project list as the task `project`-backed web filter.
- Tests cover cycling, wrapping behavior, unavailable controls, and focus safety.

## Execution Plan

Summary: Add browser-safe workspace navigation shortcuts that follow the Worktree > Project hierarchy.

Scope: Web keyboard handling, selected Worktree/Project state transitions, help UI, and tests.

Approach:
- Reuse the existing queue shortcut focus-safety helper where possible.
- Add a shortcut handler for `[`, `]`, `{`, `}`, and `?`.
- Wrap around at the beginning and end of each list.
- Preserve current task selection behavior by reusing the task `project`-backed Worktree and Project selection paths.
- Keep queue arrow navigation unchanged.

Verification:
- Focused web keyboard shortcut tests.
- `bun run harness:web`.

Stop conditions:
- Stop if Project filtering is still based primarily on edit-scope path overlap rather than task `project`.

Human review triggers:
- Ask for review if the shortcuts conflict with browser, OS, or app-level expected behavior during manual testing.

## Dependencies

Tracked in frontmatter: F-0115.

## Verification

- Run focused web shortcut tests.
- Run `bun run harness:web`.

## Notes

Use bracket keys because they are browser-safe, compact, and align with previous/next navigation.

Updated 2026-05-21: This should land after Project filtering is backed by explicit task `project`, not the older path-overlap model.

Added Worktree and Project keyboard shortcuts:

- `[` and `]` cycle Worktrees with wraparound when multiple Worktrees are available.
- `{` and `}` cycle Projects with wraparound using the same Project options as the web filter.
- `?` opens a compact keyboard shortcut reference, also available from the footer Shortcuts button.
- Shortcuts ignore form controls, links, buttons, and contenteditable targets.
- Moved shortcut helpers into `packages/web/src/shortcuts.tsx` to keep `App.tsx` under the readability budget.

Verification:

- `bun test packages/web/test/app.test.tsx packages/core/test/readability-ratchet.test.ts`
- `bun run harness:web`
- `bun run build` from `packages/web`
- `forge doctor --json` reports only expected dirty-worktree warnings for F-0110 before commit.

## History

- Created 2026-05-21T14:57:56-05:00.
