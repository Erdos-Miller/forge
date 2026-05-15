---
id: F-0052
title: "Harden web task graph payload compatibility"
kind: task
status: done
priority: urgent
area: "web"
parent: ""
depends_on:
  - "F-0048"
claimed_by: ""
scope:
  - "packages/web/**"
  - ".forge/tasks/**"
created_at: 2026-05-15T05:42:56.670Z
updated_at: 2026-05-15T18:12:04.958Z
closed_at: 2026-05-15T18:12:04.958Z
close_reason: "Web task graph payload compatibility fix implemented, regression tested, live-smoked, and quality gate passes."
blocked_reason: ""
review_reason: ""
---
# Harden web task graph payload compatibility

## Why

The web UI crashed with `Cannot read properties of undefined (reading 'entries')` when `/api/tasks` saw a graph analysis object without `availabilityByTaskId`. Unit tests covered the fresh in-process shape, but not the stale or mixed runtime shape that the running web server hit.

## What success looks like

The web task API returns a valid payload even if availability is missing from graph analysis, and tests cover that compatibility path.

## Acceptance Criteria

- Derive task availability in the web API when the graph analysis object lacks `availabilityByTaskId`.
- Keep the normal `availabilityByTaskId` payload for the current core graph shape.
- Add a regression test for an analysis object without `availabilityByTaskId`.
- Live-smoke `/api/tasks` through a real local Forge web server.
- Add follow-up work for a permanent live web smoke harness.

## Dependencies

Tracked in frontmatter: F-0048.

## Verification

- Run `bun test packages/web`.
- Run `bun run quality:check`.
- Start `forge web` and request `/api/tasks`.

## Notes

Implementation decision: `getTaskGraphPayload` now funnels through `toTaskGraphPayload`, which accepts a compatibility graph shape. When `availabilityByTaskId` is absent, the web API derives `ready`, `active`, `claimed`, `blocked`, and `closed` from task status, claim, and real blocker entries before serializing the payload.

The bug escaped because our tests exercised `getTaskGraphPayload` in-process and mocked `App` with the new field already present. They did not start the real `forge web` server and request `/api/tasks`, so they missed the runtime compatibility failure.

Created `F-0053` to add a permanent live Forge web smoke harness.

Verification:
- `bun test packages/web` passed with 14 tests, including the missing-availability regression.
- Live smoke: `forge web --host 127.0.0.1 --port 5199` plus `curl -i http://127.0.0.1:5199/api/tasks` returned `HTTP/1.1 200 OK` and a payload with `availabilityByTaskId`.

## History

- Created 2026-05-15T05:42:56.670Z.
- Claimed by codex and hardened the web task graph payload against missing availability analysis.
