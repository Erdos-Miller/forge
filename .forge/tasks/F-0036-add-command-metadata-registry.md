---
id: F-0036
title: Add command metadata registry
kind: task
status: done
priority: urgent
parent: F-0000
depends_on:
  - F-0014
claimed_by: ""
area: cli
scope:
  - packages/cli/**
  - .forge/tasks/**
created_at: 2026-05-15T00:00:00-05:00
updated_at: 2026-05-15T05:30:00.000Z
closed_at: 2026-05-15T05:00:00.000Z
close_reason: "Backfilled by F-0045; timestamp is approximate."
---

# Add command metadata registry

## Why

Agent guidance should not drift from the actual CLI command surface. Forge needs one source of truth for command usage, examples, and agent-loop purpose.

## What success looks like

The CLI has a typed command metadata registry that generates usage text and can later power agent help, prompts, and JSON command discovery.

## Acceptance Criteria

- Add a typed command registry for every runnable CLI command.
- Metadata includes command name, usage, short description, read/write classification, JSON support, examples, and agent-loop purpose.
- Generate the top-level usage text from the registry instead of a hand-written command list.
- Preserve existing command behavior and exit codes.
- Tests assert every command handled by the CLI is represented in the registry.
- Tests assert top-level usage includes all registered commands in stable order.

## Dependencies

Depends on `F-0014` because the current robot/next command surface should be present before locking the registry.

## Verification

- `bun test packages/cli/test/cli.test.ts` passed.
- `bun run quality:check` passed from the repo root.
- `forge --help` printed usage from the registry.
- `forge no-such-command` returned exit `1` with the generated usage text.

## Notes

Added exported `COMMANDS` metadata in `packages/cli` and generated top-level usage from it. CLI dispatch now goes through a typed handler map keyed by the registered command names, and tests assert command coverage plus stable help ordering.

## History

- Created 2026-05-15T00:00:00-05:00.
- Claimed and implemented 2026-05-15.
