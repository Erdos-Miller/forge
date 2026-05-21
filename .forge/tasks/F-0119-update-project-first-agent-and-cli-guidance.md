---
id: F-0119
title: "Update project-first agent and CLI guidance"
kind: task
status: done
priority: high
area: "cli"
parent: "F-0000"
depends_on:
  - "F-0114"
  - "F-0115"
claimed_by: ""
scope:
  - "packages/cli/**"
  - ".forge/**"
  - "README.md"
  - "AGENTS.md"
created_at: 2026-05-21T15:37:53-05:00
updated_at: 2026-05-21T21:43:09.604Z
closed_at: 2026-05-21T21:43:09.604Z
close_reason: "Updated Project-first guidance and verified CLI harness."
blocked_reason: ""
review_reason: ""
---
# Update project-first agent and CLI guidance

## Why

Agents and users should learn the simple model: create tasks by Project name or cwd context, and use scope only for edit boundaries.

## What success looks like

Command help, agent prompts, and docs describe Project-first task creation and stop teaching path globs as the organization mechanism.

## Acceptance Criteria

- Update `help --agent` to recommend `forge create "Title" --project <id> --area <area>`.
- Update `prompt` and `loop-prompt` guidance to treat Project as task organization.
- Explain that cwd can infer Project when inside one configured Project path.
- Explain that task `scope` is an edit-boundary refinement.
- Remove examples that require long path globs for ordinary task organization.
- Tests cover command metadata, prompt guidance, and docs examples where applicable.

## Execution Plan

Summary: Make the documented workflow match the Project-first product model.

Scope: CLI command metadata, prompt formatting, docs examples, and tests.

Approach:
- Update examples to show project-first create.
- Keep advanced scope examples only where they are explicitly edit-boundary examples.
- Reference Project config commands for setup.
- Avoid reintroducing `.forge/decisions` or harness docs as user-store requirements.

Verification:
- Focused command metadata and prompt tests.
- `bun run harness:cli`.

Stop conditions:
- Stop if create command support from F-0114 is incomplete.

Human review triggers:
- Ask for review if examples should require project for every task in configured repos.

## Dependencies

Tracked in frontmatter: F-0114, F-0115.

## Verification

- Run focused guidance tests.
- Run `bun run harness:cli`.

## Notes

The guidance should optimize for daily use, not configuration internals.

Updated Project-first guidance:

- `help --agent` and command metadata now describe create as Project/cwd-first and scope as edit-boundary narrowing.
- `prompt` and `loop-prompt` command guidance explain explicit `--project`, cwd Project inference, and scope as an edit-boundary refinement.
- README and `.forge/README.md` use title-first `forge create "Title" --project <id> --area <area>` examples.
- AGENTS.md now describes planning and execution as workflow modes that one builder or multiple agents can perform, not required separate agents.

Verification:

- `bun test packages/cli/test/cli.test.ts packages/cli/test/prompt-guidance.test.ts`
- `bun test packages/core/test/readability-ratchet.test.ts`
- `bun run harness:cli`
- `forge doctor --json` reports only expected dirty-worktree warnings for F-0119 before commit.

## History

- Created 2026-05-21T15:37:53-05:00.
