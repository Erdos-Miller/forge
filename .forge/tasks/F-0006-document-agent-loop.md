---
id: F-0006
title: Document agent loop
kind: task
status: done
priority: high
parent: F-0000
depends_on:
  - F-0001
claimed_by: ""
scope:
  - AGENTS.md
  - .forge/tasks/**
created_at: 2026-05-14T00:00:00-05:00
updated_at: 2026-05-14T00:00:00-05:00
---

# Document agent loop

## Context

Forge should be usable by agents before the CLI exists. Agents need a simple loop for selecting, claiming, executing, and closing tasks.

## Acceptance Criteria

- Agent loop is documented.
- Claiming behavior is documented.
- Scope expectations are documented.
- Guidance warns against casual schema changes.

## Notes

This bootstrap version lives in `AGENTS.md`.

Completed in the initial documentation bootstrap.
