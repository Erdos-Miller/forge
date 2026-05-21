---
id: F-0110
title: "Add Worktree and Project cycling hotkeys"
kind: task
status: open
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
updated_at: 2026-05-21T15:37:53-05:00
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

## History

- Created 2026-05-21T14:57:56-05:00.
