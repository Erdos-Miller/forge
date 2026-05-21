---
id: F-0080
title: "Define workspace terminology and decision record"
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
created_at: 2026-05-21T11:54:53-05:00
updated_at: 2026-05-21T11:54:53-05:00
---
# Define workspace terminology and decision record

## Why

Workspace mode overloaded `scope` and `area`, which makes the UI and future agent work ambiguous.

## What success looks like

Forge has a durable terminology decision that separates Worktree, Scope, Area, Priority, and task edit scope, plus a lightweight convention for recording cross-cutting decisions.

## Acceptance Criteria

- Define Worktree as the Forge root, repo, or worktree selected in the web UI.
- Define UI Scope as a user-facing work slice inside a selected worktree.
- Define Area as task category or work type, such as `web`, `cli`, `core`, `docs`, or `test`.
- Define task frontmatter `scope` as edit-boundary globs, not the header Scope filter.
- Add or document a lightweight decision-record convention for durable product and architecture choices.
- Clarify when agents should use task `Notes` versus a durable decision record.

## Execution Plan

Summary: Record the terminology and decision-capture foundation before changing filters or scope tooling.

Scope: Forge docs, decision-record convention, and any prompt guidance text that names these concepts.

Approach:
- Add a concise decision record for workspace terminology.
- Update Forge docs to distinguish UI Scope from task edit scope.
- Define the minimal decision-record shape: context, decision, alternatives, consequences, and related tasks.
- Keep task `Notes` as the place for implementation evidence and local task decisions.
- Reference durable decision records for cross-cutting semantics that future agents must preserve.

Verification:
- `bun run quality:check` if prompt or rendered docs behavior changes.
- Manual docs review for terminology consistency.

Stop conditions:
- Stop if the terminology implies a task frontmatter schema migration.

Human review triggers:
- Ask for review if the UI label should change from Scope to another user-facing word.

## Dependencies

None.

## Verification

- Review terminology docs for consistency.
- Run `bun run quality:check` if any tested prompt or docs behavior changes.

## Notes

This task should not change runtime filter behavior. It records the language future tasks must implement.

## History

- Created 2026-05-21T11:54:53-05:00.
