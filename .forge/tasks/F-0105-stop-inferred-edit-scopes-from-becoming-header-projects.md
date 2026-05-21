---
id: F-0105
title: "Stop inferred edit scopes from becoming header Projects"
kind: task
status: open
priority: urgent
area: "web"
parent: "F-0000"
depends_on:
  - "F-0102"
claimed_by: ""
scope:
  - "packages/web/**"
  - ".forge/**"
created_at: 2026-05-21T14:50:37-05:00
updated_at: 2026-05-21T14:50:37-05:00
---
# Stop inferred edit scopes from becoming header Projects

## Why

Folders such as `packages/web`, `.forge`, and `lib/typescript/...` are edit boundaries or areas, not Projects. Showing them in the header is confusing.

## What success looks like

The Project selector never presents inferred task edit-scope folders as user-facing Projects.

## Acceptance Criteria

- If no explicit project config exists, hide the Project selector or show only `All projects`.
- Do not display inferred folders as Project options.
- Preserve Area and Priority grouping controls for task presentation.
- Preserve task detail display of raw task `scope` as edit-boundary data.
- Tests cover a no-config repo with task edit scopes.
- Tests cover a configured repo where explicit Projects still appear.

## Execution Plan

Summary: Remove the misleading inferred Project fallback from the header.

Scope: Web selector option construction, filter matching behavior, empty states, and tests.

Approach:
- Treat configured Projects as the only source of header Project options.
- Make `All projects` the default when no config exists.
- Keep queue filtering unfiltered by Project in the no-config case.
- Update tests that currently expect inferred scope options.
- Keep raw edit scope visible only in task detail.

Verification:
- Focused web scope/project tests.
- `bun run harness:web`.

Stop conditions:
- Stop if the UI cannot represent no-config repos without changing the API payload first.

Human review triggers:
- Ask for review if the no-config control should be hidden versus disabled with only `All projects`.

## Dependencies

Tracked in frontmatter: F-0102.

## Verification

- Run focused web Project selector tests.
- Run `bun run harness:web`.

## Notes

This is the core UX fix for the current confusing dropdown.

## History

- Created 2026-05-21T14:50:37-05:00.
