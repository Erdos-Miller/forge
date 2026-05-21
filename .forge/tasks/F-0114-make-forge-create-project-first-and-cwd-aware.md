---
id: F-0114
title: "Make forge create project-first and cwd-aware"
kind: task
status: open
priority: urgent
area: "cli"
parent: "F-0000"
depends_on:
  - "F-0112"
  - "F-0113"
claimed_by: ""
scope:
  - "packages/cli/**"
  - "packages/core/**"
  - ".forge/**"
created_at: 2026-05-21T15:37:53-05:00
updated_at: 2026-05-21T15:37:53-05:00
---
# Make forge create project-first and cwd-aware

## Why

Creating a task should feel like naming the work, not typing long path globs to make the UI organize it.

## What success looks like

Users can create tasks with `--project`, and Forge can infer the project from cwd when there is one clear match.

## Acceptance Criteria

- Support `forge create "Title" --project <id> --area <area>`.
- Continue supporting the existing explicit-id create form for compatibility.
- If cwd is inside exactly one configured Project path, default `project` for new tasks.
- If multiple Projects match cwd, fail with a clear message listing candidate project IDs.
- If no Project matches cwd, allow task creation without project unless `--project` is provided.
- Allow `--scope` as optional edit-boundary narrowing; do not require it for project organization.
- Add JSON output showing whether project was explicit, inferred, or unset.
- Tests cover explicit project, inferred project, ambiguous cwd, no match, and invalid project.

## Execution Plan

Summary: Make task creation use Project names and cwd context as the primary DX.

Scope: CLI create args, project resolution helper, task writer integration, docs/help, and tests.

Approach:
- Add create args for title-first task creation if not already supported.
- Resolve explicit `--project` before cwd inference.
- Match cwd against Project paths relative to the Forge root.
- Keep existing create behavior backward-compatible.
- Leave auto-ID improvements to a separate task unless already available.

Verification:
- Focused create command tests.
- `bun run harness:cli`.

Stop conditions:
- Stop if cwd inference cannot be made deterministic for overlapping Projects.

Human review triggers:
- Ask for review if create should require project in repos with Project config.

## Dependencies

Tracked in frontmatter: F-0112, F-0113.

## Verification

- Run focused create DX tests.
- Run `bun run harness:cli`.

## Notes

Project is the organizational link. `scope` remains an edit-boundary refinement.

## History

- Created 2026-05-21T15:37:53-05:00.
