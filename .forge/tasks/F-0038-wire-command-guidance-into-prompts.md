---
id: F-0038
title: Wire command guidance into prompts
kind: task
status: done
priority: high
parent: F-0000
depends_on:
  - F-0025
  - F-0036
  - F-0037
claimed_by: ""
area: cli
scope:
  - packages/cli/**
  - .forge/tasks/**
created_at: 2026-05-15T00:00:00-05:00
updated_at: 2026-05-15T15:46:00.829Z
closed_at: 2026-05-15T15:46:00.829Z
close_reason: "Command guidance wired into prompts and verified"
blocked_reason: ""
review_reason: ""
---

# Wire command guidance into prompts

## Why

`forge prompt` and `forge loop-prompt` should teach agents the current command surface without duplicating command lists that can drift.

## What success looks like

Prompt output includes generated command guidance from the registry and clearly tells agents when to prefer structured commands versus direct Markdown edits.

## Acceptance Criteria

- Update `forge prompt <id|next>` to include generated command guidance from the registry.
- Update `forge loop-prompt` to include generated command guidance from the registry.
- Guidance favors structured commands for frontmatter, dependency, lifecycle, and plan writes.
- Guidance allows direct Markdown editing for rich task body content that no command owns.
- Prompt output remains concise enough for goal-mode use.
- Tests prove prompts source command names from metadata rather than hard-coded command lists.

## Execution Plan

Summary: Add generated command guidance to prompt output.

Scope: packages/cli prompt composition and prompt guidance tests.

Approach:
- Generate a compact command guidance block from COMMANDS and workflow metadata.
- Append it to forge prompt and forge loop-prompt.
- Test prompt output against command metadata rather than duplicated command strings.

Verification:
- bun test packages/cli
- bun run quality:check
- Smoke-check forge prompt next and forge loop-prompt

Stop conditions:
- Stop if the prompt became a stale hand-written command list.

Human review triggers:
- None.

## Dependencies

Depends on `F-0025` for guidance-aware prompts, `F-0036` for command metadata, and `F-0037` for the agent command guidance shape.

## Verification

- Run `bun test packages/cli`.
- Run `bun run quality:check`.
- Smoke-check `forge prompt next` and `forge loop-prompt`.

## Notes

This task should not add new commands. It only changes prompt composition.

Implemented generated command guidance for `forge prompt <id|next>` and `forge loop-prompt`. The guidance is built from the command metadata registry and workflow map, and it tells agents to prefer structured commands for command-owned writes while allowing direct Markdown edits for rich task body content no command owns.

Verification passed:
- bun test packages/cli
- bun run quality:check
- Smoke: bun packages/cli/src/index.ts prompt next showed Command guidance and the generated command surface.
- Smoke: bun packages/cli/src/index.ts loop-prompt showed Command guidance and the generated command surface.

## History

- Created 2026-05-15T00:00:00-05:00.
