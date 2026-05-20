---
id: F-0067
title: "Add personal user guidance"
kind: task
status: open
priority: high
area: "cli"
parent: "F-0000"
depends_on:
  - "F-0066"
claimed_by: ""
scope:
  - "packages/cli/**"
  - "README.md"
  - ".forge/**"
created_at: 2026-05-20T15:36:51.078Z
updated_at: 2026-05-20T15:38:09.581Z
---
# Add personal user guidance

## Why

Personal preferences are useful for agents, but they should live outside repo task state and outside hidden project routing.

## What success looks like

A user can define one local personal guidance file and Forge includes it clearly in generated task and loop prompts when present.

## Acceptance Criteria

- Define the personal guidance path as ~/.config/forge/guidance.md.
- Add a read command, likely forge user-guidance, that prints the file contents or reports that no personal guidance exists.
- Include personal guidance in forge prompt <id|next> and forge loop-prompt when the file exists.
- Prompt output clearly labels the content as personal user guidance.
- Missing personal guidance is not an error and does not add noisy prompt text.
- Do not add repo-local or project-local user guidance in this pass.

## Execution Plan

Summary: Add one explicit personal guidance path and include it in generated prompts.

Scope: CLI command metadata/help, prompt formatting, docs, and focused tests.

Approach:
- Add a small reader for ~/.config/forge/guidance.md that treats missing files as empty.
- Add a read-only CLI command that prints personal guidance or a concise no-guidance message.
- Thread the resolved personal guidance into forge prompt and forge loop-prompt output with a clear heading.
- Cover missing-file and present-file behavior without requiring repo-local guidance files.

Verification:
- bun test packages/cli/test/cli.test.ts packages/cli/test/prompt-guidance.test.ts
- bun run harness:cli

Stop conditions:
- Stop if prompt inclusion would require project/repo guidance routing to remain.
- Stop if tests need to touch the real home directory instead of an injected env path.

Human review triggers:
- Ask for review before adding repo-local or project-local personal guidance paths.

## Dependencies

Tracked in frontmatter: F-0066.

## Verification

- bun test packages/cli/test/cli.test.ts packages/cli/test/prompt-guidance.test.ts
- bun run harness:cli

## Notes

Depends on routed guidance removal so personal guidance is the only guidance path left in prompts.

## History

- Created 2026-05-20T15:36:51.078Z.
