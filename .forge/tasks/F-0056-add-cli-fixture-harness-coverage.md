---
id: F-0056
title: Add CLI fixture harness coverage
kind: task
status: done
priority: high
area: test
parent: F-0000
depends_on:
  - F-0054
  - F-0055
claimed_by: ""
scope:
  - packages/cli/**
  - packages/core/**
  - .forge/tasks/**
created_at: 2026-05-15T00:00:00-05:00
updated_at: 2026-05-15T15:22:58.538Z
closed_at: 2026-05-15T15:22:58.538Z
close_reason: "CLI fixture harness coverage implemented and verified"
blocked_reason: ""
review_reason: ""
---

# Add CLI fixture harness coverage

## Why

Forge already has CLI tests, but the internal harness should make the real CLI workflow explicit and reusable.

## What success looks like

`harness:cli` proves the real CLI works against fixture repos from root and nested directories.

## Acceptance Criteria

- Run real CLI entrypoints against fixture repos.
- Cover `list`, `ready`, `queue`, `next`, `prompt next`, `doctor --json`, and representative write commands that already exist.
- Assert stable behavior from repo root and nested cwd.
- Assert malformed fixture repos fail with useful diagnostics.

## Dependencies

Depends on `F-0054` for shared fixture repos and `F-0055` for the public internal harness script.

## Verification

- Run `bun run harness:cli`.
- Run `bun test packages/cli`.
- Run `bun run quality:check`.

## Notes

Do not expand the user-facing CLI surface in this task.

Implemented CLI fixture harness coverage for the real CLI entrypoint from repo root and nested cwd. The harness now checks list, ready, queue, next, prompt next, doctor --json, nested write workflow behavior, and malformed fixture diagnostics.

Verification passed:
- bun run harness:cli
- bun test packages/cli
- bun run quality:check

## History

- Created 2026-05-15T00:00:00-05:00.
