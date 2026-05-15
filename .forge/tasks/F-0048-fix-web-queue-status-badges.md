---
id: F-0048
title: Fix web queue status badges
kind: task
status: done
priority: urgent
parent: F-0000
depends_on:
  - F-0047
claimed_by: ""
area: web
scope:
  - packages/web/**
  - .forge/tasks/**
created_at: 2026-05-15T00:00:00-05:00
updated_at: 2026-05-15T05:33:40.735Z
closed_at: 2026-05-15T05:33:40.735Z
close_reason: "Queue badges use availability-aware labels"
blocked_reason: ""
review_reason: ""
---

# Fix web queue status badges

## Why

The queue currently renders active or claimed work with badges like `blocked by 2`. That is technically derived from blocker strings, but it is misleading for humans.

## What success looks like

Queue rows use availability-aware badges so active and claimed tasks are not described as blocked.

## Acceptance Criteria

- Replace misleading `blocked by N` badges for `doing` rows.
- Show `in progress` for `status: doing`.
- Show `claimed by <name>` for claimed tasks.
- Show `blocked by N` only for real dependency, graph, or data blockers.
- Keep done and canceled rows visually distinct from active work.
- Add a web test for an urgent, doing, claimed task that must not render `blocked by 2`.
- Add a web test for a real dependency-blocked task that still renders `blocked by N`.

## Dependencies

Depends on `F-0047` so the UI can consume the shared availability semantics instead of reinterpreting blocker strings locally.

## Verification

- Run `bun test packages/web`.
- Run `bun run quality:check`.
- Manually inspect priority grouping with active, claimed, and dependency-blocked tasks.

## Notes

This is urgent because the current UI is actively misleading while dogfooding.

Implementation decision: queue rows now receive the shared `availabilityByTaskId` value from the web payload. The visible badge prefers `status: doing` as `in progress`, then explicit claims as `claimed by <name>`, and only shows `blocked by N` when availability is `blocked` with real blocker entries.

Done and canceled tasks continue to use the existing dimmed `done` row state. Active and claimed rows get their own neutral row state so they do not inherit blocked-row opacity.

Verification:
- `bun test packages/web` passed with 13 tests, including active/claimed/blocker badge coverage and priority grouping coverage for active, claimed, and blocked work.
- `bun run quality:check` passed with 120 tests and the production web build.

## History

- Created 2026-05-15T00:00:00-05:00.
- Claimed by codex and replaced queue status badges with availability-aware labels.
