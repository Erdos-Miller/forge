---
id: F-0085
title: "Design explicit Forge scope config"
kind: task
status: open
priority: high
area: "docs"
parent: "F-0000"
depends_on:
  - "F-0080"
  - "F-0084"
claimed_by: ""
scope:
  - ".forge/**"
  - "README.md"
  - "packages/core/**"
  - "packages/cli/**"
  - "packages/web/**"
created_at: 2026-05-21T11:54:53-05:00
updated_at: 2026-05-21T11:54:53-05:00
---
# Design explicit Forge scope config

## Why

Inference can clean up obvious noise, but monorepo work slices need an explicit repo-local source of truth.

## What success looks like

Forge documents an optional `.forge/scopes.yml` format that maps user-facing scope labels to path globs without changing task edit-boundary frontmatter.

## Acceptance Criteria

- Specify `.forge/scopes.yml` as optional repo-local configuration.
- Define scope fields such as `id`, `label`, and path globs.
- Define that configured scopes take precedence over inferred fallback scopes.
- Clarify that task frontmatter `scope` remains edit-boundary data.
- Document how agents should maintain scope config through structured tools rather than hand edits.
- Include examples for Forge itself and a monorepo-style project layout.

## Execution Plan

Summary: Design the explicit scope configuration before implementing CLI tools or web consumption.

Scope: Docs, examples, and any design notes needed for later implementation tasks.

Approach:
- Draft the `.forge/scopes.yml` shape.
- Define matching behavior at the conceptual level without over-specifying implementation details.
- Document precedence between configured scopes and cleaned inference.
- Record examples that distinguish Worktree, UI Scope, Area, and task edit scope.
- Name the future structured commands that will maintain the file.

Verification:
- Docs review.
- `bun run quality:check` if tested docs or prompt text changes.

Stop conditions:
- Stop if the design implies a required config file for all repos.

Human review triggers:
- Ask for review if the file name, field names, or matching semantics need product input.

## Dependencies

Tracked in frontmatter: F-0080, F-0084.

## Verification

- Review docs and examples.
- Run `bun run quality:check` if applicable.

## Notes

This task is design-only. It should not make the web UI depend on `.forge/scopes.yml`.

## History

- Created 2026-05-21T11:54:53-05:00.
