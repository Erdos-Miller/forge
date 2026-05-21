---
id: F-0079
title: "Make demo mode show workspace switching"
kind: task
status: done
priority: high
area: "cli"
parent: ""
depends_on: []
claimed_by: ""
scope:
  - "packages/cli/**"
  - ".forge/**"
created_at: 2026-05-21T16:26:45.713Z
updated_at: 2026-05-21T16:26:53.789Z
closed_at: 2026-05-21T16:26:53.789Z
close_reason: ""
blocked_reason: ""
review_reason: ""
---
# Make demo mode show workspace switching

## Why

Demo mode should exercise the workspace switcher instead of producing a single-root demo that cannot show the feature.

## What success looks like

forge web --demo serves a temporary multi-root workspace with a visible Repo switcher.

## Acceptance Criteria

- Demo mode creates at least two Forge roots under one temporary workspace.
- The web API sees multiple workspace roots in demo mode.
- Existing single-root demo fixture remains usable in tests.

## Dependencies

None.

## Verification

- bun test packages/cli/test/demo-repo.test.ts packages/cli/test/web-workspace.test.ts packages/web/test/app.test.tsx packages/web/test/api.test.ts
- bun run quality:check

## Notes

Created after reproducing that the prior demo server only exposed one temporary root, so the Repo switcher could not appear.

Decision: Keep `createDemoForgeRepo` for focused single-root fixture tests, but make `forge web --demo` use a new multi-root demo workspace with `forge-ui` and `agent-runtime` roots. The server now uses the workspace parent as `FORGE_START_DIR`, so `/api/tasks` returns multiple roots and the web Repo selector is visible.

Verification:
- bun test packages/cli/test/demo-repo.test.ts packages/cli/test/web-workspace.test.ts packages/web/test/app.test.tsx packages/web/test/api.test.ts: 39 pass, 153 expect() calls.
- bun run harness:cli: 7 pass, 89 expect() calls.
- bun run quality:check: 210 pass, 1029 expect() calls, web production build passed.

## History

- Created 2026-05-21T16:26:45.713Z.
