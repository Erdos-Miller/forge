---
id: F-0018
title: Build agent harness scenarios
kind: task
status: done
priority: urgent
parent: F-0000
depends_on:
  - F-0014
  - F-0015
  - F-0016
claimed_by: ""
area: test
scope:
  - packages/**
  - .forge/tasks/**
created_at: 2026-05-15T00:00:00-05:00
updated_at: 2026-05-15T05:37:08.263Z
closed_at: 2026-05-15T05:37:08.263Z
close_reason: "Agent harness scenarios implemented and verified"
blocked_reason: ""
review_reason: ""
---

# Build agent harness scenarios

## Why

Forge should guide agents to do more on their own. The best way to make that reliable is to test complete agent workflows, not only isolated parser and CLI functions.

## What success looks like

The test suite includes temp-repo harness scenarios that exercise the full robot loop from task selection through completion and validation.

## Acceptance Criteria

- Add a scenario for create, queue, next claim, note, block, unblock, review, done, and doctor clean.
- Add graph fixtures for linear dependencies, fan-in, fan-out, missing dependencies, cycles, and claimed tasks.
- Add a 1k task performance fixture with an explicit timing budget for queue and doctor.
- Add a 10k task measurement fixture that reports timing without blocking the suite unless behavior is extreme.
- Harness tests assert final task file contents where writes occur.

## Dependencies

Depends on `F-0014`, `F-0015`, and `F-0016` because the harness should test the real robot loop.

## Verification

- Run the harness tests through the normal package test command.
- Confirm failures point to the workflow step and fixture that broke.

## Notes

Use isolated temp repos. Do not rely on the live Forge repo state for workflow tests.

Prioritize this before broader prompt and guidance polish so agent-loop changes are covered by full workflow scenarios.

Implementation decision: added a dedicated CLI harness suite in `packages/cli/test/harness.test.ts` using isolated temp repos and the real `runCli` entrypoint. The workflow scenario covers create, queue, next claim, note, block, unblock, review, done, and final doctor clean, with task-file assertions after each write.

Graph coverage includes linear dependencies, fan-in, fan-out, missing dependencies, a dependency cycle, and claimed work. The fixture asserts both ranked queue output and blocker JSON for representative blocked tasks.

Performance coverage:
- 1k fixture has explicit queue and doctor budgets under 2000ms.
- 10k fixture reports queue and doctor timing and only fails above a 30000ms extreme bound.

Verification:
- `bun test packages/cli` passed with 57 tests. Measured 1k queue 23.9ms, 1k doctor 27.1ms, 10k queue 222.9ms, 10k doctor 272.7ms.
- `bun run quality:check` passed with 124 tests and the production web build. Measured 1k queue 19.4ms, 1k doctor 27.2ms, 10k queue 215.0ms, 10k doctor 260.3ms.

## History

- Created 2026-05-15T00:00:00-05:00.
- Reprioritized to urgent to bring harness engineering forward.
- Claimed by codex and added CLI harness workflow, graph, and scale scenarios.
