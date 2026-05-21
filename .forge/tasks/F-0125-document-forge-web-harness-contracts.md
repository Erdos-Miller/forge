---
id: F-0125
title: "Document Forge web harness contracts"
kind: task
status: open
priority: high
project: "forge"
area: "docs"
parent: "F-0000"
depends_on:
  - "F-0121"
  - "F-0123"
claimed_by: ""
scope:
  - "README.md"
  - "docs/**"
  - "packages/cli/**"
  - ".forge/tasks/**"
created_at: 2026-05-21T17:26:34-05:00
updated_at: 2026-05-21T17:26:34-05:00
closed_at: ""
close_reason: ""
blocked_reason: ""
review_reason: ""
---
# Document Forge web harness contracts

## Why

Future agents need durable guidance that layout-sensitive Forge web work starts from executable browser contracts, not screenshots or ad hoc manual refreshes.

## What success looks like

Forge documentation and prompt guidance point agents to the web layout harness and explain when to add telemetry-driven layout contracts before touching CSS.

## Acceptance Criteria

- Add repo-level harness contract documentation for Forge web layout work.
- Store the contract under normal Forge repo docs, such as `docs/harness-contracts/web-layout.md`, not inside user `.forge` state.
- Document that Forge web layout work uses Playwright geometry and machine-readable telemetry, not screenshot snapshots.
- Reference `bun run harness:web:layout` from agent prompt guidance.
- Explain when agents should add a layout contract before changing CSS.
- Keep the guidance concise and practical.
- Do not add user-store files or require user repos to carry Forge harness docs.

## Execution Plan

Summary: Document the harness-first rule for Forge web layout changes.

Scope: Repo docs, README pointers, and prompt guidance.

Approach:
- Create `docs/harness-contracts/web-layout.md`.
- Link it from the root README harness section.
- Update generated prompt guidance to mention `harness:web:layout` for web header, navigation, responsive layout, or CSS changes.
- Keep `.forge` task state separate from product harness documentation.

Verification:
- Focused prompt guidance tests if prompt text changes.
- `bun run harness:cli`
- `bun run harness:web`

Stop conditions:
- Stop if the doc starts describing app-specific decision records or user repo policies outside Forge's own development workflow.

Human review triggers:
- Ask for review if the doc needs to settle a product-visible layout policy beyond harness expectations.

## Dependencies

Tracked in frontmatter: F-0121, F-0123.

## Verification

- Run focused prompt tests when prompt guidance changes.
- Run CLI and web harnesses if both docs and prompt guidance change.

## Notes

This task intentionally moves new harness guidance into normal repo docs, not `.forge` user state.

## History

- Created 2026-05-21T17:26:34-05:00.
