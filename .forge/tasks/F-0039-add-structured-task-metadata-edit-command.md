---
id: F-0039
title: Add structured task metadata edit command
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
updated_at: 2026-05-15T05:17:00.375Z
closed_at: 2026-05-15T05:17:00.375Z
close_reason: "Structured metadata edits verified"
blocked_reason: ""
review_reason: ""
---

# Add structured task metadata edit command

## Why

Agents should not hand-edit frontmatter for common metadata changes. Structured writes reduce YAML mistakes while keeping task files readable and repairable.

## What success looks like

`forge set <id> ... --json` updates common task metadata safely while preserving the Markdown body and unrelated frontmatter.

## Acceptance Criteria

- Add `forge set <id> [--priority <value>] [--status <value>] [--area <value>] [--scope <glob>] --json`.
- Validate priority and status enum values before writing.
- Support repeated `--scope` values to replace the task scope list.
- Preserve Markdown body, unknown sections, and unrelated frontmatter.
- Return the updated task bundle as JSON.
- Reject calls with no fields to update.
- Do not include dependency edits in this command.
- Tests cover each supported field, invalid values, no-op usage, preservation, and JSON output.

## Dependencies

Depends on `F-0017` for hardened writes and `F-0036` so the command is registered with agent guidance metadata when added.

## Verification

- Run `bun test packages/core packages/cli`.
- Run `bun run quality:check`.
- Smoke-check metadata edits in a temporary Forge task store.

## Notes

Keep this command focused on ordinary scalar/list metadata. Dependency mutation is handled by `F-0040`.

Implemented `forge set <id> ... --json` for priority, status, area, and repeated scope replacement. It validates priority/status before writing, preserves unrelated frontmatter and Markdown body content, and returns the same full task bundle shape as `forge show --json`.

Dependency edits are intentionally excluded.

Verification:
- `bun test packages/core packages/cli`
- `bun run quality:check`
- Temporary task-store smoke: created `F-9000`, set priority/status/area/scope, and verified the JSON payload.

## History

- Created 2026-05-15T00:00:00-05:00.
- Added structured metadata edit command.
