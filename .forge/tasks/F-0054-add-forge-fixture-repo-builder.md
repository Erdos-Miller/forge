---
id: F-0054
title: Add Forge fixture repo builder
kind: task
status: done
priority: urgent
area: test
parent: F-0000
depends_on:
  - F-0018
claimed_by: ""
scope:
  - packages/core/**
  - packages/cli/**
  - packages/web/**
  - .forge/tasks/**
created_at: 2026-05-15T00:00:00-05:00
updated_at: 2026-05-15T15:03:06.019Z
closed_at: 2026-05-15T15:03:06.019Z
close_reason: "Fixture repo builder implemented and verified"
blocked_reason: ""
review_reason: ""
---

# Add Forge fixture repo builder

## Why

Harnesses need disposable, representative Forge repos instead of relying on the real current `.forge/tasks` graph.

## What success looks like

Tests and harnesses can create temp Forge repos with known task graphs and expected outcomes.

## Acceptance Criteria

- Add reusable test or harness helpers for creating temp Forge repos.
- Cover fixture shapes for a minimal repo, blocked tasks, claimed tasks, done tasks with close metadata, nested monorepo cwd, and legacy or missing optional fields.
- Keep fixtures generated in temp directories or test code, not committed as noisy sample repos.
- Existing CLI harness tests can use or migrate toward the helper without behavior changes.

## Dependencies

Depends on `F-0018` because this should build on the existing CLI harness scenarios rather than inventing a second fixture style.

## Verification

- Run `bun test packages/core packages/cli`.
- Run `bun run quality:check`.

## Notes

This is an internal harness helper. It should not add customer-facing Forge behavior.

Implementation decision: added a shared test-only fixture repo builder in packages/core/test/fixture-repo.ts. It creates disposable temp Forge repos with nested working directories, writes task files in batches, and provides reusable fixture sets for minimal, blocked, claimed, done-with-close-metadata, legacy/missing optional fields, and scale scenarios.

Migrated packages/cli/test/harness.test.ts to use the shared fixture builder instead of its local temp-repo writer. Added core fixture tests that load the generated repos from root and nested directories.

Verification:
- bun test packages/core packages/cli passed with 118 tests.
- bun run quality:check passed with 132 tests and the web production build.

## History

- Created 2026-05-15T00:00:00-05:00.
