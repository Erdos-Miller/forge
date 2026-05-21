---
id: F-0091
title: "Define planner/worker dirty-worktree policy"
kind: task
status: done
priority: urgent
area: "docs"
parent: "F-0000"
depends_on:
  - "F-0080"
claimed_by: ""
scope:
  - ".forge/**"
  - "AGENTS.md"
created_at: 2026-05-21T12:03:14-05:00
updated_at: 2026-05-21T17:10:38.175Z
closed_at: 2026-05-21T17:10:38.175Z
close_reason: ""
blocked_reason: ""
review_reason: ""
---
# Define planner/worker dirty-worktree policy

## Why

Planner agents should be able to create and refine future task files while a worker agent keeps implementing its current claimed task. A generic dirty worktree should not automatically stop the worker.

## What success looks like

Forge has clear guidance for when dirty files are blocking, non-blocking, or require review in a shared planner/worker worktree.

## Acceptance Criteria

- Define `blocking`, `non_blocking`, and `review` dirty-change classes.
- Document that unrelated future task files and unclaimed planning notes are not a worker stop condition.
- Document that dirty files inside the current task scope are blocking unless the worker made them intentionally.
- Document that changes to the claimed task file or dependency path require review.
- Document how shared manifests, central exports, generated files, and root config should be handled.
- Update agent guidance so workers stop for relevant conflicts, not for all dirty worktree state.

## Execution Plan

Summary: Establish the coordination policy before adding commands that enforce or surface it.

Scope: Forge docs, agent guidance, and task workflow guidance.

Approach:
- Use the terminology from F-0080.
- Write the policy around claimed task, task file, dependency graph, task scope, and shared files.
- Keep the policy small enough for agents to remember.
- Make the default worker behavior continue on unrelated planning changes.
- Record any cross-cutting terminology decision in the documented decision-record location.

Verification:
- Manual review of the updated guidance.
- `bun run harness:cli` if prompt or command guidance fixtures change.

Stop conditions:
- Stop if the policy requires new task frontmatter fields before tooling exists.

Human review triggers:
- Ask for review if the policy would allow workers to ignore dirty implementation files outside their declared task scope.

## Dependencies

Tracked in frontmatter: F-0080.

## Verification

- Review docs and agent guidance for consistency.
- Run focused prompt tests if any prompt text changes.

## Notes

This task defines behavior only. It should not add the classification command.

Decision: Added `.forge/decisions/0002-dirty-worktree-coordination.md` to classify dirty files as `blocking`, `non_blocking`, or `review` relative to the current claimed task.

Decision: Updated AGENTS.md and `.forge/README.md` so workers continue through unrelated future task files and planning notes, stop for unexpected dirty files inside the claimed task scope, and seek review for claimed task files, dependency task files, manifests, root config, generated files, and central exports unless the task explicitly owns them.

Verification:
- Manual docs review for consistency across AGENTS.md, `.forge/README.md`, and the new decision record.
- bun packages/cli/src/index.ts doctor --json: 0 errors, 0 warnings.
- bun run quality:check: 210 pass, 1029 expect() calls, web production build passed.

## History

- Created 2026-05-21T12:03:14-05:00.
