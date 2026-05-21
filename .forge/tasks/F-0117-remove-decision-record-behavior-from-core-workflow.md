---
id: F-0117
title: "Remove decision-record behavior from core workflow"
kind: task
status: done
priority: high
area: "cli"
parent: "F-0000"
depends_on:
  - "F-0111"
claimed_by: ""
scope:
  - "packages/cli/**"
  - ".forge/**"
  - "README.md"
  - "AGENTS.md"
created_at: 2026-05-21T15:37:53-05:00
updated_at: 2026-05-21T21:40:03.520Z
closed_at: 2026-05-21T21:40:03.520Z
close_reason: "Removed decision-record workflow behavior and verified CLI harness."
blocked_reason: ""
review_reason: ""
---
# Remove decision-record behavior from core workflow

## Why

Forge should not require or promote `.forge/decisions` as part of task management. Architecture and harness policy belong to repo docs or agent instructions, not the task-store contract.

## What success looks like

Forge prompts, doctor, closeout, and docs stop requiring `.forge/decisions` while preserving task Notes for task-local evidence.

## Acceptance Criteria

- Remove prompt guidance that tells agents to create `.forge/decisions` records.
- Remove doctor warnings that require decision capture.
- Remove closeout checks that ask for `.forge/decisions`.
- Keep task Notes guidance for execution evidence, blockers, verification, and local task decisions.
- Keep existing historical `.forge/decisions` files untouched.
- Tests cover removed doctor warnings and updated prompt/closeout text.

## Execution Plan

Summary: Narrow Forge's workflow back to task management and stop making decision records a product primitive.

Scope: CLI prompts, doctor diagnostics, closeout guidance, docs, and tests.

Approach:
- Remove decision-capture-specific diagnostics.
- Replace decision-record prompt text with task-note evidence guidance.
- Update docs to say external repo docs may be linked from tasks but are not managed by Forge.
- Keep compatibility with existing task files that mention decisions.

Verification:
- Focused prompt, doctor, and closeout tests.
- `bun run harness:cli`.

Stop conditions:
- Stop if removing diagnostics hides required task completion metadata unrelated to decisions.

Human review triggers:
- Ask for review if any decision-record behavior is still needed for Forge's own development repo only.

## Dependencies

Tracked in frontmatter: F-0111.

## Verification

- Run focused prompt/doctor/closeout tests.
- Run `bun run harness:cli`.

## Notes

This removes product behavior, not historical files.

Removed decision-record product behavior:

- Removed `decision_capture_*` doctor diagnostics.
- Removed closeout `decision_capture` advisory text that referenced `.forge/decisions`.
- Updated docs to say Forge does not require or manage decision records.
- Kept historical `.forge/decisions` files untouched.
- Kept task Notes as the place for task-local evidence, blockers, verification, and decisions.

Verification:

- `bun test packages/cli/test/decision-doctor.test.ts packages/cli/test/closeout.test.ts packages/cli/test/prompt-guidance.test.ts`
- `bun test packages/core/test/readability-ratchet.test.ts`
- `bun run harness:cli`
- `forge doctor --json` reports only expected dirty-worktree warnings for F-0117 before commit.

## History

- Created 2026-05-21T15:37:53-05:00.
