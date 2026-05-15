---
id: F-0001
title: Define task format
kind: task
status: done
priority: urgent
parent: F-0000
depends_on: []
claimed_by: ""
scope:
  - .forge/README.md
  - .forge/tasks/**
created_at: 2026-05-14T00:00:00-05:00
updated_at: 2026-05-15T05:30:00.000Z
closed_at: 2026-05-14T05:00:00.000Z
close_reason: "Backfilled by F-0045; timestamp is approximate."
---

# Define task format

## Context

Forge needs a task format before it needs code. The format should be readable, branch-friendly, and simple enough for agents to edit safely.

## Acceptance Criteria

- Canonical fields are documented.
- Dependency and tree relationships are documented.
- The ready rule is documented.
- Reverse edges are treated as derived state.

## Notes

This bootstrap version lives in `.forge/README.md`.

Completed in the initial documentation bootstrap.
