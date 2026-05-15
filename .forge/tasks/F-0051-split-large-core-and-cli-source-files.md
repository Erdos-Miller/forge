---
id: F-0051
title: Split large core and CLI source files
kind: task
status: open
priority: medium
parent: F-0000
depends_on:
  - F-0031
claimed_by: ""
area: test
scope:
  - packages/core/src/**
  - packages/cli/src/**
  - .forge/tasks/**
created_at: 2026-05-15T00:00:00-05:00
updated_at: 2026-05-15T00:00:00-05:00
closed_at: ""
close_reason: ""
---

# Split large core and CLI source files

## Why

The readability ratchet needs reviewed exceptions for the current large core and CLI entrypoint files. Those exceptions should be temporary, with a tracked cleanup task.

## What success looks like

The core and CLI source surfaces are split by responsibility so their ratchet exceptions can be removed.

## Acceptance Criteria

- Split `packages/core/src/index.ts` into smaller responsibility-focused modules without changing public exports.
- Split `packages/cli/src/index.ts` into smaller command or formatting modules without changing CLI behavior.
- Remove the corresponding readability ratchet exceptions.
- Keep `forge queue`, `forge next`, `forge doctor`, and `forge web` behavior unchanged.

## Dependencies

Depends on `F-0031` because this task removes exceptions introduced by the ratchet.

## Verification

- Run the readability ratchet test directly.
- Run `bun run quality:check`.

## Notes

Keep this as a mechanical extraction. Behavior changes should be separate tasks.

## History

- Created 2026-05-15T00:00:00-05:00.
