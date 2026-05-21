---
id: F-0102
title: "Rename UI Scope language to Project"
kind: task
status: open
priority: urgent
area: "web"
parent: "F-0000"
depends_on:
  - "F-0101"
claimed_by: ""
scope:
  - "packages/web/**"
  - "packages/cli/**"
  - ".forge/**"
  - "README.md"
created_at: 2026-05-21T14:50:37-05:00
updated_at: 2026-05-21T14:50:37-05:00
---
# Rename UI Scope language to Project

## Why

The header label Scope is overloaded with task frontmatter `scope`. The user-facing filter should say Project.

## What success looks like

Visible UI, docs, prompt guidance, and command descriptions use Project for user-facing work slices while task `scope` remains edit-boundary data.

## Acceptance Criteria

- Rename the web header label from Scope to Project.
- Update user-facing docs from UI Scope to Project.
- Update prompt and command help language where it refers to the user-facing selector.
- Keep task frontmatter `scope` unchanged.
- Avoid renaming internal code paths unless required for clarity or test stability.
- Tests cover the new Project label where UI text is asserted.

## Execution Plan

Summary: Make the product language match the new terminology without changing semantics yet.

Scope: Web labels, docs, prompt/help text, and focused tests.

Approach:
- Apply the F-0101 terminology.
- Change visible text first and keep compatibility with existing data payload names.
- Update tests that assert header labels or help text.
- Leave filtering behavior untouched for follow-up tasks.

Verification:
- Focused web label tests.
- Focused CLI prompt/help tests if touched.
- `bun run harness:web`.

Stop conditions:
- Stop if renaming requires a public JSON payload migration before compatibility is designed.

Human review triggers:
- Ask for review if any visible label besides Scope needs to change.

## Dependencies

Tracked in frontmatter: F-0101.

## Verification

- Run focused tests for changed UI/prompt text.
- Run `bun run harness:web`.

## Notes

This task is a language rename. It should not remove inferred filter behavior yet.

## History

- Created 2026-05-21T14:50:37-05:00.
