---
id: F-0030
title: Add package module boundary guard
kind: task
status: done
priority: high
parent: F-0000
depends_on:
  - F-0029
claimed_by: ""
area: test
scope:
  - packages/**
  - .forge/tasks/**
created_at: 2026-05-15T00:00:00-05:00
updated_at: 2026-05-15T05:30:00.000Z
closed_at: 2026-05-15T05:00:00.000Z
close_reason: "Backfilled by F-0045; timestamp is approximate."
---

# Add package module boundary guard

## Why

Forge's engine should stay independent from the CLI and web UI as robot-mode and guidance features grow.

## What success looks like

A static Bun test enforces package import direction across `core`, `cli`, and `web`, and the guard runs as part of the quality check.

## Acceptance Criteria

- Add a module boundary test for package source files.
- `packages/core` does not import CLI, web, React, Vite, browser APIs, or Bun process/server code.
- `packages/cli` may import core but not web.
- `packages/web` may import core but not CLI.
- New package source files are covered by the boundary scan.
- Boundary failures identify the offending source file and import.
- Include the guard in `bun run quality:check`.

## Dependencies

Depends on `F-0029` because the boundary guard should be part of the shared quality gate.

## Verification

- `bun test packages/core/test/module-boundaries.test.ts` passed.
- `bun run quality:check` passed from the repo root, so the guard runs in the shared quality gate.

## Notes

Added a static Bun test that recursively scans `packages/core/src`, `packages/cli/src`, and `packages/web/src` import declarations and dynamic imports. Failures include the repo-relative source file, offending import, and boundary reason.

## History

- Created 2026-05-15T00:00:00-05:00.
- Claimed and implemented 2026-05-15.
