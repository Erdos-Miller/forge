---
id: F-0082
title: "Make workspace initial load fast"
kind: task
status: done
priority: urgent
area: "web"
parent: "F-0000"
depends_on:
  - "F-0081"
claimed_by: ""
scope:
  - "packages/web/**"
  - "packages/core/**"
  - "packages/cli/**"
  - ".forge/**"
created_at: 2026-05-21T11:54:53-05:00
updated_at: 2026-05-21T17:47:22.967Z
closed_at: 2026-05-21T17:47:22.967Z
close_reason: "Workspace API uses session-cached roots and invalidates on root-structure changes while preserving all-repos loading."
blocked_reason: ""
review_reason: ""
---
# Make workspace initial load fast

## Why

The workspace dashboard should render quickly instead of waiting for every discovered root and aggregate graph to fully load.

## What success looks like

`forge web` can show all workspace roots from cached discovery data and load all root graphs in parallel without rescanning the full directory tree on every API request.

## Acceptance Criteria

- Avoid rediscovering workspace roots on normal `/api/tasks` requests.
- Cache root discovery in the dev server during a session using the roots found at `forge web` startup.
- Load every cached root graph in parallel and preserve the all-repos view.
- Rediscover roots only when `.forge` structure changes invalidate the cache.
- Preserve correctness when roots or tasks change after initial load.
- Performance harness demonstrates the cached API path on fixture workspaces.

## Execution Plan

Summary: Remove repeated root discovery from normal workspace API loads.

Scope: Web API payload strategy, CLI-to-Vite startup metadata, server-side discovery cache, and workspace fixture tests.

Approach:
- Pass the roots already found by `forge web` startup into the Vite dev server.
- Store those roots in an in-memory server cache for the session.
- Have `/api/tasks` build all root graphs from cached roots instead of rediscovering.
- Keep root graph loading parallel and keep the all-repos view available.
- Invalidate the cache and rediscover only when watcher events indicate `.forge` structure changes.
- Add fixture tests proving cached roots avoid rediscovery and structure changes invalidate the cache.

Verification:
- `bun run harness:web`
- Fixture performance smoke proving the served API path uses cached roots.

Stop conditions:
Not applicable.

Human review triggers:
Not applicable.

## Dependencies

Tracked in frontmatter: F-0081.

## Verification

- Run workspace load performance tests.
- Run `bun run harness:web`.

## Notes

The target is perceived speed and responsiveness, not just faster total load of all workspace data.

Decision: keep the all-repos view and load all root graphs in parallel. Do not switch to lazy single-repo-first behavior for this task.

Decision context from F-0081:
- Real `/Users/ken/Work/repo_worktrees` timing showed downward root discovery around 6.4s.
- Per-root task loading and graph construction were milliseconds, so the first optimization should reuse cached/seeded discovery and avoid repeated scans.

Implemented the session-cache path for workspace discovery.

Decisions:
- Kept the all-repos UI behavior; no lazy single-repo-first loading change.
- Passed `forge web` startup-discovered roots into Vite through `FORGE_WORKSPACE_ROOTS`.
- Stored roots in an in-memory dev-server cache and used them for `/api/tasks`.
- Kept all cached root graph loading parallel.
- Invalidated the root cache only for `.forge` structure changes; task-only changes keep the root cache and refresh graphs.
- Created follow-up tasks F-0097 through F-0100 for parallel traversal, ignore policy, configurable ignores, and affected-root graph refresh.

Verification:
- `bun test packages/web/test/api.test.ts packages/web/test/watch.test.ts packages/web/test/live-smoke.test.ts` passed: 18 tests, 75 expects.
- `bun run harness:web` passed: 46 tests, 182 expects.
- `bun run quality:check` passed: 219 tests, 1072 expects, web production build passed.

## History

- Created 2026-05-21T11:54:53-05:00.
