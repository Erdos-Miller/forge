---
id: F-0095
title: "Add planner-ahead worker-continuation harness"
kind: task
status: open
priority: high
area: "test"
parent: "F-0000"
depends_on:
  - "F-0092"
  - "F-0093"
claimed_by: ""
scope:
  - "packages/cli/**"
  - "packages/core/**"
  - ".forge/**"
created_at: 2026-05-21T12:03:14-05:00
updated_at: 2026-05-21T12:03:14-05:00
---
# Add planner-ahead worker-continuation harness

## Why

The shared planner/worker workflow needs a regression test so future changes do not bring back the over-broad dirty-worktree stop condition.

## What success looks like

The harness proves that planner-created future tasks do not block a worker, while dirty files relevant to the worker still do.

## Acceptance Criteria

- Add a fixture where a claimed worker task can continue while unrelated future task files are dirty.
- Add a fixture where a dirty implementation file inside the claimed task scope is blocking.
- Add a fixture where the claimed task file or dependency-chain task file requires review.
- Assert the behavior through the public CLI where practical.
- Include prompt guidance coverage if the harness exercises the loop prompt.
- Document the scenario in harness guidance or task notes.

## Execution Plan

Summary: Lock the intended planner-ahead workflow into a focused harness.

Scope: CLI harness tests, fixture helpers, and harness documentation.

Approach:
- Reuse existing fixture repo builders.
- Create one claimed worker task and one or more future planner tasks.
- Dirty task files and implementation files deliberately in the fixture.
- Assert `worktree-status`, prompt guidance, and diagnostic behavior stay aligned.
- Keep the test isolated under temporary directories.

Verification:
- Focused planner/worker harness test.
- `bun run harness:cli`.

Stop conditions:
- Stop if the test needs to inspect the developer's real worktree.

Human review triggers:
- Ask for review if the scenario should become part of `harness:check` gating beyond CLI tests.

## Dependencies

Tracked in frontmatter: F-0092, F-0093.

## Verification

- Run the focused planner/worker harness test.
- Run `bun run harness:cli`.

## Notes

This task should prevent regressions in the workflow that motivated the classifier.

## History

- Created 2026-05-21T12:03:14-05:00.
