---
id: F-0063
title: "Fix web dev server core imports"
kind: task
status: done
priority: medium
area: "web"
parent: ""
depends_on: []
claimed_by: ""
scope:
  - "packages/web/**"
  - "packages/core/**"
created_at: 2026-05-19T15:36:45.593Z
updated_at: 2026-05-19T15:37:37.289Z
closed_at: 2026-05-19T15:37:37.289Z
close_reason: "Forge web starts without node_modules TypeScript stripping failure"
blocked_reason: ""
review_reason: ""
---
# Fix web dev server core imports

## Why

`forge web` fails locally on Node 22 when Vite loads `@forge/core` from a file workspace under `node_modules`. Node refuses to strip TypeScript types from files below `node_modules`, so the web UI cannot start from the installed CLI.

## What success looks like

The Forge web dev server starts against a repo-local `.forge` store without hitting `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`.

## Acceptance Criteria

- Web server runtime imports avoid resolving `@forge/core` through `node_modules`.
- Existing web API behavior remains unchanged.
- `forge web` serves a local task graph.

## Dependencies

None.

## Verification

- `bun test packages/web`
- `bun test packages/core/test/module-boundaries.test.ts`
- `forge web --host 127.0.0.1 --port 8793 --dir /Users/ken/Work/repo_worktrees/ken-maglink`

## Notes

Implementation: use direct workspace source imports for the web server runtime files that execute inside Vite/Node. Type-only client imports can remain package imports because they are erased from runtime output.

Verification completed:
- `bun test packages/web`
- `bun test packages/core/test/module-boundaries.test.ts`
- `forge web --host 127.0.0.1 --port 8793 --dir /Users/ken/Work/repo_worktrees/ken-maglink`

Result: Forge web now serves the ToolHub worktree at http://127.0.0.1:8793/.

## History

- Created 2026-05-19T15:36:45.593Z.
