---
id: F-0108
title: "Add monorepo project fixture coverage"
kind: task
status: done
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
updated_at: 2026-05-21T20:35:32.887Z
closed_at: 2026-05-21T20:35:32.887Z
close_reason: "Added synthetic monorepo Project fixture coverage for web filtering and Area grouping."
blocked_reason: ""
review_reason: ""
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

Implemented monorepo Project fixture coverage using synthetic test data only.

Fixture choices:
- Product paths: `product/toolhub/src/app/wells/**`, `product/toolhub/src/app/travelers/**`, and `product/toolhub/docs/wells/**`.
- Shared library paths: `lib/typescript/fluxchart/**`, `lib/typescript/fluxchart/comparisons/**`, `lib/typescript/travelers/**`, and `lib/typescript/ui/**`.
- Canonical example Projects for tests: Toolhub Wells, Toolhub Travelers, Fluxchart, and Shared UI.
- Example Areas covered: web, core, docs, test, and harness.

Assertions added:
- Configured Projects render as header Project options.
- Area grouping remains independent from Project filtering.
- Raw edit-scope globs do not become header Project options.
- Project filtering uses configured path overlap and leaves `All projects` as the all-work view.

Closeout trigger review:
- Decision capture is in these Notes.
- Stop condition did not fire: the fixture is synthetic and does not scan the real `~/Work/repo` tree.
- Human review trigger did not fire: the requested Toolhub, Travelers, Fluxchart, and Shared UI examples were enough for the fixture.

Verification:
- `bun test packages/web/test/monorepo-projects.test.tsx` passed: 2 tests.
- `bun run harness:web` passed: 72 tests.

## History

- Created 2026-05-21T14:50:37-05:00.
