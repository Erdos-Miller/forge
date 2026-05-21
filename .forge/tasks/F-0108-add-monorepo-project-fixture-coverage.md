---
id: F-0108
title: "Add monorepo project fixture coverage"
kind: task
status: open
priority: high
area: "test"
parent: "F-0000"
depends_on:
  - "F-0106"
claimed_by: ""
scope:
  - "packages/core/**"
  - "packages/cli/**"
  - "packages/web/**"
  - ".forge/**"
created_at: 2026-05-21T14:50:37-05:00
updated_at: 2026-05-21T14:50:37-05:00
---
# Add monorepo project fixture coverage

## Why

The Project model exists mainly for large monorepos, so tests should exercise a realistic product/lib layout instead of only small package fixtures.

## What success looks like

Forge fixtures prove Projects, Areas, and task edit scopes remain distinct in a monorepo-shaped task graph.

## Acceptance Criteria

- Add a fixture shaped like `product/toolhub`, `lib/typescript/fluxchart`, and `lib/typescript/travelers`.
- Include Projects such as Toolhub Wells, Toolhub Travelers, Fluxchart, and Shared UI.
- Include Areas such as `web`, `core`, `docs`, `test`, and `harness`.
- Assert configured Projects appear in the web selector.
- Assert Area grouping remains separate from Project filtering.
- Assert raw edit scopes never become header Projects.

## Execution Plan

Summary: Add realistic monorepo coverage for the new Project terminology and filtering model.

Scope: Fixture helpers and focused CLI/web tests.

Approach:
- Extend existing Forge fixture builders rather than creating a new test package.
- Build tasks that touch both product and shared library paths.
- Add configured Projects that intentionally overlap shared paths.
- Assert filter and grouping behavior through public APIs or rendered UI.
- Keep fixtures under temporary directories.

Verification:
- Focused monorepo fixture tests.
- `bun run harness:web`.
- `bun run harness:cli` if CLI output is covered.

Stop conditions:
- Stop if fixtures need to scan the real `~/Work/repo` tree.

Human review triggers:
- Ask for review if additional Project examples are needed beyond Toolhub, Travelers, Fluxchart, and Shared UI.

## Dependencies

Tracked in frontmatter: F-0106.

## Verification

- Run focused monorepo fixture tests.
- Run `bun run harness:web`.

## Notes

Do not use the developer's real monorepo as a test fixture.

Decision capture required: if the fixture establishes canonical example Projects for monorepos, record that choice in task Notes or a durable `.forge/decisions/` record before closeout.

## History

- Created 2026-05-21T14:50:37-05:00.
