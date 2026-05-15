---
id: F-0040
title: Add dependency edit commands
kind: task
status: done
priority: high
parent: F-0000
depends_on:
  - F-0017
  - F-0036
claimed_by: ""
area: cli
scope:
  - packages/core/**
  - packages/cli/**
  - .forge/tasks/**
created_at: 2026-05-15T00:00:00-05:00
updated_at: 2026-05-15T15:54:51.683Z
closed_at: 2026-05-15T15:54:51.683Z
close_reason: "Verified with focused dependency-edit tests, package tests, full quality check, and temp-store CLI smoke."
blocked_reason: ""
review_reason: ""
---

# Add dependency edit commands

## Why

Dependency edits are graph-sensitive. Agents should use commands that validate task ids and cycles immediately instead of hand-editing `depends_on`.

## What success looks like

Forge can add and remove dependencies through structured commands while preserving the existing `forge deps <id> --json` introspection behavior.

## Acceptance Criteria

- Add `forge deps add <id> <dependency> --json`.
- Add `forge deps remove <id> <dependency> --json`.
- Preserve existing `forge deps <id> --json` read-only behavior.
- Reject missing task ids and missing dependency ids.
- Reject edits that would create a dependency cycle.
- Treat duplicate add and absent remove as clear no-op responses.
- Preserve Markdown body, unknown sections, and unrelated frontmatter.
- Tests cover add, remove, missing ids, duplicate add, absent remove, cycle rejection, preservation, and JSON output.

## Execution Plan

1. Add core dependency-edit helpers that load the task graph, validate both task ids, reject cycles, and update only `depends_on` plus `updated_at`.
2. Wire `forge deps add/remove` through the core helpers and emit structured JSON for changed, no-op, not-found, cycle, and usage cases.
3. Add focused core and CLI tests for add, remove, missing ids, duplicate/absent no-ops, cycle rejection, preservation, and read-command compatibility.
4. Verify with package tests, full quality check, and a temp-store CLI smoke.

## Dependencies

Depends on `F-0017` for hardened writes and `F-0036` so dependency edit commands are registered with agent guidance metadata when added.

## Verification

- Run `bun test packages/core packages/cli`.
- Run `bun run quality:check`.
- Smoke-check dependency edits in a temporary Forge task store.

## Notes

Keep dependency editing separate from `forge set` because dependency changes need graph validation.

Implemented `forge deps add/remove` as validated graph writes. The core helper rejects missing ids and cycle-producing edits, duplicate adds return `already_present`, absent removes return `absent`, and Markdown body plus unrelated frontmatter are preserved through the existing task writer.

Verification:
- `bun test packages/core/test/deps-edit.test.ts packages/cli/test/deps-edit.test.ts`
- `bun test packages/core packages/cli`
- `bun run quality:check`
- Temp-store smoke with `deps add`, `deps remove`, and missing dependency id JSON error using `/private/tmp/forge-deps-smoke-xSfyN0`.

## History

- Created 2026-05-15T00:00:00-05:00.
