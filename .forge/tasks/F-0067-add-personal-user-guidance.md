---
id: F-0067
title: "Add personal user guidance"
kind: task
status: done
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
updated_at: 2026-05-21T15:39:45.410Z
closed_at: 2026-05-21T15:39:45.410Z
close_reason: ""
blocked_reason: ""
review_reason: ""
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

Implemented personal user guidance outside repo task state. Forge now reads `~/.config/forge/guidance.md` via the user's home directory, exposes it through `forge user-guidance`, and includes it in `forge prompt` and `forge loop-prompt` under a `Personal user guidance:` heading only when the file exists and has content.

Decisions:
- Missing personal guidance is not an error; `forge user-guidance` prints a concise missing message, while generated prompts omit the section entirely.
- Tests inject a temp `HOME` and do not touch the real home directory.
- No repo-local or project-local guidance routing was added.

Verification:
- `bun test packages/cli/test/cli.test.ts packages/cli/test/prompt-guidance.test.ts`: 60 pass, 442 expect() calls.
- `bun run harness:cli`: 7 pass, 89 expect() calls.
- `bun run quality:check`: 199 pass, 981 expect() calls, web production build passed.

## History

- Created 2026-05-20T15:36:51.078Z.
