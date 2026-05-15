---
id: F-0062
title: "Record actual web server port"
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
created_at: 2026-05-15T21:54:46.161Z
updated_at: 2026-05-15T21:56:51.740Z
closed_at: 2026-05-15T21:56:51.740Z
close_reason: "Actual web port selection fixed; session, links, live smoke, and quality pass."
blocked_reason: ""
review_reason: ""
---
# Record actual web server port

## Why

Trying terminal links against a live server showed that Vite can auto-fallback to a different port than Forge records.

## What success looks like

forge web prints, records, and links to the actual serving port even when the requested port is busy.

## Acceptance Criteria

- Forge chooses an available port before spawning Vite.
- The printed URL, session file, and terminal links use the same port.
- Vite is started with strict port behavior so it cannot silently diverge from the recorded session.
- Tests cover requested-port and busy-port behavior.

## Execution Plan

Summary: Make `forge web` own port selection so the recorded session cannot diverge from the actual Vite server.

Scope: `packages/cli/**` and this task file.

Approach:
- Add a small TCP availability helper in the CLI package.
- Resolve the actual port before printing, recording the session, or spawning Vite.
- Start Vite with `--strictPort` so it cannot silently fall through to another port.
- Cover direct requested-port behavior and busy-port fallback in CLI tests.

Verification:
- `bun test packages/cli/test/web-port.test.ts packages/cli/test/cli.test.ts`
- `bun run harness:cli`
- Live smoke with the default port occupied.

Stop conditions:
- Stop if port probing requires a long-lived listener or cross-process lock.

Human review triggers:
- Ask before changing the default host or removing fallback-to-next-port behavior.

## Dependencies

None.

## Verification

- TODO: Add verification commands or evidence.

## Notes

TODO: Add implementation context.

Implemented actual web port selection.

Decisions:
- Added a CLI port probe that falls forward from the requested port before spawning Vite.
- The printed URL, web session file, and terminal links now all use the selected port.
- Vite starts with `--strictPort` so it cannot silently switch away from the recorded session port.

Verification:
- `bun test packages/cli/test/web-port.test.ts packages/cli/test/web-session.test.ts packages/cli/test/task-links.test.ts packages/cli/test/cli.test.ts`
- Live smoke with default ports already occupied: `forge web --host 127.0.0.1 --port 5174` selected `http://127.0.0.1:5177/`, `forge web status --json` reported port `5177`, `forge list --all --links=always` emitted OSC 8 links to `5177`, and headless Chrome loaded `http://127.0.0.1:5177/?task=F-0062` with the task selected.

Closeout review:
- Stop condition did not trigger; port probing uses a short-lived listener only.
- Human review trigger did not apply; default host is unchanged and fallback-to-next-port behavior is preserved.
- `bun run quality:check` passed after the fix.

## History

- Created 2026-05-15T21:54:46.161Z.
