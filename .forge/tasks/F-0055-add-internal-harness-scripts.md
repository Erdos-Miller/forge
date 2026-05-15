---
id: F-0055
title: Add internal harness scripts
kind: task
status: done
priority: urgent
area: test
parent: F-0000
depends_on:
  - F-0054
claimed_by: ""
scope:
  - package.json
  - packages/**
  - .forge/**
created_at: 2026-05-15T00:00:00-05:00
updated_at: 2026-05-15T15:05:36.713Z
closed_at: 2026-05-15T15:05:36.713Z
close_reason: "Internal harness scripts added and verified"
blocked_reason: ""
review_reason: ""
---

# Add internal harness scripts

## Why

Agents need obvious internal commands for system confidence, separate from customer-facing Forge CLI commands.

## What success looks like

Root package scripts expose a small harness suite for CLI, web, and aggregate checks.

## Acceptance Criteria

- Add root package scripts named `harness:cli`, `harness:web`, and `harness:check`.
- `harness:check` runs the fast internal harnesses plus the normal quality gate, or is called by `quality:check`, without duplicating slow work unnecessarily.
- Document the scripts as internal developer and agent checks in Forge guidance or README content.
- Do not add `forge harness` as a user-facing CLI command.

## Dependencies

Depends on `F-0054` because the harness commands should run against generic fixture repos.

## Verification

- Run `bun run harness:cli`.
- Run `bun run harness:web`.
- Run `bun run harness:check`.
- Run `bun run quality:check`.

## Notes

Keep the first version small. This is not a browser visual regression suite, Storybook replacement, or compatibility registry.

Implementation decision: added root harness scripts without adding a public forge harness command. harness:cli runs the focused CLI workflow harness, harness:web runs the current web test harness, harness:check runs the aggregate package test suite, and quality:check now calls harness:check before the production web build.

Documented the scripts in .forge/README.md as internal developer and agent checks.

Verification:
- bun run harness:cli passed with 5 tests.
- bun run harness:web passed with 14 tests.
- bun run harness:check passed with 132 tests.
- bun run quality:check passed with 132 tests and the web production build.

## History

- Created 2026-05-15T00:00:00-05:00.
