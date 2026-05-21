---
id: F-0126
title: "Add task creation DX dogfood harness"
kind: task
status: done
priority: urgent
project: "forge"
area: "test"
parent: "F-0000"
depends_on:
  - "F-0121"
claimed_by: ""
scope:
  - "packages/cli/**"
  - "packages/core/**"
  - "package.json"
  - ".forge/tasks/**"
created_at: 2026-05-21T22:33:31.764Z
updated_at: 2026-05-21T22:51:25.753Z
closed_at: 2026-05-21T22:51:25.753Z
close_reason: ""
blocked_reason: ""
review_reason: ""
---
# Add task creation DX dogfood harness

## Why

The agent hand-authored task files instead of using forge create, which suggests the current CLI may not be ergonomic for Forge's main agent workflow.

## What success looks like

Forge has a repeatable harness that compares structured CLI creation against direct Markdown authoring for a realistic multi-task plan.

## Acceptance Criteria

- Add an internal dogfood benchmark fixture with a realistic multi-task plan.
- Measure forge create plus existing follow-up commands against direct Markdown authoring for the same expected final graph.
- Capture command count, operation count or elapsed time, doctor diagnostics, missing sections, follow-up edits, and task readability completeness.
- Add a focused harness command or include the check in harness:cli if it is fast and deterministic.
- Report where forge create loses to hand editing without blessing hand editing as the normal path.
- Include a regression case showing current forge create does not directly support rich execution-plan creation in one step.

## Execution Plan

Summary: Build a dogfood harness that measures whether agents can create rich Forge tasks more safely and efficiently through Forge commands than by hand-editing Markdown.

Scope: CLI create workflow tests, fixture task data, benchmark-style metrics, and harness script wiring.

Approach:
- Define a realistic 3-5 task planning fixture with dependencies, priorities, Project, Area, scopes, why/success, acceptance criteria, verification, notes, and execution-plan text.
- Run the fixture through the structured CLI path using `forge create` plus existing follow-up commands such as `forge plan`.
- Build the same expected task graph through direct Markdown authoring in an isolated fixture repo as a baseline, but do not document that baseline as a recommended workflow.
- Compare the two paths for command/tool-call count, deterministic operation count or elapsed time, doctor diagnostics, missing required sections, follow-up edits, and task readability completeness.
- Produce concise failure output that says exactly which capability made the CLI path worse than hand editing.
- If the harness shows the CLI path cannot create rich tasks cleanly, leave follow-up recommendations in the task notes or test output rather than implementing a new import command in this task.

Verification:
- Focused create DX harness tests.
- `bun run harness:cli`.

Stop conditions:
- Stop if the benchmark becomes timing-flaky; switch to deterministic operation counts and quality scores.
- Stop if the task starts implementing a new rich create/import interface instead of measuring the current one.

Human review triggers:
- Ask for review if the scoring rubric would make hand editing look like an endorsed normal workflow.

## Dependencies

Tracked in frontmatter: F-0121.

## Verification

- bun run harness:cli
- Focused create DX harness tests

## Notes

Measure first; follow-up tasks should improve CLI creation if the harness proves the current command path is clumsy.

- Added `packages/cli/test/create-dx-harness.test.ts` as a deterministic dogfood harness for rich task creation.
- Wired the new harness into `bun run harness:cli`.
- The harness compares a realistic three-task plan created through Forge commands against direct Markdown fixture authoring, then checks graph parity, doctor diagnostics, required sections, command count, operation count, follow-up edits, and task count.
- Current measured gap: structured path uses 6 commands and 3 follow-up plan edits; direct fixture authoring uses 1 operation. The report says `forge create loses one-step parity when rich Execution Plan content is required.`
- Added regression coverage that `forge create ... --plan` is currently rejected with `unknown create option: --plan`, proving rich execution plans are not one-step creation fields yet.
- The report uses direct Markdown only as a baseline measurement, not as recommended workflow guidance.
Verification:
- `bun test packages/cli/test/create-dx-harness.test.ts`
- `bun run harness:cli`
- `bun test packages/core/test/readability-ratchet.test.ts`

## History

- Created 2026-05-21T22:33:31.764Z.
