---
id: F-0123
title: "Add header layout regression contracts"
kind: task
status: done
priority: urgent
project: "forge"
area: "test"
parent: "F-0000"
depends_on:
  - "F-0122"
claimed_by: ""
scope:
  - "packages/web/**"
  - ".forge/tasks/**"
created_at: 2026-05-21T17:26:34-05:00
updated_at: 2026-05-21T22:46:05.099Z
closed_at: 2026-05-21T22:46:05.099Z
close_reason: ""
blocked_reason: ""
review_reason: ""
---
# Add header layout regression contracts

## Why

The Queue and Analytics tabs moved to an unexpected position without a contract catching it. The next CSS fix should be driven by a failing browser layout contract.

## What success looks like

The layout harness fails on the current tab drift and protects the intended Worktree > Project > view navigation behavior across realistic workspace states.

## Acceptance Criteria

- Add layout contract cases for one Worktree, multiple Worktrees, no Project selector, Project selector present, long Worktree label, and long Project label.
- Cover desktop and narrow/mobile viewport widths.
- Assert header elements do not overlap.
- Assert Worktree appears before Project when both controls exist.
- Assert Queue and Analytics remain in the intended header lane and do not drift to the far right unexpectedly.
- Assert changing selected Worktree or Project labels does not resize header controls enough to move navigation unexpectedly.
- The contract should fail before the current header-position fix is applied.
- Do not use screenshot snapshots or visual golden files.

## Execution Plan

Summary: Encode the current header regression as browser-measured layout contracts.

Scope: Playwright layout specs and fixture data only.

Approach:
- Build fixture payloads that exercise the header states without relying on the real developer workspace.
- Use Playwright locators and bounding boxes for measurements.
- Report failing rectangles and selected labels in assertion messages.
- Keep mobile expectations explicit: wrapping is allowed only where the intended responsive layout says it should happen.

Verification:
- `bun run harness:web:layout`

Stop conditions:
- Stop if the current app cannot load deterministic fixture states without adding more harness infrastructure; split that support into F-0121 instead of weakening assertions.

Human review triggers:
- Ask for review if the intended desktop tab lane is ambiguous after measuring current behavior.

## Dependencies

Tracked in frontmatter: F-0122.

## Verification

- Run the focused layout harness and confirm it catches the existing regression before the CSS fix lands.

## Notes

This task should add failing or regression-focused contracts only. It should not fix the CSS.

- Added red browser layout contracts for the current header tab drift without changing header CSS.
- Covered desktop Project-present and Project-absent states, long Worktree label, long Project label, narrow wrapping, and control-label changes.
- Added `expectAdjacentLane` to report the measured gap between the last header control and Queue/Analytics navigation.
- Confirmed the current app fails the new contract before the CSS fix: Project to navigation gap measured 526.75px against a 48px max; Worktree to navigation gap measured 787.671875px against a 48px max.
- No screenshot snapshots or visual golden files were added.
Verification:
- `bun run harness:web:layout` failed as expected with adjacent-lane rectangle output for the current header regression.
- `bun test packages/core/test/readability-ratchet.test.ts` passed.

## History

- Created 2026-05-21T17:26:34-05:00.
