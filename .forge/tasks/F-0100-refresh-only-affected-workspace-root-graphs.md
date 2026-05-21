---
id: F-0100
title: "Refresh only affected workspace root graphs"
kind: task
status: open
priority: medium
area: "web"
parent: "F-0000"
depends_on:
  - "F-0082"
claimed_by: ""
scope:
  - "packages/web/**"
  - "packages/core/**"
  - ".forge/**"
created_at: 2026-05-21T17:46:37.150Z
updated_at: 2026-05-21T17:46:37.150Z
---
# Refresh only affected workspace root graphs

## Why

After F-0082 avoids repeated discovery, task-file changes still rebuild more workspace data than necessary.

## What success looks like

A task-file change refreshes the affected root graph where possible, while root structure changes still trigger full root rediscovery.

## Acceptance Criteria

- Detect which watched root owns a task-file change.
- Reload only the affected root graph for task-only changes when the current API/cache state allows it.
- Fall back to full workspace rebuild for root structure changes or ambiguous ownership.
- Cover affected-root refresh and full-refresh fallback with watcher/API tests.

## Dependencies

Tracked in frontmatter: F-0082.

## Verification

- Run focused web watcher/API tests.
- Run bun run harness:web.

## Notes

Follow-up from F-0082. Keep all-repos behavior correct; this is an incremental refresh optimization, not a UX change.

## History

- Created 2026-05-21T17:46:37.150Z.
