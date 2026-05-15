---
id: F-0028
title: Add guidance doctor checks
kind: task
status: done
priority: medium
parent: F-0000
depends_on:
  - F-0016
  - F-0024
claimed_by: ""
area: cli
scope:
  - packages/core/**
  - packages/cli/**
  - .forge/tasks/**
created_at: 2026-05-15T00:00:00-05:00
updated_at: 2026-05-15T16:05:03.039Z
closed_at: 2026-05-15T16:05:03.039Z
close_reason: "Verified guidance doctor tests, package tests, quality check, and malformed guidance smoke."
blocked_reason: ""
review_reason: ""
---

# Add guidance doctor checks

## Why

Guidance routing should fail visibly when repo configuration is broken, especially because agents will depend on it for context.

## What success looks like

`forge doctor --json` reports guidance configuration problems with stable diagnostic codes and actionable messages.

## Acceptance Criteria

- Doctor reports invalid `.forge/guidance.yml`.
- Doctor reports missing guidance include files.
- Doctor reports unreadable guidance files.
- Doctor warns if `.forge/local/**` appears tracked or intended for commit.
- Doctor reports duplicate include resolution when it indicates suspicious config.
- Tests cover each guidance diagnostic.

## Execution Plan

1. Add a core guidance-config inspection helper that validates the whole guidance file, checks every include, flags exact duplicate routes, and warns when `.forge/local/**` files are not ignored.
2. Wire `forge doctor --json` to map guidance diagnostics into stable doctor codes with repair hints.
3. Align local user guidance resolution with the documented `.forge/local/user.md` path.
4. Add focused CLI doctor tests for invalid config, missing include, unreadable include, duplicate route, and unignored local guidance.
5. Verify with focused tests, package tests, quality check, and malformed guidance smoke output.

## Dependencies

Depends on `F-0016` for doctor and `F-0024` for guidance command behavior.

## Verification

- Run `bun test` in `packages/core` and `packages/cli`.
- Smoke-check doctor output on malformed guidance fixtures.

## Notes

This task extends doctor after the main guidance command exists. It should not block the initial guidance resolver.

Implemented guidance doctor checks. `forge doctor --json` now validates `.forge/guidance.yml`, checks all configured includes even when they do not match the current context, reports missing and unreadable includes, warns on exact duplicate include routes, and warns when `.forge/local/**` files exist without an ignore rule. Local user guidance resolution now follows the documented `.forge/local/user.md` path.

Verification:
- `bun test packages/core/test/guidance.test.ts packages/cli/test/guidance-doctor.test.ts`
- `bun test packages/core packages/cli`
- `bun run quality:check`
- Temp-store smoke at `/private/tmp/forge-guidance-doctor-smoke-XYtuzN` reported `missing_guidance_include` and `unreadable_guidance_include`.

## History

- Created 2026-05-15T00:00:00-05:00.
