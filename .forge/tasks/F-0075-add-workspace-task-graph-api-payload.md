---
id: F-0075
title: "Add workspace task graph API payload"
kind: task
status: done
priority: high
area: "web"
parent: "F-0000"
depends_on:
  - "F-0074"
claimed_by: ""
scope:
  - "packages/web/**"
  - "packages/core/**"
  - ".forge/**"
created_at: 2026-05-21T09:50:50-05:00
updated_at: 2026-05-21T15:20:31.337Z
closed_at: 2026-05-21T15:20:31.337Z
close_reason: ""
blocked_reason: ""
review_reason: ""
---
# Add workspace task graph API payload

## Why

The web app needs a multi-root payload before it can show a workspace dashboard across worktrees.

## What success looks like

The web API returns discovered Forge roots with per-root task graph summaries, and one broken root does not break the whole workspace response.

## Acceptance Criteria

- Add a workspace API payload that includes all discovered roots below the web start directory.
- Include per-root task graph summaries and enough metadata for root switching.
- Preserve simple single-root behavior for the UI.
- Represent per-root parse or load errors without failing the entire workspace response.
- Tests cover zero roots, one root, many roots, malformed roots, and partial failure.

## Execution Plan

Summary: Extend the web API from one task graph to a workspace payload.

Scope: Web API payload construction, Vite middleware, and focused API tests.

Approach:
- Build the workspace payload from the downward discovery helper.
- Reuse existing single-root graph analysis for each valid root.
- Add per-root diagnostics/errors while keeping the HTTP request successful when at least discovery succeeds.
- Keep the current single-root client path easy to adapt in the following UI task.
- Cover fixtures for no roots and broken roots.

Verification:
- `bun run harness:web`
- Focused web API tests

Stop conditions:
- Stop if the payload shape would break the current one-root UI without a clear compatibility plan.

Human review triggers:
- Ask for review if root IDs need to be human-editable or persisted.

## Dependencies

Tracked in frontmatter: F-0074.

## Verification

- Run focused web API tests.
- Run `bun run harness:web`.

## Notes

This task should only provide read-only workspace data. Web writes remain out of scope.

Implemented workspace task graph payload for the web API. The response now keeps the existing single-root task graph fields at the top level and adds `workspace.startDir` plus discovered `workspace.roots` metadata for root switching.

Each root summary includes total task count, ready and recommended ids, availability counts, and graph diagnostics. Roots that fail parsing or loading are returned with `status: error` and an error message, while valid sibling roots still populate the selected top-level graph.

Verification:
- `bun test packages/web/test/api.test.ts`: 8 pass, 33 expect() calls.
- `bun run harness:web`: 33 pass, 130 expect() calls.
- `bun test packages/cli/test/web-workspace.test.ts`: 2 pass, 4 expect() calls.
- `bun run quality:check`: 190 pass, 927 expect() calls, web production build passed.

## History

- Created 2026-05-21T09:50:50-05:00.
