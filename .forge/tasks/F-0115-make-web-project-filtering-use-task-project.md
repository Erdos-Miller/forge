---
id: F-0115
title: "Make web Project filtering use task project"
kind: task
status: done
priority: urgent
area: "web"
parent: "F-0000"
depends_on:
  - "F-0112"
  - "F-0113"
claimed_by: ""
scope:
  - "packages/web/**"
  - "packages/core/**"
  - ".forge/**"
created_at: 2026-05-21T15:37:53-05:00
updated_at: 2026-05-21T21:22:38.564Z
closed_at: 2026-05-21T21:22:38.564Z
close_reason: "Web Project filtering now uses explicit task project metadata."
blocked_reason: ""
review_reason: ""
---
# Make web Project filtering use task project

## Why

Web Project filtering should use the explicit task `project` link, not path overlap from task edit scopes.

## What success looks like

The web UI filters and renders Projects from task metadata, while Project paths remain only a fallback/diagnostic aid.

## Acceptance Criteria

- Project filter uses task `project` as the primary membership field.
- Project options come from configured Projects and tasks with known project IDs.
- Tasks without project remain visible under `All projects`.
- Path overlap is not used as the primary filter membership rule.
- Task detail shows Project, Area, and Edit scope as separate fields.
- Aggregate workspace views keep Project IDs stable per Worktree.
- Tests cover configured Projects, missing task project, unknown project, and all-worktree aggregation.

## Execution Plan

Summary: Replace path-overlap web filtering with explicit task Project filtering.

Scope: Web API payload consumption, project option building, task filtering, task detail, workspace aggregation, and tests.

Approach:
- Consume task `project` from the shared payload.
- Build Project labels from config when available and fall back to the raw project ID when a task references an unknown project.
- Keep `All projects` as the default.
- Preserve Area/Priority grouping controls.
- Update tests that previously asserted path-overlap Project membership.

Verification:
- Focused web Project filtering tests.
- `bun run harness:web`.

Stop conditions:
- Stop if task `project` is not available in the web payload.

Human review triggers:
- Ask for review if unknown project IDs should be hidden, shown, or diagnosed inline.

## Dependencies

Tracked in frontmatter: F-0112, F-0113.

## Verification

- Run focused web filtering tests.
- Run `bun run harness:web`.

## Notes

This supersedes the old Project-as-path-overlap behavior from F-0106.

Implemented explicit Project filtering in the web UI:
- `taskMatchesScope` now uses `task.project` for Project membership instead of path overlap.
- Project selector options come from configured Projects plus unknown project IDs present on tasks.
- Tasks without `project` remain visible under All projects only.
- Aggregate workspace tasks scope their `project` IDs by Worktree, matching aggregate Project option IDs.
- Task detail continues to show Project, Area, and Edit scope separately.

Verification:
- `bun test packages/web/test/scopes.test.ts packages/web/test/app.test.tsx packages/web/test/monorepo-projects.test.tsx`
- `bun run harness:web`

## History

- Created 2026-05-21T15:37:53-05:00.
