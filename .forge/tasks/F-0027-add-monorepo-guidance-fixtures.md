---
id: F-0027
title: Add monorepo guidance fixtures
kind: task
status: done
priority: high
parent: F-0000
depends_on:
  - F-0023
claimed_by: ""
area: test
scope:
  - packages/core/**
  - packages/cli/**
  - .forge/tasks/**
created_at: 2026-05-15T00:00:00-05:00
updated_at: 2026-05-15T15:33:12.247Z
closed_at: 2026-05-15T15:33:12.247Z
close_reason: "Monorepo guidance fixture coverage added and verified"
blocked_reason: ""
review_reason: ""
---

# Add monorepo guidance fixtures

## Why

Guidance routing is most valuable in monorepos where apps, libraries, and infrastructure have different rules. Tests should prove overlapping matches work before real repos rely on it.

## What success looks like

The test suite includes monorepo guidance fixtures that exercise project, library, shared package, cwd, task, and explicit path resolution.

## Acceptance Criteria

- Add fixture guidance for `product/toolhub/**`.
- Add fixture guidance for `product/eclipsetouch/**`.
- Add fixture guidance for `lib/rust/**`.
- Add fixture guidance for a shared frontend package.
- Cover overlapping matches and most-specific ordering.
- Cover cwd-based resolution from nested project directories.
- Cover task-based resolution from task `area` and `scope`.
- Cover explicit path resolution for one or more paths.

## Dependencies

Depends on `F-0023` because fixtures should exercise the core guidance resolver.

## Verification

- Run relevant `packages/core` and `packages/cli` tests.
- Confirm fixture failures identify the matched path or task context that broke.

## Notes

Use temp repos or test fixtures. Do not depend on the developer's real `~/Work/repo` checkout.

Added a temp monorepo guidance fixture in core tests with Toolhub, EclipseTouch, Rust library, and shared frontend routes. The fixture asserts overlapping explicit-path matches preserve the intended most-specific route order, and it asserts cwd, task area, task scope, and explicit path reasons so failures identify the broken context.

Verification passed:
- bun test packages/core/test/guidance.test.ts
- bun test packages/core packages/cli
- bun run quality:check

## History

- Created 2026-05-15T00:00:00-05:00.
