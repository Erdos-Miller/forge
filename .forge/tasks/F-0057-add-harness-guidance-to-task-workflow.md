---
id: F-0057
title: Add harness guidance to task workflow
kind: task
status: done
priority: high
area: docs
parent: F-0000
depends_on:
  - F-0055
  - F-0056
  - F-0053
claimed_by: ""
scope:
  - .forge/**
  - packages/cli/**
created_at: 2026-05-15T00:00:00-05:00
updated_at: 2026-05-15T19:38:33.036Z
closed_at: 2026-05-15T19:38:33.036Z
close_reason: "Advisory harness guidance added to docs and generated prompts; quality gate passes."
blocked_reason: ""
review_reason: ""
---

# Add harness guidance to task workflow

## Why

Harnesses only help if future tasks point agents at the right checks before they claim success.

## What success looks like

Forge task guidance tells agents which internal harness to run for CLI, web, core graph, and task-store changes.

## Acceptance Criteria

- Update task creation or guidance docs so web/API changes name `bun run harness:web`.
- Update task creation or guidance docs so CLI workflow changes name `bun run harness:cli`.
- Update broad behavior guidance so cross-surface changes name `bun run harness:check`.
- Keep guidance advisory and readable; do not add strict schema fields.
- Preserve the Markdown-first task format.

## Execution Plan

1. Update `.forge/README.md` so internal harness guidance explicitly maps web/API work to `bun run harness:web`, CLI workflow work to `bun run harness:cli`, and broad or cross-surface work to `bun run harness:check` plus `bun run quality:check` before closeout.
2. Update `.forge/guidance/forge.md` with the same advisory mapping so routed Forge guidance can surface it in agent prompts.
3. Update the generic CLI prompt command guidance to include the harness mapping for all generated task prompts without adding schema fields or task-specific harness commands.
4. Add or adjust prompt guidance tests so the generated prompts preserve the harness advice.
5. Verify with a sample prompt/dry-run output, then run `bun run quality:check`.

## Dependencies

Depends on `F-0055`, `F-0056`, and `F-0053` because the guidance should name working harness commands.

## Verification

- Run `bun run quality:check`.
- Create or dry-run a sample task and confirm the harness guidance is clear.

## Notes

This task should not introduce per-task harness commands such as `harness:task F-0053`.

Added advisory harness guidance without changing the task schema.

Decisions:
- Expanded `.forge/README.md` internal harness guidance to map web/API changes to `bun run harness:web`, CLI workflow changes to `bun run harness:cli`, and broad graph/task-store/cross-surface changes to `bun run harness:check`.
- Added the same mapping to `.forge/guidance/forge.md` so routed Forge guidance can surface it in prompts.
- Added the mapping to generated prompt command guidance so normal task prompts point agents at the right internal checks even when no route-specific guidance matches.
- Kept this advisory and Markdown-first; no new frontmatter fields or per-task harness commands were added.

Verification:
- `bun test packages/cli/test/prompt-guidance.test.ts`
- `forge prompt F-0057` sample output includes `bun run harness:web`, `bun run harness:cli`, and `bun run harness:check`.
- `bun run quality:check`

## History

- Created 2026-05-15T00:00:00-05:00.
