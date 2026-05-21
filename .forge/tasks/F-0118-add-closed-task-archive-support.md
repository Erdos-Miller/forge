---
id: F-0118
title: "Add closed-task archive support"
kind: task
status: open
priority: medium
area: "core"
parent: "F-0000"
depends_on:
  - "F-0111"
claimed_by: ""
scope:
  - "packages/core/**"
  - "packages/cli/**"
  - "packages/web/**"
  - ".forge/**"
created_at: 2026-05-21T15:37:53-05:00
updated_at: 2026-05-21T15:37:53-05:00
---
# Add closed-task archive support

## Why

Keeping every done task in `.forge/tasks/` makes the active work surface noisy. Closed work should be loadable history without cluttering the active task directory.

## What success looks like

Forge supports `.forge/archive/` for done and canceled tasks while default task workflows stay active-first.

## Acceptance Criteria

- Define `.forge/archive/` as the location for closed tasks.
- Load active tasks from `.forge/tasks/` and archived tasks where history or analytics require them.
- Default queue/list behavior stays focused on unfinished work.
- Add a non-mutating command or dry-run plan for which closed tasks would move.
- Preserve task IDs and dependency graph behavior when archived tasks are referenced.
- Tests cover loading active-only, active-plus-archive, dependencies on archived closed tasks, and analytics history.

## Execution Plan

Summary: Add archive-aware loading before adding any task-moving command.

Scope: Core task loading, CLI list/history behavior as needed, web analytics payload, docs, and tests.

Approach:
- Add archive path discovery under the same `.forge` root.
- Keep default active task loading compatible where callers expect `.forge/tasks`.
- Introduce explicit active-plus-archive loading for graph/history surfaces.
- Avoid moving files in this task unless a later task adds archive mutation.

Verification:
- Core task loading tests.
- CLI list/queue tests.
- Focused web analytics tests if payloads include archive.

Stop conditions:
- Stop if archive loading changes ready-task ranking for active tasks.

Human review triggers:
- Ask for review if archived closed tasks should appear in default web analytics immediately.

## Dependencies

Tracked in frontmatter: F-0111.

## Verification

- Run focused archive loading tests.
- Run `bun run harness:check`.

## Notes

This task should make archive readable first. Moving existing closed tasks can come later.

Decision: Closed-task archiving should be readable and non-disruptive before Forge adds any command that moves task files.

## History

- Created 2026-05-21T15:37:53-05:00.
