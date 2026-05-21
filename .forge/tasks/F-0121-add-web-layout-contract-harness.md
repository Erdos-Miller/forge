---
id: F-0121
title: "Add web layout contract harness"
kind: task
status: done
priority: urgent
project: "forge"
area: "test"
parent: "F-0000"
depends_on: []
claimed_by: ""
scope:
  - "packages/web/**"
  - "package.json"
  - "bun.lock"
  - ".forge/tasks/**"
created_at: 2026-05-21T17:26:34-05:00
updated_at: 2026-05-21T22:39:07.984Z
closed_at: 2026-05-21T22:39:07.984Z
close_reason: ""
blocked_reason: ""
review_reason: ""
---
# Add web layout contract harness

## Why

Forge web layout regressions are currently too easy to miss because the web harness mostly checks render output and API behavior, not measured browser layout contracts.

## What success looks like

Forge has a focused Playwright layout harness that can prove header and control geometry with deterministic fixture data, without screenshot snapshots or manual browser inspection.

## Acceptance Criteria

- Add a Playwright-based web layout harness for Forge web.
- Start an isolated Forge web server on a test port with deterministic fixture data.
- Clean up spawned servers and fixture directories reliably.
- Assert DOM and geometry behavior through locators, bounding boxes, and stable test IDs.
- Add a focused root script named `harness:web:layout`.
- Keep screenshots out of normal success criteria and artifacts.
- Do not introduce Storybook for this harness.

## Execution Plan

Summary: Add an app-level browser layout harness before fixing the current header regression.

Scope: Web test harness setup, package scripts, fixture wiring, and cleanup helpers.

Approach:
- Reuse the existing Forge fixture repo builder and live web smoke patterns where possible.
- Add Playwright as a web test dependency only if the package does not already have a browser runner available.
- Prefer a deterministic fixture repo over the developer's real workspace.
- Make failures report viewport size, selector state, rectangles, and URL instead of screenshots.
- Wire `bun run harness:web:layout` from the root package scripts.

Verification:
- `bun run harness:web:layout`
- `bun run harness:web`

Stop conditions:
- Stop if adding Playwright requires broad dependency churn outside the web harness surface.
- Stop if the harness cannot run without depending on a human-launched web server.

Human review triggers:
- Ask for review if a screenshot artifact or Storybook dependency seems necessary.

## Dependencies

None.

## Verification

- Run the focused layout harness.
- Run the existing web harness after script wiring.

## Notes

This task creates the harness infrastructure only. It should not fix the header CSS regression.

- Added a Playwright-based layout harness for Forge web with deterministic fixture workspace data and browser-measured header geometry.
- Extracted shared live Forge web server helpers so smoke and layout harnesses use the same isolated server startup, readiness, failure output, and cleanup path.
- Added stable header test IDs through a small ForgeHeader component without changing visible UI or fixing header positioning.
- Added root `harness:web:layout` script and made web/full harness scripts install cached Chromium before browser tests so the harness is self-starting on fresh machines.
- Reviewed stop conditions: Playwright dependency touched only package metadata plus `bun.lock`, and the harness starts its own server without a human-launched web process. No screenshots or Storybook were added.
- Verification: `bun run harness:web:layout`; `bun run harness:web`; `bun test packages/core/test/readability-ratchet.test.ts`; `bun run --cwd packages/web build`; `bun run harness:check`.

Verification:
- `bun run harness:web:layout`
- `bun run harness:web`
- `bun test packages/core/test/readability-ratchet.test.ts`
- `bun run --cwd packages/web build`
- `bun run harness:check`

## History

- Created 2026-05-21T17:26:34-05:00.
