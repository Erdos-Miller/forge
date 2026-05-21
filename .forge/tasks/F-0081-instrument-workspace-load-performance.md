---
id: F-0081
title: "Instrument workspace load performance"
kind: task
status: open
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
updated_at: 2026-05-21T11:54:53-05:00
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
- Stop if the instrumentation adds meaningful overhead to normal workspace loads.

Human review triggers:
- Ask for review before exposing timings in the visible production UI.

## Dependencies

Tracked in frontmatter: F-0080.

## Verification

- Run focused web performance instrumentation tests.
- Run `bun run harness:web`.

## Notes

This task measures the problem. It should not optimize the loading strategy yet.

## History

- Created 2026-05-21T11:54:53-05:00.
