---
id: F-0093
title: "Wire worktree status into agent prompts"
kind: task
status: done
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
updated_at: 2026-05-21T18:10:04.538Z
closed_at: 2026-05-21T18:10:04.538Z
close_reason: "Wired worktree-status guidance into task prompts, loop prompt, and agent help with focused, CLI harness, and quality checks passing."
blocked_reason: ""
review_reason: ""
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

Implemented concise dirty-worktree guidance in `forge prompt`, `forge loop-prompt`, and `forge help --agent`. The guidance points agents to `forge worktree-status --json` before reacting to dirty state, and tells them to continue on `non_blocking`, pause on `review`, and stop on `blocking`.

Review trigger resolved: the prompt does not require the classifier every iteration; it requires it when dirty worktree state affects whether to continue or stop. That keeps the guidance short and avoids noisy repetition.

Verification:
- `bun test packages/cli/test/prompt-guidance.test.ts packages/cli/test/cli.test.ts` passed: 61 tests, 480 expects.
- `bun run harness:cli` passed: 7 tests, 89 expects.
- `bun run quality:check` passed: 232 tests, 1131 expects, and `packages/web` production build completed.

## History

- Created 2026-05-21T12:03:14-05:00.
