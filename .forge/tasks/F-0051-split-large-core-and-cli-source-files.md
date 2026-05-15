---
id: F-0051
title: Split large core and CLI source files
kind: task
status: done
priority: medium
parent: F-0000
depends_on:
  - F-0031
claimed_by: ""
area: test
scope:
  - "packages/core/src/**"
  - "packages/cli/src/**"
  - "packages/core/test/readability-ratchet.test.ts"
  - ".forge/tasks/**"
created_at: 2026-05-15T00:00:00-05:00
updated_at: 2026-05-15T16:40:05.933Z
closed_at: 2026-05-15T16:40:05.933Z
close_reason: "Split core and CLI modules; ratchet exceptions removed; quality gate passes."
blocked_reason: ""
review_reason: ""
---

# Split large core and CLI source files

## Why

The readability ratchet needs reviewed exceptions for the current large core and CLI entrypoint files. Those exceptions should be temporary, with a tracked cleanup task.

## What success looks like

The core and CLI source surfaces are split by responsibility so their ratchet exceptions can be removed.

## Acceptance Criteria

- Split `packages/core/src/index.ts` into smaller responsibility-focused modules without changing public exports.
- Split `packages/cli/src/index.ts` into smaller command or formatting modules without changing CLI behavior.
- Remove the corresponding readability ratchet exceptions.
- Keep `forge queue`, `forge next`, `forge doctor`, and `forge web` behavior unchanged.

## Execution Plan

1. Correct task scope to include `packages/core/test/readability-ratchet.test.ts`, because removing ratchet exceptions is an acceptance criterion.
2. Split `packages/core/src/index.ts` into responsibility modules while preserving the public `@forge/core` export surface through `index.ts` re-exports.
3. Split `packages/cli/src/index.ts` by moving command metadata, doctor/closeout diagnostics, robot/text formatting, and related helpers into CLI modules without changing command behavior.
4. Remove the F-0051 readability ratchet exceptions once both entrypoint files are under budget and long-line exceptions are unnecessary.
5. Verify the readability ratchet directly, then run `bun run quality:check`, with queue/next/doctor/web covered by existing CLI harness and tests.

## Dependencies

Depends on `F-0031` because this task removes exceptions introduced by the ratchet.

## Verification

- Run the readability ratchet test directly.
- Run `bun run quality:check`.

## Notes

Keep this as a mechanical extraction. Behavior changes should be separate tasks.

Implemented as a mechanical module split.

Decisions:
- Kept `packages/core/src/index.ts` as the public barrel and moved implementation into `types`, `task-files`, `guidance`, `graph`, and `dependencies` modules.
- Kept `packages/cli/src/index.ts` as the executable command router and moved argument parsing, command metadata, doctor/closeout diagnostics, prompt text, and robot/text formatting into focused CLI modules.
- Used explicit `.ts` imports in core internals because the web Vite build imports `@forge/core` source directly through package exports.
- Removed the F-0051 readability ratchet exceptions entirely.

Verification:
- `bun test packages/cli`
- `bun test packages/core/test/readability-ratchet.test.ts`
- `bun run quality:check`

## History

- Created 2026-05-15T00:00:00-05:00.
