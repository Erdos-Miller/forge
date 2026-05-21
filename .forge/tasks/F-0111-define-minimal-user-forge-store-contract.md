---
id: F-0111
title: "Define minimal user Forge store contract"
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
created_at: 2026-05-21T15:37:53-05:00
updated_at: 2026-05-21T15:37:53-05:00
---
# Define minimal user Forge store contract

## Why

Forge should not litter user repos with product docs, harness docs, or decision-record systems. User `.forge` stores should stay focused on task state and project config.

## What success looks like

Forge documents a minimal user store contract and separates Forge's own development docs from the user repo storage model.

## Acceptance Criteria

- Define the user repo store as `.forge/tasks/`, `.forge/projects.yml`, optional `.forge/archive/`, and ignored `.forge/local/`.
- State that `.forge/README.md`, `.forge/harness-engineering.md`, and `.forge/decisions/` are not part of the user store contract.
- Preserve one canonical `.forge` store per repo/worktree root.
- Clarify that Forge repo development docs may live in normal repo docs or `AGENTS.md`, outside the user store contract.
- Update docs and prompt references that imply arbitrary user repos should contain `.forge/harness-engineering.md`.
- Keep existing historical Forge repo files intact unless a later cleanup task moves them.

## Execution Plan

Summary: Draw the storage boundary before adding task `project`, archive, and migration support.

Scope: Product docs, agent guidance, and any command help text that describes the `.forge` directory.

Approach:
- Document the minimal user `.forge` contract.
- Remove decision-record and harness-doc requirements from the user-store description.
- Keep task Notes as task-local evidence, blockers, and verification.
- Mention local runtime state only under ignored `.forge/local/`.
- Avoid moving files in this task unless needed for documentation consistency.

Verification:
- Manual docs review.
- Focused prompt/help tests if references change.

Stop conditions:
- Stop if this requires deleting historical Forge repo docs or completed task evidence.

Human review triggers:
- Ask for review if any non-task file remains in the proposed user store contract besides `projects.yml`.

## Dependencies

None.

## Verification

- Review the storage contract docs.
- Run focused prompt/help tests if changed.

## Notes

This task defines the boundary only. Migration and file movement belong to follow-up tasks.

## History

- Created 2026-05-21T15:37:53-05:00.
