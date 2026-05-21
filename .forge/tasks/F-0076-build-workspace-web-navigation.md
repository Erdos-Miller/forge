---
id: F-0076
title: "Build workspace web navigation"
kind: task
status: done
priority: high
area: "web"
parent: "F-0000"
depends_on:
  - "F-0075"
claimed_by: ""
scope:
  - "packages/web/**"
  - ".forge/**"
created_at: 2026-05-21T09:50:50-05:00
updated_at: 2026-05-21T15:32:02.690Z
closed_at: 2026-05-21T15:32:02.690Z
close_reason: ""
blocked_reason: ""
review_reason: ""
---
# Build workspace web navigation

## Why

Once the web app can receive multiple Forge roots, users need to switch roots and inspect all active work from one browser session.

## What success looks like

The web UI shows a repo switcher when multiple roots exist, supports an all-roots aggregate queue, and preserves the simple one-root experience.

## Acceptance Criteria

- Show a repo switcher when multiple Forge roots are available.
- Add an all-roots aggregate queue for scanning ready work across roots.
- Support per-root queue and detail views.
- Support URLs shaped like `?repo=<repoId>&task=<taskId>`.
- Keep one-root UI visually close to the current app.
- Tests cover zero, one, and many roots plus URL selection.

## Execution Plan

Summary: Adapt the existing queue/detail UI to workspace payloads.

Scope: Web app state, navigation, rendering, styles, and tests.

Approach:
- Add root selection state derived from the workspace payload and URL query.
- Render the existing queue/detail layout for the selected root.
- Add an aggregate view that ranks visible tasks across roots while preserving root identity.
- Keep empty states clear for no roots and no tasks.
- Add render tests and a browser smoke for URL selection.

Verification:
- `bun run harness:web`
- Browser smoke against a temp multi-root fixture

Stop conditions:
- Stop if aggregate ranking across roots needs a product decision beyond existing priority/ready ordering.

Human review triggers:
- Ask for visual review if the repo switcher materially changes the layout.

## Dependencies

Tracked in frontmatter: F-0075.

## Verification

- Run focused web render tests.
- Run `bun run harness:web`.
- Smoke test a temp workspace with multiple Forge roots.

## Notes

Do not add workspace write actions in this task.

Implemented workspace navigation in the web app. The API now includes each valid root's full read-only graph, and the UI derives either an all-roots aggregate queue or a per-root queue/detail view from the same payload.

Decisions:
- The repo switcher only appears when more than one valid Forge root is available, keeping the one-root UI visually close to the existing app.
- The all-roots view decorates task ids internally with their root id so duplicate task ids across repos remain selectable without changing the displayed task id in the detail pane.
- Broken roots remain represented at the API layer, while the switcher only offers roots with loadable graphs.
- URLs now support `?repo=<repoId>&task=<taskId>`; aggregate rows use scoped internal ids, while per-root URLs use normal task ids.

Verification:
- `bun test packages/web/test/app.test.tsx packages/web/test/api.test.ts packages/web/test/live-smoke.test.ts`: 36 pass, 146 expect() calls.
- `bun run harness:web`: 38 pass, 152 expect() calls.
- `bun run quality:check`: 195 pass, 949 expect() calls, web production build passed.

## History

- Created 2026-05-21T09:50:50-05:00.
