---
id: F-0104
title: "Add project config CLI tools"
kind: task
status: done
priority: high
area: "cli"
parent: "F-0000"
depends_on:
  - "F-0103"
claimed_by: ""
scope:
  - "packages/cli/**"
  - "packages/core/**"
  - ".forge/**"
created_at: 2026-05-21T14:50:37-05:00
updated_at: 2026-05-21T20:32:56.232Z
closed_at: 2026-05-21T20:32:56.232Z
close_reason: "Added preferred project config CLI commands with legacy scope compatibility."
blocked_reason: ""
review_reason: ""
---
# Add project config CLI tools

## Why

Agents should maintain Project config through structured commands instead of hand-editing YAML.

## What success looks like

Forge exposes project config commands that list, suggest, add, update, and remove Projects.

## Acceptance Criteria

- Add `forge projects --json`.
- Add `forge projects infer --json` as suggestions only.
- Add `forge projects add <id> --label <label> --path <glob> --json`.
- Add `forge projects update <id> --path <glob> --json`.
- Add `forge projects remove <id> --json`.
- Mark old scope commands as compatible or legacy in command help.
- Tests cover successful mutations and invalid input.

## Execution Plan

Summary: Provide the structured command surface for Project config maintenance.

Scope: CLI command parsing, command metadata, core config calls, and CLI tests.

Approach:
- Reuse the existing scope command behavior where possible.
- Make project commands the preferred documented surface.
- Keep inference read-only and clearly labeled as suggestions.
- Preserve JSON-first output for agents.
- Add command metadata so `help --agent` discovers the tools.

Verification:
- Focused project CLI tests.
- `bun run harness:cli`.

Stop conditions:
- Stop if remove/update semantics would make existing scope config ambiguous.

Human review triggers:
- Ask for review if legacy `forge scopes` commands should be hidden instead of documented as compatible.

## Dependencies

Tracked in frontmatter: F-0103.

## Verification

- Run focused CLI project command tests.
- Run `bun run harness:cli`.

## Notes

Do not make inferred suggestions automatically become Projects.

Implemented preferred Project config CLI commands.

Changes:
- Added `forge projects --json`, `forge projects infer --json`, `forge projects add`, `forge projects update`, and `forge projects remove`.
- Reused the existing `.forge/scopes.yml` compatibility file and project config normalization from F-0103.
- `projects` payloads expose `projects` as the preferred field and keep `scopes` as a compatibility alias.
- `projects infer` is read-only and does not write `.forge/scopes.yml`.
- Existing `forge scopes ...` commands remain available and are documented as legacy-compatible.
- Added core removal support for deleting a configured Project by id.

Decisions:
- `remove` deletes exactly one configured Project id and writes the remaining config using the preferred `projects:` key.
- Update semantics remain append-only for paths, matching the existing scope command behavior.
- Human review trigger did not fire: legacy `forge scopes ...` commands are documented as compatible rather than hidden.
- Stop condition did not fire: remove/update semantics are id-based and not ambiguous.

Verification:
- `bun test packages/cli/test/projects.test.ts packages/cli/test/scopes.test.ts packages/cli/test/cli.test.ts packages/cli/test/prompt-guidance.test.ts` passed: 71 tests.
- `bun test packages/core/test/scope-config.test.ts` passed: 2 tests.
- `bun run harness:cli` passed: 8 tests.

## History

- Created 2026-05-21T14:50:37-05:00.
