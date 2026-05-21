---
id: F-0082
title: "Make workspace initial load fast"
kind: task
status: doing
priority: urgent
area: "web"
parent: "F-0000"
depends_on:
  - "F-0081"
claimed_by: "codex"
scope:
  - "packages/web/**"
  - "packages/core/**"
  - "packages/cli/**"
  - ".forge/**"
created_at: 2026-05-21T11:54:53-05:00
updated_at: 2026-05-21T17:28:01.554Z
review_reason: "Needs human decision before changing visible loading/default workspace flow for lazy all-repos loading."
---
# Make workspace initial load fast

## Why

The workspace dashboard should render quickly instead of waiting for every discovered root and aggregate graph to fully load.

## What success looks like

`forge web` can show the app shell and initial selected worktree promptly, while heavier all-worktree data loads lazily or from cache.

## Acceptance Criteria

- Avoid blocking first render on every root's full task graph.
- Cache root discovery in the dev server during a session.
- Load root index plus selected or default root before all-worktree aggregate data.
- Defer all-repos aggregate work until needed.
- Preserve correctness when roots or tasks change after initial load.
- Performance harness demonstrates improved first usable render on fixture workspaces.

## Execution Plan

Summary: Optimize workspace loading after F-0081 identifies the slow phases.

Scope: Web API payload strategy, client loading state, server-side discovery cache, and workspace fixture tests.

Approach:
- Use F-0081 timings to identify the largest first-load bottleneck.
- Split root index loading from full graph loading where needed.
- Cache discovery results and invalidate them from watcher events.
- Keep single-root behavior visually simple and compatible.
- Add fixture performance tests with bounded expectations and no real workspace dependency.

Verification:
- `bun run harness:web`
- Fixture performance smoke comparing first payload or first usable render behavior.

Stop conditions:
- Stop if lazy loading would make task selection or terminal links incorrect; document the tradeoff before proceeding.

Human review triggers:
- Ask for review before changing the visible loading flow or adding persistent cache files.

## Dependencies

Tracked in frontmatter: F-0081.

## Verification

- Run workspace load performance tests.
- Run `bun run harness:web`.

## Notes

The target is perceived speed and responsiveness, not just faster total load of all workspace data.

Review needed: F-0082 changes the visible loading/default workspace behavior if implemented fully. The likely implementation is to return a cached root index plus only the selected/default root graph first, then load all-repos aggregate data lazily when the user chooses All repos. That means the initial multi-root view would no longer default to the all-repos queue. Need human decision on whether that product behavior is acceptable before implementation.

Decision context from F-0081:
- Real `/Users/ken/Work/repo_worktrees` timing showed downward root discovery around 6.4s.
- Per-root task loading and graph construction were milliseconds, so the first optimization should reuse cached/seeded discovery and avoid blocking on all-root work.

## History

- Created 2026-05-21T11:54:53-05:00.
