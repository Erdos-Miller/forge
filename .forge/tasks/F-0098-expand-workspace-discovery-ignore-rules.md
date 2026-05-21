---
id: F-0098
title: "Expand workspace discovery ignore rules"
kind: task
status: open
priority: high
area: "core"
parent: "F-0000"
depends_on:
  - "F-0097"
claimed_by: ""
scope:
  - "packages/core/**"
  - ".forge/**"
created_at: 2026-05-21T17:46:17.078Z
updated_at: 2026-05-21T17:46:17.078Z
---
# Expand workspace discovery ignore rules

## Why

The current downward discovery scan enters many local, generated, or cache directories that cannot contain useful Forge task roots for normal workspace use.

## What success looks like

Discovery prunes common heavy directories early, reducing traversal size without hiding intentional Forge roots in ordinary project directories.

## Acceptance Criteria

- Skip common heavy/local directories such as .venv, .cache, .turbo, .parcel-cache, .pytest_cache, .mypy_cache, .ruff_cache, vendor, and generated artifact directories.
- Decide and document whether hidden directories are skipped by default except .forge.
- Cover ignored nested roots with fixture tests.
- Preserve existing explicit ignore behavior for node_modules, dist, build, coverage, target, and related directories.

## Dependencies

Tracked in frontmatter: F-0097.

## Verification

- Run focused core workspace discovery tests.
- Run bun run harness:check.

## Notes

Follow-up from F-0082. Keep this separate from the session cache so pruning policy can be reviewed independently.

## History

- Created 2026-05-21T17:46:17.078Z.
