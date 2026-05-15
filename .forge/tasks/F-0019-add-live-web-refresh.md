---
id: F-0019
title: Add live web refresh
kind: task
status: done
priority: urgent
parent: F-0000
depends_on:
  - F-0013
claimed_by: ""
area: web
scope:
  - packages/web/**
  - .forge/tasks/**
created_at: 2026-05-15T00:00:00-05:00
updated_at: 2026-05-15T05:30:00.000Z
closed_at: 2026-05-15T05:00:00.000Z
close_reason: "Backfilled by F-0045; timestamp is approximate."
---

# Add live web refresh

## Why

Humans should be able to keep the Forge web board open while agents claim, block, and close tasks from the CLI. The board should not require manual reloads to reflect file changes.

## What success looks like

The local web app watches `.forge/tasks/**/*.md`, refreshes task data after changes, and preserves the user's current selection when possible.

## Acceptance Criteria

- Vite watches task Markdown files in the discovered Forge root.
- The dev server broadcasts a debounced task-change event to the browser.
- The browser refetches `/api/tasks` after task-change events.
- The selected task remains selected if it still exists.
- If the selected task disappears, the UI falls back to the next ranked task or the first visible task.
- Parse or doctor errors are shown clearly in the UI without crashing the page.
- Tests cover refresh behavior at the API or state layer.

## Dependencies

Depends on `F-0013` because the web refresh should reuse the same task graph payload used by robot introspection.

## Verification

- Run `bun test` and `bun run build` in `packages/web`.
- Smoke-check that editing a task file updates an open local web board without manual reload.

## Notes

This is a dogfooding friction task. Pick it before lower-friction web polish such as keyboard navigation and execution-plan display, because the board should update while agents change task files.

This is a human-support task, not an agent dependency. Agents should continue using robot CLI commands.

Implemented with a Vite dev-server watcher on the discovered Forge root's `.forge/tasks` directory. The server broadcasts a debounced `forge:tasks-changed` HMR event and the browser refetches `/api/tasks`, preserving the selected task when possible.

Parse/API failures now show as an in-page refresh error without discarding the last good task payload. Graph diagnostics render as an in-page task diagnostics banner.

Verification:
- `bun test packages/web`
- `bun run --cwd packages/web build`
- `bun run quality:check`
- Live refresh smoke: started the Vite dev server against a temporary Forge repo, edited a task file, and received `forge:tasks-changed` over the Vite HMR websocket.

## History

- Created 2026-05-15T00:00:00-05:00.
- Reprioritized to urgent because manual browser refresh is active dogfooding friction.
- Implemented task-file live refresh for the local web board.
