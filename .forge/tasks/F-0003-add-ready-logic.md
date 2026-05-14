---
id: F-0003
title: Add ready task logic
kind: task
status: open
priority: high
parent: F-0000
depends_on:
  - F-0002
claimed_by: ""
scope:
  - packages/**
  - .forge/tasks/**
created_at: 2026-05-14T00:00:00-05:00
updated_at: 2026-05-14T00:00:00-05:00
---

# Add ready task logic

## Context

Forge needs to compute which tasks are safe to pick next. This should be derived from task files, not stored separately.

## Acceptance Criteria

- Computes `ready` from status, claims, and dependencies.
- Detects missing dependency ids.
- Detects dependency cycles.
- Exposes blockers in a human-readable way.

## Notes

The ready rule is defined in `.forge/README.md`.
