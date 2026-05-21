---
id: F-0104
title: "Add project config CLI tools"
kind: task
status: open
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
updated_at: 2026-05-21T14:50:37-05:00
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

## History

- Created 2026-05-21T14:50:37-05:00.
