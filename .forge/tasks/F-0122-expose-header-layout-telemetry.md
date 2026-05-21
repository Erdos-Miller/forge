---
id: F-0122
title: "Expose header layout telemetry"
kind: task
status: open
priority: urgent
project: "forge"
area: "web"
parent: "F-0000"
depends_on:
  - "F-0121"
claimed_by: ""
scope:
  - "packages/web/**"
  - ".forge/tasks/**"
created_at: 2026-05-21T17:26:34-05:00
updated_at: 2026-05-21T17:26:34-05:00
closed_at: ""
close_reason: ""
blocked_reason: ""
review_reason: ""
---
# Expose header layout telemetry

## Why

The web header needs stable machine-readable evidence for layout contracts. Tests should not infer header correctness from screenshots or brittle text snapshots.

## What success looks like

The Forge web header exposes enough stable DOM hooks for browser tests to measure brand, Worktree, Project, and Queue/Analytics tab placement.

## Acceptance Criteria

- Add stable test selectors for the brand, Worktree control, Project control, and top navigation.
- Make the selectors available in production markup without visible debug UI.
- Ensure browser tests can read each header element's rectangle with Playwright locators.
- Add a helper or convention that reports overlap, left-to-right order, same-row desktop placement, and expected narrow wrapping.
- Keep user-visible labels as Worktree, Project, Queue, and Analytics.
- Do not add screenshot-based assertions.

## Execution Plan

Summary: Make the header measurable before adding regression contracts.

Scope: Header markup and web test helpers.

Approach:
- Add `data-testid` attributes or equivalent stable selectors to the header elements.
- Keep selectors semantic and stable enough for future agents to reuse.
- Put any layout calculation helper in the web test harness, not in app runtime logic, unless runtime code already exposes the needed state.
- Ensure selectors still exist when the Worktree or Project controls are conditionally hidden.

Verification:
- Focused web tests for selector presence.
- `bun run harness:web:layout`

Stop conditions:
- Stop if instrumentation would introduce user-visible layout or style changes.

Human review triggers:
- Ask for review if telemetry needs a runtime endpoint instead of test-side DOM measurement.

## Dependencies

Tracked in frontmatter: F-0121.

## Verification

- Run the focused layout harness.

## Notes

This task should not change header positioning. It prepares observable evidence for the next task.

## History

- Created 2026-05-21T17:26:34-05:00.
