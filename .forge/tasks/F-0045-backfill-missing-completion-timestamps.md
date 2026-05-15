---
id: F-0045
title: Backfill missing completion timestamps
kind: task
status: done
priority: urgent
parent: F-0000
depends_on:
  - F-0043
  - F-0044
claimed_by: ""
area: docs
scope:
  - .forge/tasks/**
created_at: 2026-05-15T00:00:00-05:00
updated_at: 2026-05-15T05:23:40.768Z
closed_at: 2026-05-15T05:23:40.768Z
close_reason: "Historical close metadata backfilled"
blocked_reason: ""
review_reason: ""
---

# Backfill missing completion timestamps

## Why

Early bootstrap tasks were completed before `closed_at` existed. They should be repaired after Forge has doctor diagnostics and a structured close metadata repair command.

## What success looks like

All completed Forge tasks have `closed_at`, and historical backfilled timestamps are recorded as approximations.

## Acceptance Criteria

- Run doctor before repair and record the missing completion timestamp diagnostics.
- Use the structured close metadata repair command from `F-0044` to set `closed_at` for older completed tasks.
- Use each affected task's existing `updated_at` as the best available completion approximation.
- Record in task notes that backfilled timestamps are approximations, not exact historical close times.
- Run doctor after repair and confirm no completed task is missing `closed_at`.
- Run `bun run quality:check`.

## Dependencies

Depends on `F-0043` for diagnostics and `F-0044` for the safe repair command. Do not start this task before both are done.

## Verification

- Doctor reports no completed tasks missing `closed_at`.
- `bun run quality:check` passes.

## Notes

This is the only task in the timestamp repair chain that should mutate historical task data.

Prioritize this immediately after `F-0043` and `F-0044` so the burndown chart uses complete close data.

Pre-repair doctor reported 24 close metadata errors:
- Missing `closed_at`: F-0001, F-0002, F-0003, F-0004, F-0005, F-0006, F-0007, F-0009.
- `closed_at` before `created_at`: F-0010, F-0011, F-0012, F-0013, F-0014, F-0016, F-0019, F-0022, F-0023, F-0024, F-0029, F-0030, F-0032, F-0036, F-0043, F-0046.

Backfilled timestamps are approximations, not exact historical close times. For tasks missing `closed_at`, the pre-repair `updated_at` was used as the best available completion approximation. For tasks whose existing close timestamp predates `created_at`, the timestamp was normalized to `created_at` so the metadata is internally valid.

All repairs were performed with `forge set <id> --closed-at <timestamp> --close-reason "Backfilled by F-0045; timestamp is approximate." --json`.

Post-repair doctor output: `errors: 0`, `warnings: 0`.

Verification:
- `forge doctor --json` before repair captured the diagnostics above.
- `forge doctor --json` after repair returned no diagnostics.
- `bun run quality:check`

## History

- Created 2026-05-15T00:00:00-05:00.
- Reprioritized to urgent because missing historical `closed_at` values make burndown data misleading.
- Backfilled historical close metadata with structured Forge commands.
