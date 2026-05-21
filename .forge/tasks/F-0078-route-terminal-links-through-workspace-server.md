---
id: F-0078
title: "Route terminal links through workspace server"
kind: task
status: done
priority: medium
area: "cli"
parent: "F-0000"
depends_on:
  - "F-0076"
claimed_by: ""
scope:
  - "packages/cli/**"
  - "packages/web/**"
  - ".forge/**"
created_at: 2026-05-21T09:50:50-05:00
updated_at: 2026-05-21T16:02:27.458Z
closed_at: 2026-05-21T16:02:27.458Z
close_reason: ""
blocked_reason: ""
review_reason: ""
---
# Route terminal links through workspace server

## Why

Task links printed from any worktree should open the matching task in a running workspace web server when that server indexes the current root.

## What success looks like

CLI task hyperlinks can target workspace URLs with repo identity while preserving existing JSON contracts and single-root behavior.

## Acceptance Criteria

- Extend web session discovery so a CLI command inside a worktree can find a workspace server that includes that root.
- Generate workspace task links shaped like `?repo=<repoId>&task=<taskId>`.
- Preserve existing single-root task links.
- Keep all JSON output unchanged.
- Tests cover workspace session discovery, single-root fallback, missing session fallback, and JSON non-regression.

## Execution Plan

Summary: Make terminal task links workspace-aware after the workspace UI exists.

Scope: CLI web session discovery, task link formatting, and focused tests.

Approach:
- Extend session metadata so a workspace server can advertise indexed roots.
- Resolve the current worktree root to the matching workspace repo ID.
- Format OSC 8 links with both repo and task query parameters when a workspace session applies.
- Preserve the current single-root URL path when only a single-root session is available.
- Keep robot JSON payloads and command contracts stable.

Verification:
- `bun run harness:cli`
- Live smoke with a temp workspace server and a CLI command run inside a child root

Stop conditions:
- Stop if workspace session discovery needs global persistent config; document the decision before implementing.

Human review triggers:
- Ask for review before changing default link behavior outside TTY output.

## Dependencies

Tracked in frontmatter: F-0076.

## Verification

- Run focused CLI link/session tests.
- Run `bun run harness:cli`.
- Smoke test a workspace link from inside a fixture child root.

## Notes

Do not change JSON contracts or add browser-control behavior in this task.

Decision: Workspace `forge web` sessions now advertise all indexed roots and write a session file into each root, so CLI commands run inside any indexed worktree can discover the same server without global persistent config.

Decision: Terminal OSC 8 links preserve the existing `?task=<id>` shape for single-root sessions. Multi-root workspace sessions add `repo=<repoId>` before `task=<id>` so the web UI can open the matching root and task. JSON commands still bypass link formatting entirely.

Verification:
- bun test packages/cli/test/task-links.test.ts packages/cli/test/web-session.test.ts: 12 pass, 36 expect() calls.
- bun run harness:cli: 7 pass, 89 expect() calls.
- bun run quality:check: 209 pass, 1025 expect() calls, web production build passed.

## History

- Created 2026-05-21T09:50:50-05:00.
