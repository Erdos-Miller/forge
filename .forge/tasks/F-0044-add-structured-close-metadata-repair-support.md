---
id: F-0044
title: Add structured close metadata repair support
kind: task
status: done
priority: urgent
parent: F-0000
depends_on:
  - F-0039
claimed_by: ""
area: cli
scope:
  - packages/core/**
  - packages/cli/**
  - .forge/tasks/**
created_at: 2026-05-15T00:00:00-05:00
updated_at: 2026-05-15T05:19:43.724Z
closed_at: 2026-05-15T05:19:43.724Z
close_reason: "Close metadata repair support verified"
blocked_reason: ""
review_reason: ""
---

# Add structured close metadata repair support

## Why

Historical close metadata repair should use a validated Forge command, not manual YAML edits.

## What success looks like

Structured metadata editing can set `closed_at` and `close_reason` safely for explicit task ids.

## Acceptance Criteria

- Extend structured metadata editing to set `closed_at`.
- Extend structured metadata editing to set `close_reason`.
- Validate `closed_at` timestamp format before writing.
- Require an explicit task id and explicit timestamp; do not add implicit bulk mutation.
- Preserve Markdown body, unknown sections, and unrelated frontmatter.
- Return the updated task bundle as JSON.
- Tests cover setting close metadata, rejecting invalid timestamps, and preserving task content.

## Dependencies

Depends on `F-0039` because close metadata repair should extend the structured task metadata edit command.

## Verification

- Run `bun test packages/core packages/cli`.
- Run `bun run quality:check`.
- Smoke-check setting close metadata in a temporary Forge task store.

## Notes

Do not backfill Forge's historical task data in this task. Build the safe tool first.

Prioritize this with the timestamp doctor checks so completion analytics can be repaired using validated commands instead of manual YAML edits.

Extended `forge set` with explicit `--closed-at <timestamp>` and `--close-reason <text>` options. The command validates the timestamp before writing and still requires a single explicit task id plus `--json`.

No historical task data was backfilled here.

Verification:
- `bun test packages/core packages/cli`
- `bun run quality:check`
- Temporary task-store smoke: created `F-9000`, set close metadata, and verified the JSON payload.

## History

- Created 2026-05-15T00:00:00-05:00.
- Reprioritized to urgent because it is required before safe burndown timestamp repair.
- Added structured close metadata repair support.
