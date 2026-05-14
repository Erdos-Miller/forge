---
id: F-0004
title: Build minimal CLI
kind: task
status: done
priority: high
parent: F-0000
depends_on:
  - F-0002
  - F-0003
claimed_by: ""
scope:
  - packages/**
  - README.md
created_at: 2026-05-14T00:00:00-05:00
updated_at: 2026-05-14T17:54:11-05:00
---

# Build minimal CLI

## Context

The first CLI should make the existing task files useful without introducing a server or cache.

## Acceptance Criteria

- Lists all tasks.
- Lists ready tasks.
- Claims a task.
- Marks a task done.
- Updates `updated_at` when writing.
- Preserves Markdown body content.

## Notes

Keep command names boring until real usage suggests otherwise.

Claimed by codex for the minimal CLI implementation pass.

Implemented a separate Bun/TypeScript CLI package under `packages/cli` with `list`, `ready`, `claim`, and `done` commands. Added core write helpers for updating frontmatter fields while preserving Markdown body content.

Verification: `bun test` passed in `packages/core` and `packages/cli`. Read-only smoke checks from the repo root passed for `bun packages/cli/src/index.ts list` and `bun packages/cli/src/index.ts ready`.
