---
id: F-0101
title: "Define workspace/worktree/project/area terminology"
kind: task
status: open
priority: urgent
area: "docs"
parent: "F-0000"
depends_on: []
claimed_by: ""
scope:
  - ".forge/**"
  - "README.md"
  - "AGENTS.md"
created_at: 2026-05-21T14:50:37-05:00
updated_at: 2026-05-21T14:50:37-05:00
---
# Define workspace/worktree/project/area terminology

## Why

Forge currently uses Scope for both user-facing navigation and task edit-boundary globs. That makes monorepo work confusing and causes project-like concepts to be inferred from folders.

## What success looks like

Forge documents a clear hierarchy: Workspace, Worktree, Project, Area, Task, and task edit scope.

## Acceptance Criteria

- Define Workspace as the multi-root view launched from a parent directory.
- Define Worktree as one discovered Forge root, repository, or checkout.
- Define Project as an explicit work slice inside a Worktree.
- Define Area as a task category such as `web`, `core`, `docs`, `test`, or `harness`.
- Define task `scope` as edit-boundary globs only.
- Preserve one canonical `.forge` store per repo/worktree root as the default storage model.
- Explain why nested `.forge` stores remain out of scope for now.

## Execution Plan

Summary: Update the durable terminology foundation before renaming UI and config surfaces.

Scope: Forge docs, decision records, and agent guidance that names these concepts.

Approach:
- Update the terminology decision to replace UI Scope with Project.
- Document the hierarchy as Workspace > Worktree > Project > Area > Task.
- Clarify that task frontmatter `scope` remains unchanged.
- Keep repo-root `.forge` as the canonical task graph and explain the dependency-graph reason.
- Add examples for Forge and a monorepo-style repo.

Verification:
- Manual docs review for terminology consistency.
- `bun run quality:check` if tested prompt or docs output changes.

Stop conditions:
- Stop if the terminology change implies a task frontmatter schema migration.

Human review triggers:
- Ask for review if nested `.forge` stores are proposed as part of the terminology update.

## Dependencies

None.

## Verification

- Review updated docs and decision records.
- Run focused tests only if prompt output or checked docs behavior changes.

## Notes

This task is terminology-only. It should not change runtime filtering behavior.

## History

- Created 2026-05-21T14:50:37-05:00.
