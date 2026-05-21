---
id: F-0073
title: "Add workspace fixture harness"
kind: task
status: done
priority: urgent
area: "test"
parent: "F-0000"
depends_on:
  - "F-0072"
claimed_by: ""
scope:
  - "packages/core/**"
  - "packages/cli/**"
  - "packages/web/**"
  - ".forge/**"
created_at: 2026-05-21T09:50:50-05:00
updated_at: 2026-05-21T15:08:22.609Z
closed_at: 2026-05-21T15:08:22.609Z
close_reason: "Workspace fixture harness added and verified with focused tests plus harness:check."
blocked_reason: ""
review_reason: ""
---
# Add workspace fixture harness

## Why

Workspace web behavior should be built against disposable fixture workspaces, not against the developer's real `~/Work` tree.

## What success looks like

Tests can create temp parent directories containing zero, one, or many Forge roots with predictable task graphs and failure cases.

## Acceptance Criteria

- Add reusable fixture helpers for temp workspaces with zero Forge roots.
- Support one-root and many-root workspaces with predictable task files.
- Include empty roots, malformed task files, nested ignored directories, duplicate task IDs across separate roots, and large task sets.
- Keep fixtures isolated under temp directories and clean them up after tests.
- Document which later workspace tasks should use the fixture harness.

## Execution Plan

Summary: Build the fixture foundation for multi-root workspace tests.

Scope: Test fixture helpers and focused tests in core, CLI, or web packages.

Approach:
- Reuse the existing Forge fixture repo builder where possible.
- Add a parent-workspace builder that can compose multiple fixture roots.
- Add malformed and empty-root helpers without touching real local directories.
- Add tests that prove fixture creation, cleanup, and representative task loading work.
- Document the fixture helper in task notes or harness docs so later agents use it.

Verification:
- `bun run harness:check`
- Focused fixture helper tests

Stop conditions:
- Stop if the fixture helper requires scanning `/Users/ken/Work` or any non-temp workspace.

Human review triggers:
- Ask for review before adding a new package solely for test fixtures.

## Dependencies

Tracked in frontmatter: F-0072.

## Verification

- Run the focused fixture tests.
- Run `bun run harness:check`.

## Notes

This task is a hard gate before workspace discovery, API, UI, or watcher implementation.

Implemented workspace fixture harness foundation.

Decisions:
- Extended the existing core fixture repo builder instead of adding a new package.
- Added `createForgeFixtureWorkspace` for temp parent workspaces with zero, one, or many Forge roots.
- Added support for root-local malformed task files, empty roots, ignored nested roots, duplicate task IDs across separate roots, and large task sets.
- Documented that later workspace discovery, API, navigation, live refresh, and terminal-link tasks should use the workspace fixture helpers in `packages/core/test/fixture-repo.ts`.
- Kept all fixture roots under temporary directories; no real local workspace scanning is used.

Verification:
- `bun test packages/core/test/fixture-repo.test.ts` passed: 5 tests, 0 failures.
- `bun run harness:check` passed: 179 tests, 0 failures.

Closeout review resolution:
- No new package was added; the workspace helper lives beside the existing core test fixture builder.
- The fixture helper only creates and inspects temp directories under `os.tmpdir()`, never `/Users/ken/Work` or another real workspace.

## History

- Created 2026-05-21T09:50:50-05:00.
