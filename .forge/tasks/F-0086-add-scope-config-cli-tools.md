---
id: F-0086
title: "Add scope config CLI tools"
kind: task
status: open
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
updated_at: 2026-05-21T11:54:53-05:00
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
- Stop if command design conflicts with F-0085's documented config shape.

Human review triggers:
- Ask for review before adding per-task explicit scope overrides.

## Dependencies

Tracked in frontmatter: F-0085.

## Verification

- Run focused CLI scope config tests.
- Run `bun run harness:cli`.

## Notes

This task should not require existing repos to add `.forge/scopes.yml`.

## History

- Created 2026-05-21T11:54:53-05:00.
