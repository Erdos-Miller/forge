---
id: F-0099
title: "Add configurable workspace discovery ignores"
kind: task
status: done
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
updated_at: 2026-05-21T19:00:10.194Z
closed_at: 2026-05-21T19:00:10.194Z
close_reason: ""
blocked_reason: ""
review_reason: ""
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

## Execution Plan

Summary: Add a repo/workspace-local discovery ignore config for downward Forge root scans.

Scope: Core discovery config parsing, discovery pruning, CLI doctor validation, README docs, and focused tests.

Approach:
- Use `forge.workspace.yml` at the workspace start directory so multi-root parents without `.forge` can still configure discovery.
- Keep paths relative to the start directory and reject absolute or parent-traversal paths.
- Apply configured ignores in addition to built-in ignore directories.
- Add doctor warnings for invalid config without changing queue semantics.

Verification:
- `bun test packages/core/test/workspace.test.ts packages/cli/test/workspace-config-doctor.test.ts packages/cli/test/web-workspace.test.ts`
- `bun run harness:check`

Stop conditions:
- Stop if config needs machine-local absolute paths or persistent cache files.

Human review triggers:
- Ask for review if the config filename should move under `.forge` despite multi-root parent limitations.

## Dependencies

Tracked in frontmatter: F-0098.

## Verification

- Run focused discovery config and doctor tests.
- Run bun run harness:check.

## Notes

Follow-up from F-0098. Do not add persistent runtime cache files in this task.

- Added `forge.workspace.yml` as a workspace-start config file for downward discovery ignores.
- Configured ignore paths are relative to the web start directory and reject absolute or parent-traversal paths.
- Wired configured ignores into `discoverForgeRootsDownward` while preserving defaults.
- Added doctor validation for invalid workspace config and README documentation with an example.
- Verification: focused workspace config tests and `bun run harness:check`.

## History

- Created 2026-05-21T17:46:25.798Z.
