---
id: F-0097
title: "Parallelize downward Forge-root discovery"
kind: task
status: open
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
updated_at: 2026-05-21T17:46:05.931Z
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

## Dependencies

Tracked in frontmatter: F-0082.

## Verification

- Run focused core workspace discovery tests.
- Run bun run harness:check.

## Notes

Follow-up from F-0082. Do not shell out to fd or rg; keep discovery portable in TypeScript.

## History

- Created 2026-05-21T17:46:05.931Z.
