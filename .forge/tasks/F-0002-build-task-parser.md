---
id: F-0002
title: Build task parser
kind: task
status: done
priority: high
parent: F-0000
depends_on:
  - F-0001
claimed_by: ""
scope:
  - packages/**
  - .forge/tasks/**
created_at: 2026-05-14T00:00:00-05:00
updated_at: 2026-05-15T05:30:00.000Z
closed_at: 2026-05-14T22:38:59.000Z
close_reason: "Backfilled by F-0045; timestamp is approximate."
---

# Build task parser

## Context

The first code should read `.forge/tasks/*.md`, parse frontmatter, and expose task objects to both the CLI and future web app.

## Acceptance Criteria

- Reads task files from `.forge/tasks`.
- Parses YAML frontmatter and Markdown body.
- Validates required fields.
- Reports useful errors for malformed tasks.
- Has focused tests using the bootstrap tasks as fixtures or examples.

## Notes

No database or cache is needed for this task.

Claimed by codex for the parser implementation pass.

Implemented `@forge/core` with a Bun/TypeScript parser package under `packages/core`.

Verification: `bun test` passed with coverage for bootstrap task loading, frontmatter/body parsing, required field validation, malformed YAML, missing frontmatter, invalid dependency/scope shapes, invalid timestamps, and typed source-path errors.
