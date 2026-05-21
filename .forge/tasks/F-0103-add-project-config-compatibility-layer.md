---
id: F-0103
title: "Add project config compatibility layer"
kind: task
status: open
priority: high
area: "core"
parent: "F-0000"
depends_on:
  - "F-0101"
claimed_by: ""
scope:
  - "packages/core/**"
  - "packages/cli/**"
  - "packages/web/**"
  - ".forge/**"
created_at: 2026-05-21T14:50:37-05:00
updated_at: 2026-05-21T14:50:37-05:00
---
# Add project config compatibility layer

## Why

Forge already has `.forge/scopes.yml`, but the preferred concept is Project. Existing config should keep working while new docs and tools move to project language.

## What success looks like

Core config loading supports Project semantics and remains backward-compatible with existing scope config.

## Acceptance Criteria

- Define the preferred project config shape using `projects`.
- Continue reading existing `.forge/scopes.yml` or `scopes` entries for compatibility.
- Expose resolved config as Projects to callers.
- Preserve IDs, labels, descriptions, and paths.
- Keep task frontmatter `scope` matching behavior unchanged.
- Tests cover new project config and legacy scope config.

## Execution Plan

Summary: Add a compatibility layer so Project language can replace Scope language without breaking existing config.

Scope: Core config parsing, exported types, API payload plumbing as needed, and tests.

Approach:
- Add project-facing types while preserving legacy scope parsing.
- Normalize legacy scopes into resolved project entries.
- Keep path-overlap semantics the same.
- Do not require repositories to migrate immediately.
- Update fixtures to include both new and legacy formats.

Verification:
- Focused core config tests.
- Focused web/API payload tests if payload fields change.
- `bun run harness:check` if shared types move.

Stop conditions:
- Stop if compatibility would require changing task frontmatter or existing task files.

Human review triggers:
- Ask for review if both `.forge/projects.yml` and `.forge/scopes.yml` need to coexist as files.

## Dependencies

Tracked in frontmatter: F-0101.

## Verification

- Run focused project config parser tests.
- Run affected CLI/web tests.

## Notes

Prefer the smallest compatibility surface that lets follow-up tasks use Project language safely.

Decision capture required: this task changes the public config concept from UI Scope to Project. Record the compatibility decision in task Notes or a durable `.forge/decisions/` record before closeout.

## History

- Created 2026-05-21T14:50:37-05:00.
