---
id: F-0069
title: "Improve task creation around expected fields"
kind: task
status: open
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
updated_at: 2026-05-20T15:38:09.656Z
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

## History

- Created 2026-05-20T15:37:10.598Z.
