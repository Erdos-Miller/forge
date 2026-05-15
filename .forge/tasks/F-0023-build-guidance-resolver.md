---
id: F-0023
title: Build guidance resolver
kind: task
status: done
priority: urgent
parent: F-0000
depends_on:
  - F-0022
  - F-0029
  - F-0030
claimed_by: ""
area: core
scope:
  - packages/core/**
  - .forge/tasks/**
created_at: 2026-05-15T00:00:00-05:00
updated_at: 2026-05-15T05:30:00.000Z
closed_at: 2026-05-15T05:00:00.000Z
close_reason: "Backfilled by F-0045; timestamp is approximate."
---

# Build guidance resolver

## Why

The CLI and prompt command need one shared way to resolve guidance from current directory, task scope, task area, or explicit paths.

## What success looks like

`@forge/core` can resolve a guidance bundle from `{ cwd | taskId | paths }`, returning matched guidance files, reasons, summaries, and optional full content.

## Acceptance Criteria

- Reads `.forge/guidance.yml` from the discovered Forge root.
- Resolves guidance for current working directory context.
- Resolves guidance for task id using task `area` and `scope`.
- Resolves guidance for explicit path inputs.
- De-dupes matched guidance files while preserving deterministic order.
- Extracts `## Prompt Summary` for default output.
- Supports full-content mode for commands that request it.
- Tests cover cwd, task, path, overlapping matches, missing config, missing include files, and summary extraction.

## Dependencies

Depends on `F-0022` because the resolver should implement the documented format. Also depends on `F-0029` and `F-0030` so deeper guidance implementation runs under the quality check and package boundary guard.

## Verification

- `bun test packages/core/test/guidance.test.ts` passed.
- `bun run quality:check` passed from the repo root.
- Resolver tests use isolated temp repos created under the OS temp directory.

## Notes

Added reusable core `resolveGuidance` behavior without CLI commands. It reads `.forge/guidance.yml`, resolves by cwd, task area/scope, and explicit paths, de-dupes include files, extracts `## Prompt Summary`, supports full content, and includes `.forge/guidance.local.md` last when present.

## History

- Created 2026-05-15T00:00:00-05:00.
- Claimed and implemented 2026-05-15.
