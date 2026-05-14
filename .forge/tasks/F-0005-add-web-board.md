---
id: F-0005
title: Add local web board
kind: task
status: open
priority: medium
parent: F-0000
depends_on:
  - F-0002
  - F-0003
claimed_by: ""
scope:
  - packages/**
  - README.md
created_at: 2026-05-14T00:00:00-05:00
updated_at: 2026-05-14T00:00:00-05:00
---

# Add local web board

## Context

Forge should eventually feel like Storybook for work: a local, browsable interface over the repository's task graph.

## Acceptance Criteria

- Starts with a local dev command.
- Shows task columns by status.
- Shows a task detail view with Markdown body.
- Highlights ready, claimed, and blocked tasks.
- Reads the same task files as the CLI.

## Notes

The web app should not introduce a separate source of truth.
