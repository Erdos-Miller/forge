---
id: F-0081
title: "Instrument workspace load performance"
kind: task
status: done
priority: urgent
area: "web"
parent: "F-0000"
depends_on:
  - "F-0080"
claimed_by: ""
scope:
  - "packages/web/**"
  - "packages/core/**"
  - "packages/cli/**"
  - ".forge/**"
created_at: 2026-05-21T11:54:53-05:00
updated_at: 2026-05-21T17:25:49.993Z
closed_at: 2026-05-21T17:25:49.993Z
close_reason: "Workspace load timings exposed through diagnostics and watcher setup logs with fixture coverage."
blocked_reason: ""
review_reason: ""
---
# Instrument workspace load performance

## Why

Workspace web loading can take several seconds, and Forge needs phase-level timings before optimizing.

## What success looks like

Developers can see how much time workspace discovery, task parsing, graph aggregation, and watcher setup take for a fixture workspace.

## Acceptance Criteria

- Capture timing for downward Forge-root discovery.
- Capture timing for per-root task loading and parsing.
- Capture timing for aggregate graph or workspace payload construction.
- Capture timing for watcher setup.
- Expose the timings through server logs or a dev-only diagnostics payload.
- Tests or harness output use fixture workspaces rather than the real local workspace.

## Execution Plan

Summary: Add lightweight performance visibility to the workspace web load path.

Scope: Web server/API load path, discovery helpers if needed, and fixture-based tests.

Approach:
- Add a small timing helper around existing workspace load phases.
- Include phase names and elapsed milliseconds in a developer-visible place.
- Keep timing data out of task graph semantics and robot JSON contracts unless explicitly scoped.
- Add fixture coverage that proves timing fields or logs are produced without relying on exact durations.
- Use the instrumentation to guide F-0082.

Verification:
- `bun run harness:web`
- Focused tests for timing payload/log structure where practical.

Stop conditions:
Not applicable.

Human review triggers:
Not applicable.

## Dependencies

Tracked in frontmatter: F-0080.

## Verification

- Run focused web performance instrumentation tests.
- Run `bun run harness:web`.

## Notes

This task measures the problem. It should not optimize the loading strategy yet.

Implemented lightweight workspace performance instrumentation.

Decisions:
- Exposed workspace load timings in a developer diagnostics payload at `workspace.diagnostics.loadTimings` instead of visible production UI.
- Added per-root `timings` for root task parsing and graph payload construction.
- Logged watcher setup completion from the Vite dev plugin and returned watcher setup timings from the testable helper.
- Did not optimize discovery or loading strategy in this task.

Verification:
- `bun test packages/web/test/api.test.ts packages/web/test/watch.test.ts` passed: 12 tests, 49 expects.
- `bun run harness:web` passed: 42 tests, 169 expects.
- Real workspace smoke with `/Users/ken/Work/repo_worktrees` produced `workspace.discover_roots` timing around 6.4s and per-root load/graph timings in milliseconds.
- `bun run quality:check` passed: 215 tests, 1059 expects, web production build passed.

## History

- Created 2026-05-21T11:54:53-05:00.
