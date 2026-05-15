---
id: F-0016
title: Add doctor JSON command
kind: task
status: done
priority: high
parent: F-0000
depends_on:
  - F-0011
claimed_by: ""
area: cli
scope:
  - packages/core/**
  - packages/cli/**
  - .forge/tasks/**
created_at: 2026-05-15T00:00:00-05:00
updated_at: 2026-05-15T05:30:00.000Z
closed_at: 2026-05-15T05:00:00.000Z
close_reason: "Backfilled by F-0045; timestamp is approximate."
---

# Add doctor JSON command

## Why

If Markdown files are canonical, Forge needs a fast validator that agents can run before trusting or closing work.

## What success looks like

`forge doctor --json` reports graph and task-store problems with source paths, stable diagnostic codes, and actionable messages.

## Acceptance Criteria

- Doctor reports malformed YAML, missing frontmatter, duplicate ids, missing dependencies, dependency cycles, invalid timestamps, invalid enum values, merge conflict markers, and invalid block or review field usage.
- Diagnostics include stable code, severity, message, task id when known, and source path when known.
- Clean task stores return success with an empty diagnostics list.
- Invalid task stores return the documented nonzero exit code.
- Tests cover every diagnostic category.

## Dependencies

Depends on `F-0011` because doctor should use the shared graph engine and diagnostics.

## Verification

- `bun test packages/cli/test/cli.test.ts` passed.
- `bun run quality:check` passed from the repo root.
- `forge doctor --json` returned zero errors on the Forge repo.
- CLI temp fixture tests cover malformed task stores.

## Notes

Added JSON-only `forge doctor --json`. It scans task files directly so malformed files do not abort the run, reports stable diagnostics for parse/schema/graph/conflict/unsupported block-review fields, and exits `4` when errors are present.

## History

- Created 2026-05-15T00:00:00-05:00.
- Claimed and implemented 2026-05-15.
