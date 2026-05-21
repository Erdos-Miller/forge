---
id: F-0116
title: "Add project migration and repair dry-run"
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
# Add project migration and repair dry-run

## Why

Forge needs a safe way to show how it would migrate legacy Project config and backfill task project links before any mutation is allowed.

## What success looks like

A dry-run command reports legacy config migration and unambiguous task project backfills in JSON without changing files.

## Acceptance Criteria

- Add a dry-run command for Project simplification/migration.
- Report `.forge/scopes.yml` to `.forge/projects.yml` migration steps.
- Report tasks that can be unambiguously assigned `project` from configured Project paths.
- Report ambiguous matches and no-match tasks separately.
- Report stale Project paths and unknown task projects.
- Do not mutate files in this task.
- Tests cover legacy config, preferred config, unambiguous backfill, ambiguity, and no-match cases.

## Execution Plan

Summary: Build observable migration planning before adding write/repair behavior.

Scope: CLI command, project matching helper, JSON contract, and tests.

Approach:
- Reuse Project config parsing from F-0113.
- Reuse task `project` support from F-0112.
- Match task scopes against Project paths only for suggestions.
- Keep output deterministic and machine-readable for agents.
- Defer `--write` or repair mutation to a later task.

Verification:
- Focused migration dry-run tests.
- `bun run harness:cli`.

Stop conditions:
- Stop if matching cannot distinguish unambiguous from ambiguous assignments.

Human review triggers:
- Ask for review before adding any mutating repair mode.

## Dependencies

Tracked in frontmatter: F-0112, F-0113.

## Verification

- Run focused migration dry-run tests.
- Run `bun run harness:cli`.

## Notes

This is intentionally non-mutating.

## History

- Created 2026-05-21T15:37:53-05:00.
