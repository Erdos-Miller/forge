---
id: F-0120
title: "Add explicit task Project doctor checks"
kind: task
status: open
priority: high
area: "cli"
parent: "F-0000"
depends_on:
  - "F-0112"
  - "F-0113"
claimed_by: ""
scope:
  - "packages/cli/**"
  - "packages/core/**"
  - ".forge/**"
created_at: 2026-05-21T15:37:53-05:00
updated_at: 2026-05-21T15:37:53-05:00
---
# Add explicit task Project doctor checks

## Why

The active F-0107 task was planned around Project config path matching. The simplified model needs doctor checks for explicit task `project` links.

## What success looks like

`forge doctor --json` reports clear advisory diagnostics for unknown task projects, missing task projects, project/scope drift, and legacy config usage.

## Acceptance Criteria

- Warn when a task references an unknown `project`.
- Warn when a task has no `project` but its edit scope clearly matches one configured Project.
- Warn when task `project` and task `scope` obviously disagree with configured Project paths.
- Warn when configured Projects match no active tasks.
- Warn on deprecated legacy `.forge/scopes.yml` usage while preserving read compatibility.
- Include machine-readable diagnostic codes and repair hints.
- Tests cover unknown project, missing project suggestion, drift, stale config, legacy config, and clean config.

## Execution Plan

Summary: Add doctor diagnostics for the explicit task Project model.

Scope: Doctor checks, Project config loading, task `project` matching helpers, and tests.

Approach:
- Reuse the Project parser and task `project` field from F-0112/F-0113.
- Keep unparseable config as an error.
- Keep stale, missing, drifted, or legacy config as warnings.
- Provide repair hints that point to `forge projects` and migration dry-run commands.
- Avoid warnings in repos with no Project config.

Verification:
- Focused doctor tests.
- `bun run harness:cli`.

Stop conditions:
- Stop if project/scope drift warnings are too noisy for broad repo-wide tasks.

Human review triggers:
- Ask for review if doctor should require Projects in repos with Project config.

## Dependencies

Tracked in frontmatter: F-0112, F-0113.

## Verification

- Run focused doctor project tests.
- Run `bun run harness:cli`.

## Notes

This task supersedes the path-overlap-only doctor direction if F-0107 lands first.

## History

- Created 2026-05-21T15:37:53-05:00.
