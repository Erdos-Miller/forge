---
id: F-0007
title: Design two-agent workflow
kind: task
status: done
priority: high
parent: F-0000
depends_on:
  - F-0006
claimed_by: ""
scope:
  - AGENTS.md
  - .forge/specs/**
  - .forge/tasks/**
created_at: 2026-05-14T00:00:00-05:00
updated_at: 2026-05-14T00:00:00-05:00
---

# Design two-agent workflow

## Context

The first real workflow is not many agents working in parallel. It is one planning agent preparing the next tasks while one execution agent works ready tasks and flags review when needed.

## Acceptance Criteria

- Planning responsibilities are documented.
- Execution responsibilities are documented.
- Review flagging is documented.
- The workflow avoids unnecessary shared-file contention.

## Notes

The bootstrap guidance now lives in `AGENTS.md` and `.forge/specs/F-0008-design-rationale.md`.

Completed in the initial rationale documentation pass.
