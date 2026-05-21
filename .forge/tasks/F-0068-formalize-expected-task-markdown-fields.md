---
id: F-0068
title: "Formalize expected task Markdown fields"
kind: task
status: done
priority: high
area: "core"
parent: "F-0000"
depends_on: []
claimed_by: ""
scope:
  - ".forge/**"
  - "packages/core/**"
  - "packages/web/**"
  - "packages/cli/**"
created_at: 2026-05-20T15:37:01.176Z
updated_at: 2026-05-21T14:55:33.789Z
closed_at: 2026-05-21T14:55:33.789Z
close_reason: "Expected Markdown task fields documented and recognized; focused tests and quality check passed."
blocked_reason: ""
review_reason: ""
---
# Formalize expected task Markdown fields

## Why

Forge needs a standard task brief shape without moving rich prose into frontmatter or turning the CLI into a Markdown CMS.

## What success looks like

Forge documents and internally recognizes Why, What success looks like, Acceptance Criteria, Verification, and Notes as expected Markdown task fields.

## Acceptance Criteria

- Document the five expected task fields as Markdown sections: Why, What success looks like, Acceptance Criteria, Verification, and Notes.
- Clarify that missing expected fields are warnings, not task parse errors.
- Clarify that direct Markdown edits remain valid for rich task body changes.
- Keep Execution Plan, Dependencies, and History as supported sections, but not part of the minimal expected brief.
- Section parsing remains tolerant of unknown extra sections.

## Execution Plan

Summary: Make the expected task brief fields an explicit Markdown-section convention.

Scope: Task format docs, section parsing helpers if needed, and any tests that encode canonical section order.

Approach:
- Rename the concept from loose canonical sections to expected task fields where appropriate.
- Document Why, What success looks like, Acceptance Criteria, Verification, and Notes as the minimal expected brief.
- Keep Execution Plan, Dependencies, and History as supported sections without making them part of the minimal brief.
- Confirm section parsing and rendering continue to tolerate unknown sections.

Verification:
- bun test packages/core/test/task-files.test.ts packages/web/test/sections.test.ts
- bun run quality:check

Stop conditions:
- Stop if making the wording precise would imply a hard schema migration.

Human review triggers:
- Ask for review if the expected field names need to change.

## Dependencies

None.

## Verification

- bun test packages/core/test/task-files.test.ts packages/web/test/sections.test.ts
- bun run quality:check

## Notes

This task establishes the convention before create, doctor, prompt, or web behavior depend on it.

Implemented expected task Markdown field convention.

Decisions:
- Added core constants for the expected task brief fields and supported task Markdown sections.
- Updated `.forge/README.md` to describe expected fields as Markdown-section conventions, not frontmatter schema or parse requirements.
- Kept `Execution Plan`, `Dependencies`, and `History` as supported sections outside the minimal expected brief.
- Confirmed unknown sections remain tolerated and renderable through existing parser/web tests.

Verification:
- `bun test packages/core/test/parser.test.ts packages/core/test/write.test.ts packages/web/test/sections.test.ts` passed: 30 tests, 0 failures.
- `bun run quality:check` passed: 191 tests, 0 failures, web production build passed.

Closeout review resolution:
- Expected field names stayed exactly as specified in the task acceptance criteria: Why, What success looks like, Acceptance Criteria, Verification, and Notes.
- No hard schema migration was introduced; missing fields remain a future doctor warning, not a parse error.

## History

- Created 2026-05-20T15:37:01.176Z.
