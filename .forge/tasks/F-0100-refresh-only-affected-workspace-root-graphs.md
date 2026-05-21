---
id: F-0100
title: "Refresh only affected workspace root graphs"
kind: task
status: done
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
updated_at: 2026-05-21T19:07:18.228Z
closed_at: 2026-05-21T19:07:18.228Z
close_reason: ""
blocked_reason: ""
review_reason: ""
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

## Execution Plan

1. Extend the web watcher refresh decision from a plain reason to a plan that can identify the owning root for task Markdown changes.
2. Add a small workspace root payload cache to the dev server/API path, with dirty-root invalidation for task changes and full invalidation for root structure changes.
3. Cover owner detection, ambiguous fallback, cached clean-root reuse, and forced full rebuild with focused web tests.

## Dependencies

Tracked in frontmatter: F-0082.

## Verification

- Run focused web watcher/API tests.
- Run bun run harness:web.

## Notes

Follow-up from F-0082. Keep all-repos behavior correct; this is an incremental refresh optimization, not a UX change.

Implemented affected-root workspace refresh. Task Markdown changes now identify the owning watched root and invalidate only that root payload cache entry; root-structure changes and ambiguous ownership clear the root payload cache and force full rediscovery/reload. Added watcher tests for owner detection, ambiguous fallback, task-only cache invalidation, and root-structure full invalidation. Added API tests for clean-root payload reuse and forced full reload.

Verification:
- bun test packages/web/test/watch.test.ts
- bun test packages/web/test/api.test.ts
- bun run harness:web
- bun run quality:check

## History

- Created 2026-05-21T17:46:37.150Z.
