---
id: F-0093
title: "Wire worktree status into agent prompts"
kind: task
status: open
priority: high
area: "cli"
parent: "F-0000"
depends_on:
  - "F-0092"
claimed_by: ""
scope:
  - "packages/cli/**"
  - ".forge/**"
  - "AGENTS.md"
created_at: 2026-05-21T12:03:14-05:00
updated_at: 2026-05-21T12:03:14-05:00
---
# Wire worktree status into agent prompts

## Why

The command only helps if agents are told to use it before stopping on unrelated planner changes.

## What success looks like

Agent-facing prompts and command help tell workers to classify dirty worktree state before deciding whether to continue, pause, or stop.

## Acceptance Criteria

- Update `forge prompt` guidance to mention `forge worktree-status --json`.
- Update `forge loop-prompt` guidance to include the dirty-worktree decision loop.
- Update `forge help --agent` so the command is discoverable.
- Tell agents to continue on `non_blocking`, pause on `review`, and stop on `blocking`.
- Keep prompt output concise and avoid duplicating the full policy text.
- Add or update tests that lock the guidance in place.

## Execution Plan

Summary: Thread the classifier into the worker loop guidance.

Scope: CLI prompt generation, command metadata, help output, and prompt tests.

Approach:
- Reference F-0091's policy without repeating every example.
- Put the command near claim/start guidance so agents see it before editing.
- Keep the loop guidance action-oriented.
- Preserve existing prompt structure and task context.
- Update snapshots or focused string assertions.

Verification:
- Focused prompt and help tests.
- `bun run harness:cli`.

Stop conditions:
- Stop if prompt output becomes noticeably noisy or repeats the same instruction in multiple adjacent places.

Human review triggers:
- Ask for review if the prompt should require the command every iteration rather than only before reacting to dirty state.

## Dependencies

Tracked in frontmatter: F-0092.

## Verification

- Run focused prompt/help tests.
- Run `bun run harness:cli`.

## Notes

The guidance should make unrelated planner work safe without training agents to ignore real conflicts.

## History

- Created 2026-05-21T12:03:14-05:00.
