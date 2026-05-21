---
id: F-0096
title: "Surface coordination state in web UI"
kind: task
status: done
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
updated_at: 2026-05-21T18:56:02.545Z
closed_at: 2026-05-21T18:56:02.545Z
close_reason: ""
blocked_reason: ""
review_reason: ""
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

Decision: Worktree classification now lives in a pure core source helper shared by CLI and web. Runtime-specific git status collection stays at the edge: the CLI uses Bun, and the Vite web middleware uses Node `execFile`.

- Added shared pure worktree classification under core source and reused it from CLI and web.
- Added `coordinationByTaskId` to web task graph payloads, including workspace aggregate mapping.
- Rendered selected-task worktree coordination warnings only for blocking/review files; non-blocking future task files stay hidden.
- Decision: Worktree classification is shared; git status collection remains runtime-specific at CLI/web edges.
- Verification: focused CLI/web coordination tests, `bun run harness:web`, `bun run quality:check`.

## History

- Created 2026-05-21T12:03:14-05:00.
