---
id: F-0025
title: Wire guidance into prompt
kind: task
status: done
priority: high
parent: F-0000
depends_on:
  - F-0021
  - F-0023
  - F-0032
claimed_by: ""
area: cli
scope:
  - packages/cli/**
  - packages/core/**
  - .forge/tasks/**
created_at: 2026-05-15T00:00:00-05:00
updated_at: 2026-05-15T15:17:03.569Z
closed_at: 2026-05-15T15:17:03.569Z
close_reason: "Prompt guidance wiring implemented and verified"
blocked_reason: ""
review_reason: ""
---

# Wire guidance into prompt

## Why

`forge prompt` should produce a goal-mode prompt that includes not only task content, but also the guidance relevant to the task's area and scope.

## What success looks like

`forge prompt <id|next>` includes matched guidance file paths and prompt summaries by default, with an option to include full guidance.

## Acceptance Criteria

- `forge prompt <id>` resolves guidance for the selected task.
- `forge prompt next` resolves guidance for the selected next task.
- Prompt output includes matched guidance paths and `Prompt Summary` excerpts by default.
- A full-guidance flag includes full matched guidance content.
- Prompt behavior remains read-only.
- Tests cover next task guidance, explicit task guidance, no guidance config, and full guidance mode.

## Dependencies

Depends on `F-0021` for the prompt command, `F-0023` for guidance resolution, and `F-0032` so prompt output can account for the stored execution plan convention.

## Verification

- Run `bun test` in `packages/core` and `packages/cli`.
- Smoke-check `forge prompt next` in a temp repo with matching guidance files.

## Notes

Keep prompt output usable for agents. Prefer concise summaries by default.

Implementation decision: forge prompt now resolves guidance for the selected task id after next-task selection or explicit task lookup. Default prompt output includes matched guidance paths, reasons, and Prompt Summary excerpts; --full includes full matched guidance content. Missing guidance config is reported in a Guidance diagnostics section without failing the read-only prompt command.

Updated prompt usage, examples, command metadata, and tests for next task guidance, explicit task guidance, missing guidance config, full guidance mode, and invalid usage.

Verification:
- bun test packages/cli passed with 64 tests, including temp-repo prompt guidance coverage.
- bun test packages/core packages/cli passed with 124 tests.
- bun run quality:check passed with 139 tests and the web production build.

## History

- Created 2026-05-15T00:00:00-05:00.
- Updated to depend on the execution plan section convention.
