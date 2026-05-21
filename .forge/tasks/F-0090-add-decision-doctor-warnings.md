---
id: F-0090
title: "Add decision doctor warnings"
kind: task
status: done
priority: medium
area: "cli"
parent: "F-0000"
depends_on:
  - "F-0089"
claimed_by: ""
scope:
  - "packages/cli/**"
  - "packages/core/**"
  - ".forge/**"
created_at: 2026-05-21T11:54:53-05:00
updated_at: 2026-05-21T18:48:00.236Z
closed_at: 2026-05-21T18:48:00.236Z
close_reason: ""
blocked_reason: ""
review_reason: ""
---
# Add decision doctor warnings

## Why

Broad changes can quietly alter product or architecture conventions unless Forge nudges agents to capture decisions.

## What success looks like

`forge doctor --json` emits advisory warnings when broad active tasks appear to need decision capture but lack decision notes or linked records.

## Acceptance Criteria

- Warn when broad open or active tasks touch CLI, web, and core contract surfaces but have no decision notes.
- Warn when a task resolves human review triggers or stop conditions without recording the decision outcome.
- Include task id, source path, and repair hint.
- Keep warnings advisory and avoid closed historical task noise.
- Do not affect task parsing, queue ranking, or closeout commands.
- Tests cover broad task warnings, narrow task non-warnings, closed task suppression, and linked decision-record suppression.

## Execution Plan

Summary: Add advisory diagnostics for missing decision capture on broad tasks.

Scope: Doctor diagnostics, decision-record detection helpers, and focused tests.

Approach:
- Define simple heuristics for broad task scope based on affected areas and scope globs.
- Detect decision notes or links using the convention from F-0080.
- Warn only on open, doing, blocked, or review-relevant tasks.
- Keep messages actionable and point to the decision-record convention.
- Add tests that avoid subjective language matching beyond clear conventions.

Verification:
- `bun run harness:cli`
- Focused doctor tests.

Stop conditions:
- Stop if warning heuristics are too noisy on the existing Forge task graph.

Human review triggers:
- Ask for review if broad-task heuristics need tuning beyond simple scope and area checks.

## Dependencies

Tracked in frontmatter: F-0089.

## Verification

- Run focused decision doctor tests.
- Run `bun run harness:cli`.

## Notes

Decision warnings should help agents preserve intent, not create a hard process gate.

- Added advisory `decision_capture_missing` and `decision_capture_missing_resolution` doctor warnings.
- The broad-surface heuristic requires explicit CLI, web, and core package scopes; catch-all `packages/**` is intentionally ignored because it was noisy in harness fixtures.
- Existing Forge graph now reports one real broad-task warning for F-0096, which spans CLI, web, and core and has no decision capture yet.
- Added focused decision doctor tests for broad warnings, narrow non-warnings, closed suppression, linked decision records, and resolved review/stop-condition notes.
- Verification: `bun test packages/cli/test/decision-doctor.test.ts`, `bun run harness:cli`, `bun run quality:check`.

## History

- Created 2026-05-21T11:54:53-05:00.
