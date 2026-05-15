---
id: F-0032
title: Define execution plan section
kind: task
status: done
priority: high
parent: F-0000
depends_on:
  - F-0029
claimed_by: ""
area: docs
scope:
  - .forge/README.md
  - .forge/tasks/**
created_at: 2026-05-15T00:00:00-05:00
updated_at: 2026-05-15T04:55:13.503Z
closed_at: 2026-05-15T04:55:13.503Z
close_reason: ""
---

# Define execution plan section

## Why

Agents need a durable place to record the per-task implementation plan before code changes start. Prompt context alone is too easy to lose across handoffs, interruptions, or review loops.

## What success looks like

Forge documents `## Execution Plan` as a first-class task body section that stays readable as Markdown and gives agents enough structure to continue work from the task file.

## Acceptance Criteria

- Document `Execution Plan` in `.forge/README.md` as a canonical Markdown section.
- Place `Execution Plan` after `Acceptance Criteria` and before `Dependencies` in the documented section order.
- Define the default plan shape: summary, scope, approach, verification, stop conditions, and human review triggers.
- Make clear that execution plans live in the Markdown body, not frontmatter.
- Make clear that tools should preserve existing plans and unknown sections.
- Add or update one example task snippet showing the section.

## Dependencies

Depends on `F-0029` so the quality closeout command exists before adding more agent-loop conventions.

## Verification

- Review `.forge/README.md` for the new section order and default execution plan shape.
- Run `bun run quality:check`.

## Notes

Keep this as a convention task only. Do not add parser, CLI, or web behavior here.

Documented `Execution Plan` as a Markdown-body section immediately after `Acceptance Criteria`. The default shape covers summary, scope, approach, verification, stop conditions, and human review triggers, while tools remain responsible for preserving existing plans and unknown sections.

Verification:
- Reviewed `.forge/README.md` section order and task snippet.
- `bun run quality:check`

## History

- Created 2026-05-15T00:00:00-05:00.
- Documented the execution plan section convention.
