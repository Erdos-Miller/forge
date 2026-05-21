---
id: F-0112
title: "Add first-class task project field"
kind: task
status: open
priority: urgent
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
# Add first-class task project field

## Why

Project membership should be an explicit task link, not something users or agents have to derive from edit-scope paths.

## What success looks like

Tasks can store `project: <id>` in frontmatter, and all core task surfaces preserve and expose that field.

## Acceptance Criteria

- Add optional `project` frontmatter to the task type.
- Parse, validate, preserve, and write `project` without requiring it on existing tasks.
- Add `project` to task update inputs and structured set behavior.
- Include `project` in robot JSON, queue/show payloads, and web API payloads.
- Render Project in web task detail when present.
- Keep task `scope` as edit-boundary globs only.
- Tests cover parsing, writing, updating, and backward compatibility for tasks without `project`.

## Execution Plan

Summary: Make task Project membership explicit across the data model.

Scope: Core task types/parser/writer, CLI structured output, web payload, task detail, and tests.

Approach:
- Add `project?: string` to the task model.
- Validate project IDs with the same conservative ID shape used by Project config.
- Preserve missing `project` as valid.
- Add set/create plumbing only enough to preserve and expose the field; project-first create DX is F-0114.
- Update focused fixtures and snapshots.

Verification:
- Core parser/write tests.
- CLI robot/show/queue tests where applicable.
- Focused web payload/detail tests.

Stop conditions:
- Stop if adding `project` would require rewriting all existing task files.

Human review triggers:
- Ask for review if multi-project tasks require an array instead of one canonical project.

## Dependencies

Tracked in frontmatter: F-0111.

## Verification

- Run focused task model tests.
- Run `bun run harness:cli` and focused web tests if payloads change.

## Notes

Project ID is the canonical task-to-project link. Project paths are only for inference, defaults, validation, and repair suggestions.

Decision: Forge should link tasks to Projects with explicit task metadata, not by deriving Project membership from edit-scope paths.

## History

- Created 2026-05-21T15:37:53-05:00.
