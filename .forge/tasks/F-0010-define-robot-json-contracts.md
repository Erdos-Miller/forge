---
id: F-0010
title: Define robot JSON contracts
kind: task
status: done
priority: urgent
parent: F-0000
depends_on:
  - F-0004
claimed_by: ""
area: cli
scope:
  - .forge/**
  - packages/cli/**
  - packages/core/**
created_at: 2026-05-15T00:00:00-05:00
updated_at: 2026-05-15T03:47:40.010Z
closed_at: 2026-05-15T03:47:40.010Z
close_reason: ""
---

# Define robot JSON contracts

## Why

Agents need stable, compact command output before Forge can guide its own development. The current CLI is human-readable only, which forces agents to infer state from text and reread task files manually.

## What success looks like

Forge has documented robot-mode JSON contracts and exit-code rules for the commands needed to inspect the task graph and select work.

## Acceptance Criteria

- Contract shapes are documented for `queue`, `next`, `show`, `blockers`, `deps`, and `doctor`.
- A shared error response shape is documented.
- Exit-code behavior is documented for success, usage errors, missing tasks, graph diagnostics, and write failures.
- The contracts specify compact JSON suitable for agent consumption.
- CLI contract tests can assert exact response shapes without needing implementation-specific details.

## Dependencies

Depends on `F-0004` because the minimal CLI must exist before robot contracts can be layered onto it.

## Verification

- Review the contract docs against the current CLI and core capabilities.
- Add or update tests that lock the documented JSON shapes once implementation begins.

## Notes

Do not add broad workflow features in this task. This is a contract and planning task for robot-mode command surfaces.

Implemented a contract-only pass in `.forge/specs/F-0010-robot-json-contracts.md`.
The spec defines v1 compact JSON shapes for `queue`, `next`, `show`, `blockers`, `deps`, and `doctor`, plus shared diagnostics, blocker, error response, and exit-code rules.

The shapes were checked against current core/CLI capabilities: task parsing/loading, ready analysis, ranked ready tasks, blockers, diagnostics, task lookup, and source-path/body access are already available for future command implementation.

Verification:
- `bun test` in `packages/cli`
- `bun test robot-contracts.test.ts` in `packages/cli`

## History

- Created 2026-05-15T00:00:00-05:00.
- 2026-05-14T22:47:19-05:00: Documented robot JSON contracts and added CLI contract tests that parse and lock the documented examples.
