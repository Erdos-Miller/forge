---
id: F-0053
title: Add live Forge web smoke harness
kind: task
status: done
priority: urgent
area: test
parent: F-0000
depends_on:
  - F-0052
  - F-0054
  - F-0055
claimed_by: ""
scope:
  - packages/cli/**
  - packages/web/**
  - packages/core/**
  - package.json
  - .forge/tasks/**
created_at: 2026-05-15T00:00:00-05:00
updated_at: 2026-05-15T19:36:09.636Z
closed_at: 2026-05-15T19:36:09.636Z
close_reason: "Live forge web smoke harness implemented and wired through harness:web; quality gate passes."
blocked_reason: ""
review_reason: ""
---

# Add live Forge web smoke harness

## Why

The web task API crash in `F-0052` escaped because tests exercised web API helpers in-process, not the real `forge web` server and `/api/tasks` route used by humans.

## What success looks like

The internal `harness:web` check starts Forge web against isolated fixture repos and proves the API and page entrypoint load tasks successfully.

## Acceptance Criteria

- Start the real `forge web` command against an isolated fixture repo.
- Request `/api/tasks` and assert `200`, valid JSON, tasks, queue data, and `availabilityByTaskId`.
- Load the root page or app shell and assert it does not render `Failed to load tasks`.
- Include a regression fixture where graph analysis lacks optional availability data, matching the `F-0052` failure mode.
- Ensure the spawned server is always cleaned up.
- Include clear failure output for server startup, API response, and app render failures.
- Wire the smoke to the internal `bun run harness:web` script and include it in the normal internal harness path.

## Execution Plan

1. Add a live web smoke test under the web test harness that creates an isolated Forge fixture repo with representative ready, blocked, done, and claimed tasks.
2. Spawn the real `forge web` CLI entrypoint against that fixture repo on a test port, poll until the HTTP server is ready, and always kill the spawned process in cleanup.
3. Assert `/api/tasks` returns `200`, valid JSON, tasks, queue/recommendation data, `availabilityByTaskId`, and no graph diagnostics.
4. Assert the root page/app shell loads over HTTP and does not contain `Failed to load tasks`.
5. Keep the existing missing-availability compatibility regression in the web harness and make `harness:web` run only the web tests that include both the API regression and live smoke.
6. Verify with `bun run harness:web` and `bun run quality:check` before closing.

## Dependencies

Depends on `F-0052` because the compatibility fix should land before preserving the smoke as a permanent gate.

Depends on `F-0054` and `F-0055` because the smoke should use generic fixtures and a stable internal harness command rather than a one-off task-specific script.

## Verification

- Run `bun run harness:web`.
- Run `bun run quality:check`.

## Notes

This should exercise the same command path a human uses, not only `getTaskGraphPayload` as an imported helper.

This is an internal developer/agent harness, not a new public `forge` command.

Implemented the live Forge web smoke harness.

Decisions:
- Added `packages/web/test/live-smoke.test.ts` so the existing `harness:web` script now starts the real `forge web` command against an isolated fixture repo.
- The smoke polls the real `/api/tasks` endpoint, asserts valid task graph JSON, queue/recommendation data, `availabilityByTaskId`, blockers, and clean diagnostics.
- The smoke fetches the root page entrypoint and asserts it does not contain `Failed to load tasks`.
- The harness always tracks fixture repos and spawned servers in test cleanup; failures include captured `forge web` stdout/stderr tails.
- Fixed a real startup regression found by the smoke: the CLI split had dropped the `node:path` import used by `forge web`.
- Added SIGINT/SIGTERM forwarding in `forge web` so tests and humans can stop the CLI wrapper without orphaning the Vite child process.

Verification:
- `bun test packages/web/test/live-smoke.test.ts`
- `bun run harness:web`
- `bun run quality:check`

## History

- Created 2026-05-15T00:00:00-05:00.
- Refined 2026-05-15T00:00:00-05:00 to depend on generic fixture and harness script tasks.
