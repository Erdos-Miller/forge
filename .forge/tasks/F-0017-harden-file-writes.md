---
id: F-0017
title: Harden task file writes
kind: task
status: open
priority: high
parent: F-0000
depends_on:
  - F-0015
  - F-0016
claimed_by: ""
area: core
scope:
  - packages/core/**
  - packages/cli/**
  - .forge/tasks/**
created_at: 2026-05-15T00:00:00-05:00
updated_at: 2026-05-15T00:00:00-05:00
closed_at: ""
close_reason: ""
---

# Harden task file writes

## Why

Robot commands will write task files frequently. Those writes must preserve human-authored Markdown, avoid invalid YAML, and fail clearly when the task store is unsafe.

## What success looks like

Core write helpers safely update task files without corrupting frontmatter or body content, including glob values such as `**`.

## Acceptance Criteria

- YAML array scalars are quoted safely when generated or updated.
- `forge create` default scope no longer writes invalid YAML for `**`.
- Unknown frontmatter fields and unknown Markdown sections are preserved.
- Writes fail clearly on malformed frontmatter or merge conflict markers.
- Writes use an atomic write strategy appropriate for local files.
- Tests cover glob values, special characters, unknown fields, unknown sections, malformed task files, and stale or unsafe write cases.

## Dependencies

Depends on `F-0015` and `F-0016` because write hardening should cover the full lifecycle command surface and doctor diagnostics.

## Verification

- Run `bun test` in `packages/core` and `packages/cli`.
- Add a regression test that creates a task without `--scope` and reparses it successfully.

## Notes

This task should not add new product commands. It makes existing and planned writes safe enough for dogfooding.

## History

- Created 2026-05-15T00:00:00-05:00.
