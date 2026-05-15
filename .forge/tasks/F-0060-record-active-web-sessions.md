---
id: F-0060
title: Record active web sessions
kind: task
status: done
priority: high
parent: F-0000
depends_on:
  - F-0059
claimed_by: ""
area: cli
scope:
  - packages/cli/**
  - packages/core/**
  - .forge/tasks/**
created_at: 2026-05-15T16:17:58-05:00
updated_at: 2026-05-15T21:34:50.479Z
closed_at: 2026-05-15T21:34:50.479Z
close_reason: "Web sessions recorded under .forge/local; status, stale cleanup, env override, quality, harness, and live smoke pass."
blocked_reason: ""
review_reason: ""
---

# Record active web sessions

## Why

The CLI needs to know which local Forge web server belongs to the current worktree before it can print reliable task links.

## What success looks like

Starting `forge web` records a worktree-local session that other CLI commands can discover, validate, and use.

## Acceptance Criteria

- `forge web` writes `.forge/local/web-session.json` when the server starts.
- The session records canonical repo root, host, port, base URL, PID, and start timestamp.
- Session discovery ignores or removes stale records when the PID is no longer alive.
- `forge web status --json` reports the active session for the current worktree.
- `FORGE_WEB_URL` overrides session discovery for unusual environments.
- Tests cover session write, stale PID handling, env override, and status output.

## Execution Plan

Summary: Add a small runtime-session layer for the web server without changing tracked task data.

Scope: `packages/cli/**`, with shared helpers in `packages/core/**` only if the existing boundaries make that cleaner.

Approach:
- Add session read/write helpers that use `.forge/local/web-session.json`.
- Write the session from `forge web` after resolving the repo root, host, and port.
- Add `forge web status --json` to expose the discovered session for agents.
- Treat `FORGE_WEB_URL` as an explicit live base URL override.
- Add CLI tests using fixture repos and fake/stale PIDs where possible.

Verification:
- `bun test packages/cli`
- `bun run harness:cli`

Stop conditions:
- Stop if PID liveness is unreliable on the supported runtime; document the fallback before proceeding.

Human review triggers:
- Ask for review before moving the session file outside `.forge/local/**`.

## Dependencies

Depends on `F-0059` because recorded sessions are useful once task URLs can select specific tasks.

## Verification

- Run `bun test packages/cli`.
- Run `bun run harness:cli`.
- Start `forge web`, then run `forge web status --json` from the same worktree.

## Notes

Use `.forge/local/**` because it is already ignored. Do not write runtime state into tracked task files.

Implemented active web session discovery for `forge web`.

Decisions:
- Store runtime state in ignored `.forge/local/web-session.json`, not tracked task files.
- Record repo root, host, port, base URL, child server PID, start timestamp, and source.
- Remove the session file on graceful server shutdown and when discovery sees a dead PID.
- Let `FORGE_WEB_URL` override file discovery for unusual serving environments.
- Expose discovery through `forge web status --json`.

Verification:
- `bun test packages/cli/test/web-session.test.ts packages/cli/test/cli.test.ts`
- `bun run harness:cli`
- `bun run quality:check`
- Live smoke: started `forge web --host 127.0.0.1 --port 5190 --dir <temp repo>`, confirmed `forge web status --json` returned the file session, then stopped the server and confirmed the session was removed.

Closeout review:
- Stop condition did not trigger; PID liveness was reliable in stale-PID tests and live status smoke.
- Human review trigger did not apply; the session file stayed under ignored `.forge/local/**`.

## History

- Created 2026-05-15T16:17:58-05:00.
