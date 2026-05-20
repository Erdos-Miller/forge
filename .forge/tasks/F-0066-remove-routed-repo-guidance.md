---
id: F-0066
title: "Remove routed repo guidance"
kind: task
status: open
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
updated_at: 2026-05-20T15:38:09.543Z
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

## History

- Created 2026-05-20T15:36:40.722Z.
