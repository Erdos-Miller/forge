---
id: F-0084
title: "Clean inferred workspace scopes"
kind: task
status: done
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
updated_at: 2026-05-21T17:53:32.202Z
closed_at: 2026-05-21T17:53:32.202Z
close_reason: "Web Scope selector now uses coarse inferred scope labels while preserving raw edit-boundary scopes in task details."
blocked_reason: ""
review_reason: ""
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
Not applicable.

Human review triggers:
Not applicable.

## Dependencies

Tracked in frontmatter: F-0080.

## Verification

- Run focused web scope tests.
- Run `bun run harness:web`.

## Notes

This is a fallback cleanup, not the long-term source of truth for monorepo work scopes.

Implemented fallback workspace scope inference for the web Scope selector.

Decisions:
- Extracted scope inference into `packages/web/src/scopes.ts`.
- Scope selector now shows coarse inferred labels such as `packages/web`, `lib/typescript/ui`, `product/toolhub`, `.forge`, and `Other` instead of raw task edit paths.
- Single-file scopes and ambiguous uncommon paths group under `Other`.
- Task matching uses the same inferred labels, while task detail still shows the original frontmatter `scope` globs as edit-boundary information.
- Kept this as fallback inference only; explicit configured scopes remain future work.

Verification:
- `bun test packages/web/test/scopes.test.ts packages/web/test/app.test.tsx` passed: 32 tests, 122 expects.
- `bun run harness:web` passed: 52 tests, 203 expects.
- `bun run quality:check` passed: 225 tests, 1093 expects, web production build passed.

## History

- Created 2026-05-21T11:54:53-05:00.
