---
id: F-0070
title: "Add task brief quality warnings"
kind: task
status: open
priority: medium
area: "cli"
parent: "F-0000"
depends_on:
  - "F-0068"
  - "F-0069"
claimed_by: ""
scope:
  - "packages/core/**"
  - "packages/cli/**"
  - ".forge/**"
created_at: 2026-05-20T15:37:21.822Z
updated_at: 2026-05-20T15:38:09.695Z
---
# Add task brief quality warnings

## Why

Forge should nudge agents away from vague task specs without making old or imported Markdown tasks invalid.

## What success looks like

forge doctor --json warns when expected task fields are missing or still placeholder text.

## Acceptance Criteria

- Doctor warns for missing or placeholder Why.
- Doctor warns for missing or placeholder What success looks like.
- Doctor warns for empty or placeholder Acceptance Criteria.
- Doctor warns for empty or placeholder Verification.
- Notes may be empty without warning.
- Warnings include task id, source path, and a repair hint.
- Warnings do not affect task loading, queue ranking, or prompt generation.

## Execution Plan

Summary: Add advisory doctor warnings for weak or placeholder task briefs.

Scope: Doctor diagnostics, section parsing helpers, repair hints, and tests.

Approach:
- Reuse parsed Markdown sections to inspect the expected task fields.
- Warn for missing or placeholder Why, What success looks like, Acceptance Criteria, and Verification.
- Treat empty Notes as acceptable.
- Keep warnings advisory and out of queue readiness decisions.

Verification:
- bun test packages/cli/test/doctor.test.ts packages/core/test/task-files.test.ts
- bun run harness:cli

Stop conditions:
- Stop if warnings become noisy for existing completed historical tasks; document any filtering decision before implementing.

Human review triggers:
- Ask for review if placeholder detection needs subjective language rules.

## Dependencies

Tracked in frontmatter: F-0068, F-0069.

## Verification

- bun test packages/cli/test/doctor.test.ts packages/core/test/task-files.test.ts
- bun run harness:cli

## Notes

These should be advisory warnings only; do not turn expected fields into hard schema requirements.

## History

- Created 2026-05-20T15:37:21.822Z.
