---
id: F-0066
title: "Remove routed repo guidance"
kind: task
status: done
priority: high
area: "core"
parent: "F-0000"
depends_on: []
claimed_by: ""
scope:
  - "packages/core/**"
  - "packages/cli/**"
  - ".forge/**"
  - "README.md"
created_at: 2026-05-20T15:36:40.722Z
updated_at: 2026-05-21T15:02:45.089Z
closed_at: 2026-05-21T15:02:45.089Z
close_reason: "Routed repo guidance removed from core, CLI, prompts, doctor, docs, and tests; harness and quality checks passed."
blocked_reason: ""
review_reason: ""
---
# Remove routed repo guidance

## Why

Hidden .forge/guidance.yml and .forge/guidance/* routing add conceptual weight before Forge has proven it needs project guidance routing.

## What success looks like

Forge no longer resolves, injects, documents, or validates routed repo guidance; prompts stay focused on task content, AGENTS.md, command guidance, and optional personal guidance.

## Acceptance Criteria

- Remove routed guidance resolver behavior and exported types that only support .forge/guidance.yml routing.
- Remove or replace the forge guidance command and command metadata so the public CLI no longer advertises routed repo guidance.
- Remove prompt injection from .forge/guidance.yml routes while keeping task prompts usable.
- Remove doctor diagnostics specific to routed guidance configs and includes.
- Update README and .forge docs to stop recommending .forge/guidance.yml or .forge/guidance/* as a workflow.
- Existing queue, prompt, doctor, web, and task graph flows still work.

## Execution Plan

Summary: Remove the hidden routed guidance system from the public Forge workflow.

Scope: Core guidance resolver/types, CLI guidance command/prompt plumbing/doctor checks, docs, and tests that only exist for .forge/guidance.yml routing.

Approach:
- Inventory all imports, command metadata, doctor mappings, prompt formatting, and docs tied to routed guidance.
- Remove the routed guidance command surface and replace prompt dependencies with task content plus command guidance.
- Delete or rewrite routed guidance tests so remaining coverage reflects the simplified model.
- Update docs to explain that Forge uses task files and AGENTS.md, with personal guidance handled separately by F-0067.

Verification:
- bun run harness:cli
- bun run quality:check

Stop conditions:
- Stop if removing routed guidance would break task parsing, queue ranking, or web payload compatibility.
- Stop if a public command has downstream tests that need a compatibility decision.

Human review triggers:
- Ask for review if keeping a deprecated alias seems necessary for existing users.

## Dependencies

None.

## Verification

- bun run harness:cli
- bun run quality:check

## Notes

Planning task created from the guidance simplification plan.

Implemented routed repo guidance removal.

Decisions:
- Removed the core `.forge/guidance.yml` resolver module, routed guidance types, and routed guidance tests.
- Removed the public `forge guidance` command, command metadata, CLI argument parser, robot JSON guidance serialization, and prompt guidance injection.
- Removed doctor diagnostics for `.forge/guidance.yml` and `.forge/guidance/*` includes.
- Removed the committed `.forge/guidance.yml`, `.forge/guidance/forge.md`, and obsolete `.forge/.gitignore` entries for local routed guidance.
- Updated README and `.forge/README.md` to state that committed project guidance is not routed by Forge; durable work context belongs in task Markdown and `AGENTS.md`.
- Kept closeout guidance and command guidance because they are separate CLI/task workflow concepts, not routed repo guidance.

Verification:
- `bun test packages/cli/test/cli.test.ts packages/cli/test/prompt-guidance.test.ts packages/cli/test/robot-contracts.test.ts` passed: 58 tests, 0 failures.
- `bun test packages/core` passed: 63 tests, 0 failures.
- `bun run harness:cli` passed: 7 tests, 0 failures.
- `bun run quality:check` passed: 176 tests, 0 failures, web production build passed.

Closeout review resolution:
- No deprecated `forge guidance` alias was kept because the task acceptance criteria and user decision were to remove routed guidance now.
- Public command compatibility was handled by updating command metadata, generated usage/help, robot contract tests, and CLI tests.
- Task parsing, queue ranking, prompt generation, doctor, and web build all passed through `bun run quality:check` after the removal.

## History

- Created 2026-05-20T15:36:40.722Z.
