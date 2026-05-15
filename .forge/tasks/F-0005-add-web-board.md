---
id: F-0005
title: Add local web board
kind: task
status: done
priority: medium
parent: F-0000
depends_on:
  - F-0002
  - F-0003
claimed_by: ""
scope:
  - packages/**
  - README.md
created_at: 2026-05-14T00:00:00-05:00
updated_at: 2026-05-15T05:30:00.000Z
closed_at: 2026-05-15T01:06:19.000Z
close_reason: "Backfilled by F-0045; timestamp is approximate."
---

# Add local web board

## Context

Forge should eventually feel like Storybook for work: a local, browsable interface over the repository's task graph.

## Acceptance Criteria

- Starts with a local dev command.
- Shows the recommended task queue from Forge's ranking engine.
- Shows a task detail view with Markdown body.
- Highlights ready, claimed, and blocked tasks.
- Reads the same task files as the CLI.

## Notes

The web app should not introduce a separate source of truth.

Claimed by codex for the Vite React TypeScript web board implementation pass.

Implemented a read-only Vite, React, and TypeScript web board in `packages/web`. The board reads the same `.forge/tasks` files through `@forge/core`, serves `/api/tasks` from Vite middleware, shows a recommended queue with supporting blocked/done summaries, and renders task details with Markdown body, dependencies, scope, and blockers.

Verification: `bun test` passed in `packages/core`, `packages/cli`, and `packages/web`; `bun run build` passed in `packages/web`. Local smoke checks passed for `http://localhost:5174/` and `http://localhost:5174/api/tasks`.

Follow-up UI iteration replaced the status-column board with a dark-only, queue-first view for a single agent consuming work. The main list now uses Forge ranking, supports grouping by area or priority, gives list/detail an even split, and keeps task titles ahead of internal IDs. A converted Fluxchart bead set was copied to `/private/tmp/forge-fluxchart-demo` as real-world sample data, outside the Forge repo.

Verification: `bun test` and `bun run build` passed in `packages/web`. The dev server is running against `/private/tmp/forge-fluxchart-demo` at `http://localhost:5174/`.

Follow-up UI iteration simplified queue rows to rank, priority dot, title, and compact right-side badges only when useful. Dependencies moved into a selected-task dependency list, the queue/detail layout now fills the viewport, the queue scrolls independently, and the header includes a scope filter derived from task scope roots for monorepo/project narrowing.

Follow-up data and navigation pass added optional `closed_at` and `close_reason` fields to the core task model for completion analytics. The Fluxchart demo import in `/private/tmp/forge-fluxchart-demo` now preserves bead close metadata for 316 tasks. The web app now has a top-level app nav with Queue as the default view and an Analytics tab scaffold ready for burndown work.

Analytics now includes a task-count burndown chart using `created_at` and `closed_at`, plus a dashed projection line based on recent calendar-day close rate. This is intentionally count-based until Forge has estimates or working-calendar metadata.

Follow-up task-shape pass kept the machine schema small and moved the new human structure into canonical Markdown sections. The core package now exposes task creation helpers, `forge create` writes tasks with `Why`, `What success looks like`, acceptance, dependency, verification, notes, and history sections, and `forge done` records `closed_at` for analytics. The Fluxchart demo task set was backfilled with `Why` sections derived from existing context/goal text.

Follow-up detail cleanup demoted dependencies from a top-level detail block into a collapsed lower disclosure. The primary detail reading order is now why, success, acceptance, verification, notes, then lower-priority supporting sections.

Follow-up readability pass reshaped the selected task detail into a task brief: compact status/id kicker, larger title and recommendation reason, prominent Why, boxed success state, scannable acceptance criteria, command-like verification, quiet footer metadata, and collapsed supporting sections.

Follow-up detail layout pass removed the special success card treatment, switched sections to a wider two-column reading layout, enlarged Why, centered the priority dot with the title, collapsed Verification, and preferred Atkinson Hyperlegible in the font stack with Inter/system fallbacks.

Follow-up alignment pass moved task and collapsed section bodies onto the same second-column grid, including notes and supporting disclosures. Rendered Markdown list markers now use dash-style bullets for a cleaner task-document feel.

Follow-up visual hierarchy pass moved the priority dot into the status/id kicker and increased selected-task body text for easier reading at a glance.
