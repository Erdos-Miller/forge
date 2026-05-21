---
id: F-0107
title: "Add project config doctor checks"
kind: task
status: done
priority: medium
area: "cli"
parent: "F-0000"
depends_on:
  - "F-0103"
claimed_by: ""
scope:
  - "packages/cli/**"
  - "packages/core/**"
  - ".forge/**"
created_at: 2026-05-21T14:50:37-05:00
updated_at: 2026-05-21T20:42:21.751Z
closed_at: 2026-05-21T20:42:21.751Z
close_reason: "Added Project config doctor diagnostics and repair hints."
blocked_reason: ""
review_reason: ""
---
# Add project config doctor checks

## Why

Project config becomes a durable navigation surface, so Forge should warn when it is malformed, stale, or using legacy language.

## What success looks like

`forge doctor --json` reports clear advisory diagnostics for Project config problems.

## Acceptance Criteria

- Warn on invalid project IDs, empty labels, empty paths, and duplicate paths.
- Warn when configured Projects match no active tasks.
- Warn when active task edit scopes match no configured Project if project config exists.
- Warn on deprecated legacy `scopes` usage while preserving compatibility.
- Include machine-readable diagnostic codes and repair hints.
- Tests cover parse errors, advisory warnings, and clean config.

## Execution Plan

Summary: Extend doctor diagnostics to protect the Project navigation model.

Scope: Doctor checks, core config validation reuse, and tests.

Approach:
- Reuse F-0103 parsing and validation behavior.
- Keep unparseable config as an error.
- Keep stale or legacy config as warnings.
- Provide repair hints that point to `forge projects` commands.
- Avoid warnings in repos with no project config.

Verification:
- Focused doctor tests.
- `bun run harness:cli`.

Stop conditions:
- Stop if warnings would fire for every no-config repo.

Human review triggers:
- Ask for review if unmatched task warnings are too noisy for broad repo-wide tasks.

## Dependencies

Tracked in frontmatter: F-0103.

## Verification

- Run focused doctor project config tests.
- Run `bun run harness:cli`.

## Notes

Doctor should guide cleanup without making Project config mandatory.

Implemented Project config doctor diagnostics.

Changes:
- Malformed Project config now returns `project_config_invalid` doctor errors instead of escaping the doctor flow.
- Added Project-facing warning codes for empty config, unmatched active tasks, unused Projects, unused Project paths, overlapping Projects, and legacy `scopes:` usage.
- Repair hints now point to `forge projects` commands.
- Repos without Project config remain warning-free.
- Legacy `scopes:` files remain compatible but receive an advisory warning.

Validation covered:
- Invalid project ids.
- Empty labels.
- Empty paths.
- Duplicate paths.
- Clean configured Projects.
- Advisory stale/legacy/unmatched cases.

Decisions:
- Malformed config is an error because the file cannot be trusted.
- Stale, unmatched, overlapping, and legacy config are warnings because Project config is advisory navigation data.
- Stop condition did not fire: no warnings are emitted for repos without Project config.
- Human review trigger did not fire: unmatched-task warnings are scoped to repos that already opted into Project config.

Verification:
- `bun test packages/cli/test/scope-doctor.test.ts packages/cli/test/cli.test.ts` passed: 63 tests.
- `bun run harness:cli` passed: 8 tests.

## History

- Created 2026-05-21T14:50:37-05:00.
