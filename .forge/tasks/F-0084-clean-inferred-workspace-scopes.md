---
id: F-0084
title: "Clean inferred workspace scopes"
kind: task
status: open
priority: high
area: "web"
parent: "F-0000"
depends_on:
  - "F-0080"
claimed_by: ""
scope:
  - "packages/web/**"
  - "packages/core/**"
  - ".forge/**"
created_at: 2026-05-21T11:54:53-05:00
updated_at: 2026-05-21T11:54:53-05:00
---
# Clean inferred workspace scopes

## Why

The Scope selector currently shows raw task edit paths, including deep files and component directories, which is not the intended work-slice concept.

## What success looks like

When no explicit scope config exists, the web UI infers readable coarse scopes instead of dumping every task frontmatter `scope` path.

## Acceptance Criteria

- Do not show raw single-file or deep component paths in the header Scope selector.
- Infer coarse work scopes from stable path prefixes.
- Group ambiguous or rare paths under `Other`.
- In All worktrees, avoid showing a massive combined raw path list.
- Keep task frontmatter `scope` available in task details as edit-boundary information.
- Tests cover monorepo-like paths, single-file scopes, deep component scopes, and ambiguous paths.

## Execution Plan

Summary: Improve fallback scope inference before introducing explicit scope config.

Scope: Web scope option derivation, helper tests, and fixture data.

Approach:
- Extract scope inference into a named helper.
- Collapse common path patterns to readable prefixes.
- Exclude or group overly specific paths.
- Keep the current task matching behavior until explicit scope matching is designed, or update matching in the same helper if needed for consistency.
- Add monorepo-style fixtures that reflect ToolHub, Fluxchart, UI, and Other-like paths.

Verification:
- `bun run harness:web`
- Focused scope inference tests.

Stop conditions:
- Stop if inference rules become product-specific enough to require explicit config first.

Human review triggers:
- Ask for review if inferred labels are subjective or likely to misrepresent a work slice.

## Dependencies

Tracked in frontmatter: F-0080.

## Verification

- Run focused web scope tests.
- Run `bun run harness:web`.

## Notes

This is a fallback cleanup, not the long-term source of truth for monorepo work scopes.

## History

- Created 2026-05-21T11:54:53-05:00.
