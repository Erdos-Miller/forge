---
id: F-0061
title: Render terminal task hyperlinks
kind: task
status: done
priority: high
parent: F-0000
depends_on:
  - F-0060
claimed_by: ""
area: cli
scope:
  - packages/cli/**
  - .forge/tasks/**
created_at: 2026-05-15T16:17:58-05:00
updated_at: 2026-05-15T21:39:56.579Z
closed_at: 2026-05-15T21:39:56.579Z
close_reason: "Terminal task links added for list and ready; JSON unchanged; focused tests, harness, live smoke, and quality pass."
blocked_reason: ""
review_reason: ""
---

# Render terminal task hyperlinks

## Why

Agent-facing CLI output should let users jump from a task ID in the terminal to that task in the open Forge web UI.

## What success looks like

When a live web session exists, human-readable CLI output can render task IDs as OSC 8 links to the matching local web URL.

## Acceptance Criteria

- Add `--links=auto|always|never` to human-readable task-listing output.
- In `auto`, emit OSC 8 links only when stdout is a TTY and a live web session exists.
- Link task IDs to `${baseUrl}?task=<id>`.
- Keep all `--json` output unchanged.
- Fall back to plain task IDs when no live session is found.
- Tests cover OSC 8 formatting, disabled links, missing-session fallback, and JSON non-regression.

## Execution Plan

Summary: Format task IDs as terminal hyperlinks only in human output, leaving robot contracts stable.

Scope: `packages/cli/**`.

Approach:
- Add a small task-link formatter that accepts a task ID, link mode, TTY state, and optional session base URL.
- Parse `--links=auto|always|never` for human-readable commands that print task IDs, starting with `forge list`.
- Use session discovery from `F-0060` to build `${baseUrl}?task=<id>` links.
- Keep robot JSON commands and JSON tests unchanged.
- Add CLI tests for link modes and terminal compatibility fallbacks.

Verification:
- `bun test packages/cli`
- `bun run harness:cli`

Stop conditions:
- Stop if the command only has JSON output; do not add hyperlinks to JSON payloads.

Human review triggers:
- Ask for review before enabling links by default in non-TTY output.

## Dependencies

Depends on `F-0060` because terminal links need reliable worktree session discovery.

## Verification

- Run `bun test packages/cli`.
- Run `bun run harness:cli`.
- Start `forge web`, run a human-readable listing command, and confirm the task ID opens `?task=<id>`.

## Notes

This task should not add browser control, WebSocket navigation, or changes to robot JSON contracts.

Implemented terminal task links for human-readable task listings.

Decisions:
- Added `--links=auto|always|never` to `forge list` and `forge ready`.
- `auto` only links when stdout is a TTY and a live web session is discoverable.
- `always` still falls back to plain IDs when no live session exists.
- Links use OSC 8 around only the task ID and target `${baseUrl}?task=<id>`.
- JSON commands stay on their existing robot output paths.
- Moved terminal-link tests into a separate test file to stay under the readability ratchet instead of adding an exception.

Verification:
- `bun test packages/cli/test/cli.test.ts packages/cli/test/task-links.test.ts packages/cli/test/web-session.test.ts`
- `bun run harness:cli`
- Live smoke: started `forge web --host 127.0.0.1 --port 5191 --dir <temp repo>`, confirmed `forge list --links=always` and `forge ready --links=always` emitted OSC 8 links to `http://127.0.0.1:5191/?task=T-0001`, and confirmed that URL selected the task in the web UI.
- `bun run quality:check`

Closeout review:
- Stop condition did not trigger; the changed commands are human-readable listings, and JSON outputs were covered by non-regression tests.
- Human review trigger did not apply; links default to `auto`, which does not emit links in non-TTY output.

## History

- Created 2026-05-15T16:17:58-05:00.
