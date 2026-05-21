---
id: F-0077
title: "Add multi-root live refresh"
kind: task
status: done
priority: high
area: "web"
parent: "F-0000"
depends_on:
  - "F-0076"
claimed_by: ""
scope:
  - "packages/web/**"
  - "packages/cli/**"
  - ".forge/**"
created_at: 2026-05-21T09:50:50-05:00
updated_at: 2026-05-21T15:42:58.930Z
closed_at: 2026-05-21T15:42:58.930Z
close_reason: ""
blocked_reason: ""
review_reason: ""
---
# Add multi-root live refresh

## Why

A workspace dashboard is only useful if it notices task changes across all discovered Forge roots without manual browser refreshes.

## What success looks like

The web server watches every discovered `.forge/tasks` directory and refreshes the UI when tasks or roots change below the start directory.

## Acceptance Criteria

- Watch every discovered root's `.forge/tasks` directory.
- Refresh the affected workspace data when task files are added, changed, or removed.
- Detect Forge roots added or removed below the web start directory.
- Avoid fixed ports and real-workspace assumptions in tests.
- Tests cover changes in multiple roots and root add/remove behavior.

## Execution Plan

Summary: Extend live refresh from one task directory to a discovered workspace.

Scope: Vite server watcher setup, web reload behavior, and live smoke tests.

Approach:
- Reuse the existing live refresh event where possible.
- Register watchers for every discovered root and for root-discovery changes under the start directory.
- Debounce refreshes so bursty file writes only trigger one UI update.
- Use temp workspace fixtures for live smoke coverage.
- Keep single-root live refresh behavior unchanged.

Verification:
- `bun run harness:web`
- Live smoke test with a temp multi-root workspace

Stop conditions:
- Stop if watcher coverage becomes too broad or expensive; add explicit pruning before proceeding.

Human review triggers:
- Ask for review before adding persistent watch include/exclude config.

## Dependencies

Tracked in frontmatter: F-0076.

## Verification

- Run focused watcher tests.
- Run `bun run harness:web`.
- Run a live smoke against a temp parent workspace.

## Notes

The goal is to eliminate manual refresh while preserving the current local-only web model.

Implemented multi-root live refresh for the web server. The Vite plugin now watches the web start directory for Forge root structure changes, adds every discovered root's `.forge/tasks` directory to the watcher, and emits the existing `forge:tasks-changed` event after task file changes or root add/remove events.

Decisions:
- Reused the existing browser refresh event so the React app keeps the same reload path.
- Added a debounced workspace refresh that resyncs discovered roots before broadcasting.
- Unwatches task directories for roots that disappear from discovery.
- Kept watcher tests focused on path classification and used the existing live smoke harness for temp workspace coverage.

Verification:
- `bun run harness:web`: 41 pass, 162 expect() calls.
- `bun run quality:check`: 202 pass, 991 expect() calls, web production build passed.

## History

- Created 2026-05-21T09:50:50-05:00.
