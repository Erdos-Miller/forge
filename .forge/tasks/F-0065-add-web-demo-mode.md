---
id: F-0065
title: "Add web demo mode"
kind: task
status: done
priority: high
area: "cli"
parent: ""
depends_on: []
claimed_by: ""
scope:
  - "packages/cli/**"
  - ".forge/tasks/**"
created_at: 2026-05-19T22:40:30.893Z
updated_at: 2026-05-19T22:45:37.585Z
closed_at: 2026-05-19T22:45:37.585Z
close_reason: "Demo web mode added; realistic temp task graph, CLI tests, harness, live smoke, and quality pass."
blocked_reason: ""
review_reason: ""
---
# Add web demo mode

## Why

The team needs a quick way to open Forge with realistic task data for screenshots and demos without creating a real repo task graph.

## What success looks like

forge web --demo serves a temporary realistic Forge task board suitable for screenshots.

## Acceptance Criteria

- forge web --demo creates a temporary .forge task store with realistic mixed task states.
- Demo tasks include multiple areas, priorities, blockers, in-progress work, done work, dependencies, and rich markdown bodies.
- The demo server prints the demo repo path and usable URL.
- Normal forge web and forge web status behavior remains unchanged.
- Tests cover demo repo creation and web argument parsing.

## Execution Plan

Summary: Add a first-class demo server mode that serves realistic temporary Forge tasks.

Scope: `packages/cli/**` and this task file.

Approach:
- Add a CLI demo fixture writer that creates a temporary repo with `.forge/tasks` and rich task markdown.
- Extend `forge web` parsing with `--demo`, keeping `status` unchanged.
- When demo mode is enabled, serve the generated temp repo instead of requiring `.forge` discovery from cwd.
- Clean up the temp demo repo when the web server exits.
- Add focused CLI tests for demo fixture creation and argument parsing.

Verification:
- `bun test packages/cli`
- `bun run harness:cli`
- Start `forge web --demo`, inspect `/api/tasks`, and load the web UI.

Stop conditions:
- Stop if demo mode needs changes to persisted task schema.

Human review triggers:
- Ask before replacing normal `forge web` behavior or storing demo files in the user's repo.

## Dependencies

None.

## Verification

- bun test packages/cli
- bun run harness:cli

## Notes

TODO: Add implementation context.

Implemented `forge web --demo`.

Decisions:
- Demo mode creates a temporary repo with ordinary `.forge/tasks/*.md` files instead of special UI-only data.
- The fixture includes 15 realistic tasks across web, cli, api, design, docs, test, and core areas.
- The task graph includes ready work, blocked work, in-progress work, done work, dependencies, priorities, and rich Markdown sections.
- Demo mode cannot be combined with `--dir`, so it never writes demo files into a user's repo.
- The temporary demo repo is cleaned up when the server exits.

Verification:
- `bun test packages/cli/test/demo-repo.test.ts packages/cli/test/cli.test.ts`
- `bun run harness:cli`
- Live demo smoke: started `forge web --demo --host 127.0.0.1 --port 5180`, confirmed `/api/tasks` returned 15 tasks with 5 ready tasks and 7 areas, and confirmed the web UI rendered ready, blocked, in-progress, recent done, and rich selected-task detail.
- `bun run quality:check`

## History

- Created 2026-05-19T22:40:30.893Z.
