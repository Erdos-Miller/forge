---
id: F-0002
title: Build task parser
kind: task
status: open
priority: high
parent: F-0000
depends_on:
  - F-0001
claimed_by: ""
scope:
  - packages/**
  - .forge/tasks/**
created_at: 2026-05-14T00:00:00-05:00
updated_at: 2026-05-14T00:00:00-05:00
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
