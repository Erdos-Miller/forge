---
id: F-0087
title: "Add scope config doctor checks"
kind: task
status: open
priority: medium
area: "cli"
parent: "F-0000"
depends_on:
  - "F-0086"
claimed_by: ""
scope:
  - "packages/core/**"
  - "packages/cli/**"
  - ".forge/**"
created_at: 2026-05-21T11:54:53-05:00
updated_at: 2026-05-21T11:54:53-05:00
---
# Add scope config doctor checks

## Why

Configured scopes can drift as tasks and project paths change, so agents need advisory diagnostics.

## What success looks like

`forge doctor --json` warns about unhealthy scope config without blocking task loading or queue ranking.

## Acceptance Criteria

- Warn when many open tasks do not match any configured scope.
- Warn when configured scopes overlap ambiguously.
- Warn when a configured scope path matches no task edit scopes.
- Include task ids, scope ids, source paths, and repair hints where useful.
- Keep scope diagnostics advisory warnings only.
- Tests cover unmatched tasks, overlaps, empty configured scopes, and healthy config.

## Execution Plan

Summary: Add advisory doctor diagnostics for `.forge/scopes.yml`.

Scope: Doctor diagnostics, scope config helpers, and CLI tests.

Approach:
- Reuse scope config parsing from F-0086.
- Analyze open and active tasks by default to reduce historical noise.
- Report clear repair hints that point to `forge scopes infer/add/update`.
- Keep diagnostics out of readiness and ranking.
- Add focused doctor tests.

Verification:
- `bun run harness:cli`
- Focused doctor tests.

Stop conditions:
- Stop if diagnostics become noisy for repos without explicit scope config.

Human review triggers:
- Ask for review if unmatched-task thresholds need product tuning.

## Dependencies

Tracked in frontmatter: F-0086.

## Verification

- Run focused scope doctor tests.
- Run `bun run harness:cli`.

## Notes

Repos without `.forge/scopes.yml` should not receive configuration-drift warnings.

## History

- Created 2026-05-21T11:54:53-05:00.
