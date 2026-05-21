---
id: F-0106
title: "Wire configured Projects into web filtering"
kind: task
status: done
priority: high
area: "web"
parent: "F-0000"
depends_on:
  - "F-0103"
  - "F-0105"
claimed_by: ""
scope:
  - "packages/web/**"
  - "packages/core/**"
  - ".forge/**"
created_at: 2026-05-21T14:50:37-05:00
updated_at: 2026-05-21T20:27:58.626Z
closed_at: 2026-05-21T20:27:58.626Z
close_reason: "Wired configured Project filtering and labeled raw task globs as Edit scope."
blocked_reason: ""
review_reason: ""
---
# Wire configured Projects into web filtering

## Why

After Project config exists and inferred edit scopes are removed from the header, the web UI needs to filter by explicit configured Projects.

## What success looks like

The web header filters tasks by configured Projects while Worktree selection, Area grouping, and edit-scope detail remain separate.

## Acceptance Criteria

- Use configured Projects as the header Project filter source.
- Keep Worktree selection independent from Project selection.
- Keep Area and Priority as queue grouping controls.
- Match tasks to Projects by configured path overlap with task edit scope.
- Show raw task globs in task detail as `Edit scope`.
- Tests cover filtering, all-worktree aggregation, and unmatched tasks.

## Execution Plan

Summary: Make explicit Project config drive web filtering semantics.

Scope: Web API payload consumption, workspace aggregation, task matching, task detail labels, and tests.

Approach:
- Consume the project-compatible payload from F-0103.
- Match task edit scopes against configured Project paths.
- Preserve per-worktree Project IDs in aggregate views.
- Keep unmatched tasks visible under `All projects`.
- Update task detail copy from scope to Edit scope.

Verification:
- Focused web Project filtering tests.
- `bun run harness:web`.
- `bun run quality:check` if shared payloads change.

Stop conditions:
- Stop if aggregate Project IDs are not stable enough for URL/filter state.

Human review triggers:
- Ask for review if unmatched tasks need their own visible Project bucket.

## Dependencies

Tracked in frontmatter: F-0103, F-0105.

## Verification

- Run focused web filtering tests.
- Run `bun run harness:web`.

## Notes

This task should not reintroduce inferred folder Projects.

Implemented and audited configured Project filtering.

Changes:
- The task detail footer now labels raw task globs as `Edit scope ...`, keeping Project filtering separate from edit-boundary data.
- Added coverage for unmatched tasks: they remain visible under `All projects` and are hidden when a specific configured Project filter is selected.

Audit against acceptance criteria:
- Configured Projects are the header Project filter source from the project-compatible payload.
- Worktree selection remains independent from Project selection.
- Area and Priority remain queue grouping controls.
- Task matching uses configured path overlap against task edit scopes.
- Aggregate all-worktree Project IDs remain root-qualified and stable via existing `root::project` IDs.

Closeout trigger review:
- Stop condition did not fire: aggregate Project IDs are already stable and covered by all-worktree tests.
- Human review trigger did not fire: unmatched tasks stay visible under `All projects`; no separate visible bucket was added.

Verification:
- `bun test packages/web/test/app.test.tsx packages/web/test/scopes.test.ts` passed: 42 tests.
- `bun test packages/web/test/api.test.ts` passed: 15 tests.
- `bun run harness:web` passed: 70 tests.

## History

- Created 2026-05-21T14:50:37-05:00.
