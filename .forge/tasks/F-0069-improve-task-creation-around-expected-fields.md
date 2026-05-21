---
id: F-0069
title: "Improve task creation around expected fields"
kind: task
status: done
priority: high
area: "cli"
parent: "F-0000"
depends_on:
  - "F-0068"
claimed_by: ""
scope:
  - "packages/core/**"
  - "packages/cli/**"
  - ".forge/**"
  - "README.md"
created_at: 2026-05-20T15:37:10.598Z
updated_at: 2026-05-21T15:36:05.021Z
closed_at: 2026-05-21T15:36:05.021Z
close_reason: ""
blocked_reason: ""
review_reason: ""
---
# Improve task creation around expected fields

## Why

The simplest way to make task specs consistent is to make forge create produce good expected fields from the start.

## What success looks like

forge create can create a complete task brief with Why, Success, Acceptance, Verification, and Notes without manual patching.

## Acceptance Criteria

- Ensure forge create always generates the five expected Markdown sections.
- Support --why <text>, --success <text>, repeated --acceptance <text>, repeated --verification <text>, and --notes <text> as the public create surface.
- Preserve existing create behavior for title, priority, area, parent, dependencies, and scope.
- Generated task files remain readable Markdown with frontmatter limited to small structured fields.
- Command metadata, help text, docs, and tests reflect the richer create surface.

## Execution Plan

Summary: Make forge create reliably produce tasks with complete expected fields.

Scope: CLI create args/help/metadata, core task body generation, docs, and focused tests.

Approach:
- Audit existing create support for why, success, acceptance, verification, and notes.
- Fill gaps in command metadata, help text, docs, and tests rather than adding a broader body-edit API.
- Keep generated Markdown readable and keep rich text in the body, not frontmatter.
- Preserve existing create behavior for graph and lifecycle metadata.

Verification:
- bun test packages/cli/test/cli.test.ts packages/core/test/task-files.test.ts
- bun run harness:cli

Stop conditions:
- Stop if the task starts turning into a general Markdown section editor.

Human review triggers:
- Ask for review before adding create-from-stdin or section patching behavior.

## Dependencies

Tracked in frontmatter: F-0068.

## Verification

- bun test packages/cli/test/cli.test.ts packages/core/test/task-files.test.ts
- bun run harness:cli

## Notes

Some create options already exist; this task should verify, document, and close any gaps rather than duplicate behavior.

Audited `forge create` and confirmed core generation already emitted the expected Markdown fields with TODO fallbacks. Completed the first-class create surface by tightening command usage/metadata, examples, docs, and tests around the existing `--why`, `--success`, repeated `--acceptance`, repeated `--verification`, and `--notes` flags.

Decisions:
- Kept rich task text in Markdown body sections and did not add any new frontmatter schema.
- Did not add stdin or section patching behavior; that would be a separate body-editing feature.
- Reused the same create usage string for parser errors and command metadata so help, prompts, and `commands --json` stay aligned.

Verification:
- `bun test packages/cli/test/cli.test.ts packages/core/test/parser.test.ts packages/core/test/write.test.ts`: 82 pass, 434 expect() calls.
- `bun run harness:cli`: 7 pass, 89 expect() calls.
- `bun run quality:check`: 195 pass, 958 expect() calls, web production build passed.

## History

- Created 2026-05-20T15:37:10.598Z.
