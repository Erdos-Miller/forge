---
id: F-0096
title: "Surface coordination state in web UI"
kind: task
status: open
priority: medium
area: "web"
parent: "F-0000"
depends_on:
  - "F-0094"
claimed_by: ""
scope:
  - "packages/web/**"
  - "packages/cli/**"
  - "packages/core/**"
  - ".forge/**"
created_at: 2026-05-21T12:03:14-05:00
updated_at: 2026-05-21T12:03:14-05:00
---
# Surface coordination state in web UI

## Why

When Forge is running as a workspace dashboard, users should be able to see whether a selected task is blocked by relevant dirty worktree state.

## What success looks like

The web UI surfaces blocking or review-worthy coordination state for selected work without warning about unrelated planner-created task files.

## Acceptance Criteria

- Show coordination warnings for selected tasks with blocking or review dirty state.
- Do not show warnings for unrelated planner-created task files.
- Reuse the same classification semantics as the CLI.
- Keep the queue usable while warnings are present.
- Include tests for visible warning and suppressed non-blocking state.
- Avoid adding a new persistent web-only coordination model.

## Execution Plan

Summary: Display CLI coordination state in the web experience after the diagnostic contract exists.

Scope: Web task detail or status area, supporting API payload if needed, shared classification plumbing, and tests.

Approach:
- Reuse F-0094 diagnostic output or the same shared classifier.
- Keep the warning concise and task-specific.
- Show the file count and recommendation without listing every dirty path by default.
- Preserve current queue filtering and selection behavior.
- Add focused web tests for warning rendering.

Verification:
- Focused web tests.
- `bun run harness:web`.
- `bun run quality:check` if shared payloads change.

Stop conditions:
- Stop if exposing git dirty state would require the web server to watch paths outside the selected Forge root.

Human review triggers:
- Ask for review if warning placement competes with queue navigation or task detail readability.

## Dependencies

Tracked in frontmatter: F-0094.

## Verification

- Run focused web tests.
- Run `bun run harness:web`.

## Notes

This is useful but should wait until the CLI classification behavior is stable.

## History

- Created 2026-05-21T12:03:14-05:00.
