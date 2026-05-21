---
id: F-0097
title: "Parallelize downward Forge-root discovery"
kind: task
status: done
priority: high
area: "core"
parent: "F-0000"
depends_on:
  - "F-0082"
claimed_by: ""
scope:
  - "packages/core/**"
  - ".forge/**"
created_at: 2026-05-21T17:46:05.931Z
updated_at: 2026-05-21T18:06:24.826Z
closed_at: 2026-05-21T18:06:24.826Z
close_reason: "Implemented bounded-concurrency downward root discovery with stable output and fixture coverage; focused, harness, and quality checks pass."
blocked_reason: ""
review_reason: ""
---
# Parallelize downward Forge-root discovery

## Why

Workspace discovery currently walks large directory trees serially, which makes broad workspaces slow before the web API can load task graphs.

## What success looks like

Forge root discovery can traverse large fixture workspaces with bounded concurrency while preserving stable root ordering and existing semantics.

## Acceptance Criteria

- Use bounded-concurrency traversal for downward Forge-root discovery.
- Preserve stable sorted output and root metadata.
- Preserve existing ignore behavior and nested-root stopping behavior.
- Add fixture coverage that proves concurrency is bounded and faster than serial traversal on a synthetic large tree.

## Execution Plan

Summary: Replace serial downward root discovery with a bounded-concurrency traversal.

Scope: Core discovery helper and workspace discovery tests.

Approach:
- Keep the public `discoverForgeRootsDownward(startDir)` API unchanged.
- Traverse directories with a small async worker pool and shared queue.
- Preserve early stop at discovered `.forge` roots and existing ignored directory names.
- Sort final root metadata by id for stable output.
- Add fixture tests that verify concurrency is bounded and that concurrent traversal completes faster than a serial walk under artificial readdir delay.

Verification:
- `bun test packages/core/test/workspace.test.ts`
- `bun run harness:check`

Stop conditions:
Not applicable.

Human review triggers:
Not applicable.

## Dependencies

Tracked in frontmatter: F-0082.

## Verification

- Run focused core workspace discovery tests.
- Run bun run harness:check.

## Notes

Follow-up from F-0082. Do not shell out to fd or rg; keep discovery portable in TypeScript.

Implemented bounded-concurrency downward Forge-root discovery in core. The traversal now reads each directory level concurrently with a default cap while preserving ignored directory names, nested-root stopping, and stable sorted root metadata.

Verification:
- `bun test packages/core/test/workspace.test.ts` passed: 6 tests, including bounded concurrency and delayed serial-vs-parallel fixture coverage.
- `bun run harness:check` passed: 232 tests, 1117 expects.
- `bun run quality:check` passed: 232 tests, 1117 expects, and `packages/web` production build completed.

## History

- Created 2026-05-21T17:46:05.931Z.
