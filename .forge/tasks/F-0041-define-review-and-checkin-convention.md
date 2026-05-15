---
id: F-0041
title: Define review and check-in convention
kind: task
status: done
priority: medium
parent: F-0000
depends_on:
  - F-0032
claimed_by: ""
area: docs
scope:
  - .forge/README.md
  - AGENTS.md
  - .forge/tasks/**
created_at: 2026-05-15T00:00:00-05:00
updated_at: 2026-05-15T15:57:02.067Z
closed_at: 2026-05-15T15:57:02.067Z
close_reason: "Verified docs consistency and quality check."
blocked_reason: ""
review_reason: ""
---

# Define review and check-in convention

## Why

Agents need clear guidance for when a task is done, when it needs human review, and what evidence belongs in the task file before closeout.

## What success looks like

Forge documents a Markdown-first check-in convention for verification notes, review triggers, stop conditions, and human review requests.

## Acceptance Criteria

- Document how agents record "done and verified" versus "needs human review".
- Start with Markdown guidance and task notes, not new frontmatter fields.
- Define where verification evidence should be written.
- Define where human review triggers and stop conditions should be written.
- Include examples for verified completion, blocked work, and review-needed work.
- Make clear that app-specific review policy belongs in repo guidance unless Forge needs a general rule.

## Execution Plan

1. Add a Markdown-first check-in convention to `.forge/README.md` covering verification evidence, review requests, blocked stop conditions, and examples.
2. Update `AGENTS.md` to point agents at that convention during the operating loop and clarify when to stop instead of closing.
3. Verify the docs are consistent and run the full quality check before closing.

## Dependencies

Depends on `F-0032` because review and check-in guidance should build on the execution plan section convention.

## Verification

- Review `.forge/README.md` and `AGENTS.md` for consistent check-in guidance.
- Run `bun run quality:check`.

## Notes

Do not add schema fields in this task. Let dogfooding prove whether a structured review field is necessary.

Added a Markdown-first check-in convention to `.forge/README.md`, covering done-and-verified notes, blocked stop conditions, review-needed notes, and where app-specific review policy belongs. Updated `AGENTS.md` to use the same convention in the operating loop and corrected the local guidance path to `.forge/local/user.md`.

Verification:
- Reviewed `.forge/README.md` and `AGENTS.md` for consistent check-in guidance.
- `bun run quality:check`

## History

- Created 2026-05-15T00:00:00-05:00.
