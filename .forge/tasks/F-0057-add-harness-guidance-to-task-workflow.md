---
id: F-0057
title: Add harness guidance to task workflow
kind: task
status: open
priority: high
area: docs
parent: F-0000
depends_on:
  - F-0055
  - F-0056
  - F-0053
claimed_by: ""
scope:
  - .forge/**
  - packages/cli/**
created_at: 2026-05-15T00:00:00-05:00
updated_at: 2026-05-15T00:00:00-05:00
closed_at: ""
close_reason: ""
---

# Add harness guidance to task workflow

## Why

Harnesses only help if future tasks point agents at the right checks before they claim success.

## What success looks like

Forge task guidance tells agents which internal harness to run for CLI, web, core graph, and task-store changes.

## Acceptance Criteria

- Update task creation or guidance docs so web/API changes name `bun run harness:web`.
- Update task creation or guidance docs so CLI workflow changes name `bun run harness:cli`.
- Update broad behavior guidance so cross-surface changes name `bun run harness:check`.
- Keep guidance advisory and readable; do not add strict schema fields.
- Preserve the Markdown-first task format.

## Dependencies

Depends on `F-0055`, `F-0056`, and `F-0053` because the guidance should name working harness commands.

## Verification

- Run `bun run quality:check`.
- Create or dry-run a sample task and confirm the harness guidance is clear.

## Notes

This task should not introduce per-task harness commands such as `harness:task F-0053`.

## History

- Created 2026-05-15T00:00:00-05:00.
