---
id: F-0074
title: "Discover Forge roots downward for web"
kind: task
status: done
priority: high
area: "core"
parent: "F-0000"
depends_on:
  - "F-0073"
claimed_by: ""
scope:
  - "packages/core/**"
  - "packages/cli/**"
  - "packages/web/**"
  - ".forge/**"
created_at: 2026-05-21T09:50:50-05:00
updated_at: 2026-05-21T15:13:35.252Z
closed_at: 2026-05-21T15:13:35.252Z
close_reason: "Web startup downward Forge-root discovery added and verified with focused tests plus harness:cli."
blocked_reason: ""
review_reason: ""
---
# Discover Forge roots downward for web

## Why

Running `forge web` from a parent directory should find Forge roots below the current directory without requiring one server per worktree.

## What success looks like

The web startup path discovers Forge roots by searching downward from cwd, while normal task CLI commands keep their existing worktree-local behavior.

## Acceptance Criteria

- Add downward `.forge` root discovery for the `forge web` startup path.
- Do not climb upward for web startup discovery.
- Ignore `.git`, `node_modules`, build outputs, and `.forge/local`.
- Return stable root identity, display name, path, and task count.
- Preserve existing upward root discovery for worktree-local commands like `next`, `show`, and `done`.
- Tests use workspace fixtures, not the real filesystem outside temp directories.

## Execution Plan

Summary: Introduce downward Forge-root discovery as a web-specific capability.

Scope: Core discovery helper, CLI web startup plumbing, and tests.

Approach:
- Add a discovery helper that walks downward from a start directory and detects child `.forge` roots.
- Apply ignore rules early to avoid expensive or irrelevant directories.
- Return metadata needed by the web API and UI without loading full task bodies unless necessary.
- Wire only `forge web` to the new discovery path.
- Cover zero, one, many, ignored-dir, and nested-root fixture cases.

Verification:
- `bun run harness:cli`
- Focused discovery tests

Stop conditions:
- Stop if discovery becomes slow on large fixture trees; add bounds or pruning before expanding scope.

Human review triggers:
- Ask for review before adding persistent workspace config or include/exclude settings.

## Dependencies

Tracked in frontmatter: F-0073.

## Verification

- Run focused discovery tests.
- Run `bun run harness:cli`.

## Notes

This task should not introduce a product mode flag. The same `forge web` command should adapt to discovered roots.

Implemented downward Forge-root discovery for web startup.

Decisions:
- Added `discoverForgeRootsDownward` as a core helper using the existing `@forge/core` task-files export path so CLI workspace resolution sees it without a package-cache refresh.
- Discovery starts at the requested directory and only walks downward; it never climbs to a parent `.forge` directory.
- Discovery prunes `.git`, `.next`, `build`, `coverage`, `dist`, `node_modules`, `out`, and `target` directories.
- Each discovered root returns stable relative id, display name, real path, and Markdown task-file count.
- Added `resolveWebStartRepoRoot` and wired only `forge web` startup to the downward discovery path. Existing task commands still use upward root discovery.
- For this task, `forge web` serves the first stable discovered root; later workspace API/UI tasks can use the full discovered root list.

Verification:
- `bun test packages/core/test/workspace.test.ts packages/cli/test/web-workspace.test.ts` passed: 6 tests, 0 failures.
- `bun run harness:cli` passed: 7 tests, 0 failures.

Closeout review resolution:
- No persistent workspace config or include/exclude settings were added.
- Discovery uses fixed pruning rules and focused fixture coverage for zero, one, many, ignored-directory, and no-upward-climb cases.
- The large task-set fixture remains available for later workspace API/UI tasks; this discovery task only counts task files for discovered roots.

## History

- Created 2026-05-21T09:50:50-05:00.
