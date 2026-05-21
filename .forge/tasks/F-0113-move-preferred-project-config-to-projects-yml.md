---
id: F-0113
title: "Move preferred project config to projects.yml"
kind: task
status: done
priority: urgent
area: "core"
parent: "F-0000"
depends_on:
  - "F-0111"
claimed_by: ""
scope:
  - "packages/core/**"
  - "packages/cli/**"
  - "packages/web/**"
  - ".forge/**"
created_at: 2026-05-21T15:37:53-05:00
updated_at: 2026-05-21T21:18:51.346Z
closed_at: 2026-05-21T21:18:51.346Z
close_reason: "Moved preferred Project config reads/writes to projects.yml with legacy scopes.yml compatibility."
blocked_reason: ""
review_reason: ""
---
# Move preferred project config to projects.yml

## Why

The preferred Project config should not live in a file named `scopes.yml`; that preserves the old confusion.

## What success looks like

Forge writes new Project config to `.forge/projects.yml` while reading legacy `.forge/scopes.yml` for compatibility.

## Acceptance Criteria

- Prefer `.forge/projects.yml` for new Project config writes.
- Read `.forge/projects.yml` when present.
- Read legacy `.forge/scopes.yml` when no preferred file exists.
- Treat simultaneous preferred and legacy files as a doctor/migration warning, not silent merge behavior.
- Preserve the `version: 1` and `projects:` config shape.
- Update `forge projects` commands to write the preferred file.
- Keep legacy `forge scopes` commands compatible if they remain exposed.
- Tests cover preferred file, legacy file, missing file, and both-file conflict behavior.

## Execution Plan

Summary: Make Project config naming match the product model while keeping old repos readable.

Scope: Core project config loader/writer, CLI project commands, web API config resolution, docs, and tests.

Approach:
- Introduce a preferred project config path.
- Keep legacy scope config parsing read-compatible.
- Make writes go only to the preferred path.
- Surface source path and source kind in JSON output where useful.
- Defer mutation/migration of existing files to F-0116.

Verification:
- Core config tests.
- CLI project command tests.
- Focused web API config tests.

Stop conditions:
- Stop if compatibility would silently combine two conflicting config files.

Human review triggers:
- Ask for review if legacy `forge scopes` commands should write to the legacy file instead of the preferred file.

## Dependencies

Tracked in frontmatter: F-0111.

## Verification

- Run focused project config tests.
- Run `bun run harness:cli`.

## Notes

This task changes the preferred file path only. It should not backfill task `project`.

Decision: `.forge/projects.yml` is the preferred Project config file. `.forge/scopes.yml` remains legacy read compatibility only.

Implemented preferred Project config path:
- `readScopeConfig` now reads `.forge/projects.yml` first, falls back to legacy `.forge/scopes.yml`, and reports which source was used.
- Project config writes now go to `.forge/projects.yml` for both `forge projects` and the legacy-compatible `forge scopes` command surface.
- Doctor warns when both preferred and legacy config files exist instead of silently merging them.
- CLI JSON includes config `source`, `sourcePath`, and optional `legacySourcePath`.
- Updated docs to describe `.forge/projects.yml` as the write target and `.forge/scopes.yml` as read compatibility.

Verification:
- `bun test packages/core/test/scope-config.test.ts packages/cli/test/projects.test.ts packages/cli/test/scopes.test.ts packages/cli/test/scope-doctor.test.ts packages/web/test/api.test.ts packages/core/test/readability-ratchet.test.ts`
- `bun run harness:cli`

## History

- Created 2026-05-21T15:37:53-05:00.
