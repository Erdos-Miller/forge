---
id: F-0017
title: Harden task file writes
kind: task
status: done
priority: high
parent: F-0000
depends_on:
  - F-0015
  - F-0016
claimed_by: ""
area: core
scope:
  - packages/core/**
  - packages/cli/**
  - .forge/tasks/**
created_at: 2026-05-15T00:00:00-05:00
updated_at: 2026-05-15T05:08:52.301Z
closed_at: 2026-05-15T05:08:52.301Z
close_reason: "Write hardening verified"
blocked_reason: ""
review_reason: ""
---

# Harden task file writes

## Why

Robot commands will write task files frequently. Those writes must preserve human-authored Markdown, avoid invalid YAML, and fail clearly when the task store is unsafe.

## What success looks like

Core write helpers safely update task files without corrupting frontmatter or body content, including glob values such as `**`.

## Acceptance Criteria

- YAML array scalars are quoted safely when generated or updated.
- `forge create` default scope no longer writes invalid YAML for `**`.
- Unknown frontmatter fields and unknown Markdown sections are preserved.
- Writes fail clearly on malformed frontmatter or merge conflict markers.
- Writes use an atomic write strategy appropriate for local files.
- Tests cover glob values, special characters, unknown fields, unknown sections, malformed task files, and stale or unsafe write cases.

## Dependencies

Depends on `F-0015` and `F-0016` because write hardening should cover the full lifecycle command surface and doctor diagnostics.

## Verification

- Run `bun test` in `packages/core` and `packages/cli`.
- Add a regression test that creates a task without `--scope` and reparses it successfully.

## Notes

This task should not add new product commands. It makes existing and planned writes safe enough for dogfooding.

Implemented in the shared core write path so create, claim, lifecycle, note, and done commands benefit without adding product commands.

Decisions:
- Quote generated YAML array scalars with JSON string escaping so glob values like `**` and values with `:` or `#` reparse safely.
- Preserve unknown frontmatter fields by updating the original frontmatter text instead of rebuilding it.
- Preserve unknown Markdown sections by only touching frontmatter or appending inside `## Notes`.
- Reject writes when task files contain merge conflict markers.
- Use same-directory temp-file writes followed by rename for local atomic replacement.

Verification:
- `bun test packages/core packages/cli`
- `bun run quality:check`
- Added regression coverage for default `forge create` scope reparsing as `["**"]`.

## History

- Created 2026-05-15T00:00:00-05:00.
- Hardened task file writes and generated YAML array scalars.
