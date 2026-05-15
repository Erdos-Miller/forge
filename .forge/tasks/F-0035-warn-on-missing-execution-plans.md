---
id: F-0035
title: Warn on missing execution plans
kind: task
status: done
priority: medium
parent: F-0000
depends_on:
  - F-0016
  - F-0032
claimed_by: ""
area: cli
scope:
  - packages/core/**
  - packages/cli/**
  - .forge/tasks/**
created_at: 2026-05-15T00:00:00-05:00
updated_at: 2026-05-15T16:22:16.648Z
closed_at: 2026-05-15T16:22:16.648Z
close_reason: "Verified execution-plan doctor warning tests, quality check, and temp-store smoke."
blocked_reason: ""
review_reason: ""
---

# Warn on missing execution plans

## Why

Forge should nudge agents to plan active work in detail, but the warning should not become a hard blocker while the workflow is still maturing.

## What success looks like

Doctor or queue diagnostics report an advisory warning when active task work has no `## Execution Plan` section.

## Acceptance Criteria

- Add an advisory diagnostic for claimed or `doing` tasks without `## Execution Plan`.
- Do not warn for unclaimed open tasks.
- Do not fail an otherwise clean doctor run solely because of this advisory warning.
- Include task id, source path, and a clear message naming `forge plan <id> --stdin`.
- Tests cover claimed-without-plan, doing-without-plan, open-unclaimed-without-plan, and active-with-plan behavior.

## Execution Plan

1. Add a doctor warning for active tasks (`doing` or claimed) whose Markdown body lacks `## Execution Plan`.
2. Keep the diagnostic advisory: warning severity, code 0 when it is the only finding, with task id, source path, and a repair hint naming `forge plan <id> --stdin`.
3. Add focused CLI tests for claimed without plan, doing without plan, open unclaimed without plan, and active with plan.
4. Verify with package tests, quality check, and a temp-store doctor smoke.

## Dependencies

Depends on `F-0016` for doctor diagnostics and `F-0032` for the section convention.

## Verification

- Run `bun test packages/core packages/cli`.
- Run `bun run quality:check`.
- Smoke-check doctor output on a fixture with one planned active task and one unplanned active task.

## Notes

Keep this advisory. Do not make missing plans block completion or claiming.

Implemented advisory doctor diagnostics for active tasks without `## Execution Plan`. The warning applies to `doing` or claimed tasks, includes the task id and source path, names `forge plan <id> --stdin`, and does not make doctor fail when it is the only finding.

Verification:
- `bun test packages/cli/test/execution-plan-doctor.test.ts`
- `bun test packages/core packages/cli`
- `bun run quality:check`
- Temp-store smoke at `/private/tmp/forge-plan-doctor-smoke-1Eq7fM` reported one `missing_execution_plan` warning for the unplanned active task and exited 0.

## History

- Created 2026-05-15T00:00:00-05:00.
