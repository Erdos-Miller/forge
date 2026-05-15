---
id: F-0031
title: Add source size readability ratchet
kind: task
status: done
priority: urgent
parent: F-0000
depends_on:
  - F-0029
claimed_by: ""
area: test
scope:
  - packages/**
  - .forge/tasks/**
created_at: 2026-05-15T00:00:00-05:00
updated_at: 2026-05-15T05:41:17.586Z
closed_at: 2026-05-15T05:41:17.586Z
close_reason: "Source readability ratchet added to quality gate"
blocked_reason: ""
review_reason: ""
---

# Add source size readability ratchet

## Why

Agent-written code can drift into large files, compressed one-line logic, and difficult reviews. Forge should catch those regressions early with a small ratchet.

## What success looks like

A Bun test enforces basic source size and readability budgets for Forge package source and test files, with explicit reviewed exceptions when needed.

## Acceptance Criteria

- Add line-count budgets for package source files and tests.
- Add readability checks for max line length, compressed one-line function bodies, and multiple executable statements on one line.
- Allow explicit exceptions only when they include a reason and cleanup task id.
- Tests include accepted and rejected readability examples.
- Ratchet failures explain whether to split by responsibility or add a reviewed exception.
- Include the ratchet in `bun run quality:check`.

## Dependencies

Depends on `F-0029` because the ratchet should be part of the shared quality gate.

## Verification

- Run the source size/readability test directly.
- Run `bun run quality:check`.

## Notes

Keep thresholds conservative and simple for v0. This should guide agents toward smaller changes without becoming a style war.

Prioritize this with the harness work so agent-written code gets readability guardrails before the command surface grows further.

Implementation decision: added `packages/core/test/readability-ratchet.test.ts` so the ratchet runs under the existing root `bun run test` and therefore under `bun run quality:check`.

Budgets are intentionally simple for v0:
- Package source files: 1000 nonblank lines.
- Package test files: 1200 nonblank lines.
- Max line length: 120 characters.
- Readability checks catch one-line executable function bodies and multiple executable statements on one line.

The current large `packages/core/src/index.ts` and `packages/cli/src/index.ts` files have explicit reviewed exceptions with reasons and cleanup task `F-0051`. Exceptions without both a reason and `F-` cleanup task id are rejected by test coverage.

Verification:
- `bun test packages/core/test/readability-ratchet.test.ts` passed with accepted and rejected examples.
- `bun run quality:check` passed with 128 tests and the production web build.

## History

- Created 2026-05-15T00:00:00-05:00.
- Reprioritized to urgent to bring harness engineering guardrails forward.
- Claimed by codex and added the source size/readability ratchet.
