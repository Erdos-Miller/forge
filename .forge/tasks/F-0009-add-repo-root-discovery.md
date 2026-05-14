---
id: F-0009
title: Add repo root discovery
kind: task
status: done
priority: high
parent: F-0000
depends_on:
  - F-0004
claimed_by: ""
scope:
  - .forge/**
  - README.md
  - packages/**
created_at: 2026-05-14T17:59:55-05:00
updated_at: 2026-05-14T18:02:40-05:00
---

# Add repo root discovery

## Context

Forge should feel like repo infrastructure rather than app-local clutter. The canonical store should stay in one tracked `.forge/` directory at the repo root, while CLI commands should work from nested package and app directories.

## Acceptance Criteria

- CLI commands discover the repo root by walking upward to `.forge`.
- Task files can optionally declare an `area` for human grouping across projects.
- CLI output includes `area` when present.
- `list` and `ready` reject unexpected extra arguments.
- Storage-model documentation explains one tracked `.forge/` per repo.

## Notes

Claimed by codex for the repo-root discovery and repo hygiene implementation pass.

Implemented root discovery in `@forge/core`, nested-directory CLI behavior, optional `area` parsing/output, and stricter `list`/`ready` argument validation.

Documented the one tracked `.forge/` per repo storage model in `.forge/README.md` and `README.md`.

Verification: `bun test` passed in `packages/core` and `packages/cli`. Read-only smoke checks passed for `ready` from the repo root and from `packages/core/src`; `list --cwd nope` now fails with usage.
