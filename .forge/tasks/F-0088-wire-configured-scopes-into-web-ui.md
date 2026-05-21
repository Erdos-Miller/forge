---
id: F-0088
title: "Wire configured scopes into web UI"
kind: task
status: open
priority: high
area: "web"
parent: "F-0000"
depends_on:
  - "F-0086"
  - "F-0087"
claimed_by: ""
scope:
  - "packages/web/**"
  - "packages/core/**"
  - ".forge/**"
created_at: 2026-05-21T11:54:53-05:00
updated_at: 2026-05-21T11:54:53-05:00
---
# Wire configured scopes into web UI

## Why

The web Scope selector should use the repo's explicit work-slice configuration when available.

## What success looks like

The web UI shows configured scope labels from `.forge/scopes.yml`, falls back to cleaned inference when absent, and still treats task frontmatter `scope` as edit-boundary data.

## Acceptance Criteria

- Load configured scopes into the web workspace payload.
- Use configured scope labels and matching rules in the header Scope selector.
- Fall back to cleaned inferred scopes when no config exists.
- Preserve task detail display of raw edit-boundary scope globs.
- Support per-worktree configured scopes in workspace mode.
- Tests cover configured scopes, fallback inference, all-worktree behavior, and unmatched tasks.

## Execution Plan

Summary: Connect explicit scope configuration to the workspace web filters.

Scope: Web API payload, workspace helpers, UI filter behavior, and tests.

Approach:
- Add resolved scope data to the web payload.
- Update the Scope selector to use resolved user-facing scopes instead of raw task edit scopes.
- Match tasks using configured path globs when a configured scope is selected.
- Preserve readable fallback behavior from F-0084.
- Add workspace fixture coverage with multiple roots using different scope configs.

Verification:
- `bun run harness:web`
- Focused web scope rendering and matching tests.

Stop conditions:
- Stop if configured scope matching conflicts with the terminology decision from F-0080.

Human review triggers:
- Ask for visual review if the Scope selector behavior or labels materially change.

## Dependencies

Tracked in frontmatter: F-0086, F-0087.

## Verification

- Run focused web scope config tests.
- Run `bun run harness:web`.

## Notes

This task should make the UI Scope concept match the product intent without changing task frontmatter semantics.

## History

- Created 2026-05-21T11:54:53-05:00.
