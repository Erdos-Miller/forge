---
id: F-0099
title: "Add configurable workspace discovery ignores"
kind: task
status: open
priority: medium
area: "core"
parent: "F-0000"
depends_on:
  - "F-0098"
claimed_by: ""
scope:
  - "packages/core/**"
  - "packages/cli/**"
  - ".forge/**"
created_at: 2026-05-21T17:46:25.798Z
updated_at: 2026-05-21T17:46:25.798Z
---
# Add configurable workspace discovery ignores

## Why

Teams may have repo-specific generated directories that Forge cannot know about globally, and broad workspaces need a first-class way to prune them.

## What success looks like

A project can configure additional workspace discovery ignore patterns without changing Forge defaults or committing local machine paths.

## Acceptance Criteria

- Design and document a small config surface for workspace discovery ignore paths.
- Keep default discovery working without config.
- Apply configured ignores to downward workspace discovery.
- Add doctor validation for invalid ignore patterns or unusable config.

## Dependencies

Tracked in frontmatter: F-0098.

## Verification

- Run focused discovery config and doctor tests.
- Run bun run harness:check.

## Notes

Follow-up from F-0098. Do not add persistent runtime cache files in this task.

## History

- Created 2026-05-21T17:46:25.798Z.
