---
id: F-0098
title: "Expand workspace discovery ignore rules"
kind: task
status: done
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
updated_at: 2026-05-21T18:21:44.289Z
closed_at: 2026-05-21T18:21:44.289Z
close_reason: "Expanded workspace discovery pruning and documented hidden-directory policy with focused, harness, and quality checks passing."
blocked_reason: ""
review_reason: ""
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

## Execution Plan

Summary: Expand downward workspace discovery pruning without changing root semantics.

Scope: Core discovery ignore policy, workspace discovery tests, and task notes.

Approach:
- Add common local/cache/generated directory names to the existing ignore set.
- Skip hidden directories by default during downward traversal, while still detecting `.forge` in the current directory before child pruning.
- Keep ordinary project directories traversable so intentional roots remain discoverable.
- Extend workspace fixture tests to prove ignored nested roots are pruned and existing ignores remain covered.

Verification:
- `bun test packages/core/test/workspace.test.ts`
- `bun run harness:check`

Stop conditions:
- Stop if hidden-directory pruning would hide a documented supported workspace layout.

Human review triggers:
- Ask for review if hidden project directories should remain discoverable by default.

## Dependencies

Tracked in frontmatter: F-0097.

## Verification

- Run focused core workspace discovery tests.
- Run bun run harness:check.

## Notes

Follow-up from F-0082. Keep this separate from the session cache so pruning policy can be reviewed independently.

Expanded downward workspace discovery pruning for common local, cache, and generated directories. Hidden child directories are skipped by default; a directory is still recognized as a Forge root when `.forge` is directly inside that directory, but discovery will not descend through hidden project/cache directories to find nested roots.

Review trigger resolved: this policy intentionally favors fast normal workspace discovery. Hidden project directories can be reconsidered later if we document a supported hidden-workspace layout.

Verification:
- `bun test packages/core/test/workspace.test.ts` passed: 6 tests, 8 expects.
- `bun run harness:check` passed: 234 tests, 1140 expects.
- `bun run quality:check` passed: 234 tests, 1140 expects, and `packages/web` production build completed.

## History

- Created 2026-05-21T17:46:17.078Z.
