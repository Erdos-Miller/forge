---
id: F-0086
title: "Add scope config CLI tools"
kind: task
status: done
priority: high
area: "cli"
parent: "F-0000"
depends_on:
  - "F-0085"
claimed_by: ""
scope:
  - "packages/core/**"
  - "packages/cli/**"
  - ".forge/**"
  - "README.md"
created_at: 2026-05-21T11:54:53-05:00
updated_at: 2026-05-21T18:03:03.804Z
closed_at: 2026-05-21T18:03:03.804Z
close_reason: "Structured scope config CLI commands implemented and verified."
blocked_reason: ""
review_reason: ""
---
# Add scope config CLI tools

## Why

Agents should maintain `.forge/scopes.yml` through structured commands instead of hand-editing configuration.

## What success looks like

Forge can read, infer, add, and update user-facing scopes through CLI commands with JSON output.

## Acceptance Criteria

- Add `forge scopes --json` to read configured and resolved scopes.
- Add `forge scopes infer --json` to suggest candidate scopes from task edit scopes without writing files.
- Add `forge scopes add <id> --label <label> --path <glob> --json`.
- Add `forge scopes update <id> --path <glob> --json`.
- Preserve readable YAML when writing `.forge/scopes.yml`.
- Tests cover missing config, existing config, inference, add, update, invalid ids, and duplicate paths.

## Execution Plan

Summary: Implement structured scope configuration commands.

Scope: Core config parsing/writing helpers, CLI command parsing/metadata, docs, and tests.

Approach:
- Add typed scope config read/write helpers.
- Add command parsing for the planned `forge scopes` surface.
- Reuse hardened write patterns where practical.
- Keep inference read-only.
- Return machine-readable JSON suitable for agents.

Verification:
- `bun run harness:cli`
- Focused scope config CLI tests.

Stop conditions:
Not applicable.

Human review triggers:
Not applicable.

## Dependencies

Tracked in frontmatter: F-0085.

## Verification

- Run focused CLI scope config tests.
- Run `bun run harness:cli`.

## Notes

This task should not require existing repos to add `.forge/scopes.yml`.

Implemented structured UI Scope config commands.

Decisions:
- Added core `.forge/scopes.yml` read/write helpers for the documented `version: 1` shape.
- Added `forge scopes --json` to report configured scopes plus resolved configured-or-inferred scopes.
- Added `forge scopes infer --json` as a read-only suggestion command based on existing task edit-boundary globs.
- Added `forge scopes add <id> --label <label> --path <glob> --json`.
- Added `forge scopes update <id> --path <glob> --json` to append paths to an existing scope.
- Scope ids are stable lowercase kebab ids; exact duplicate configured paths are rejected.
- Updated command metadata, agent help, and docs to advertise the structured commands.
- Did not add per-task explicit scope overrides.

Verification:
- `bun test packages/cli/test/scopes.test.ts packages/cli/test/cli.test.ts packages/cli/test/robot-contracts.test.ts` passed: 63 tests, 420 expects.
- `bun run harness:cli` passed: 7 tests, 89 expects.
- `bun run quality:check` passed: 230 tests, 1113 expects, web production build passed.

## History

- Created 2026-05-21T11:54:53-05:00.
