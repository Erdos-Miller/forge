# Forge

Forge is a repo-local task system for humans and coding agents.

The core idea is simple: work is stored as plain Markdown files in git. The CLI and web app are views over those files, not the source of truth.

## Goals

- Keep work items readable in any editor.
- Make branching and worktrees feel natural.
- Let agents claim, execute, and close tasks without a server.
- Prefer boring formats over proprietary state.
- Support a Storybook-like local web app for browsing tasks, specs, branches, and dependency state.
- Support a two-agent loop: one agent plans ahead, another executes ready tasks.

## Non-Goals

- No hosted issue tracker in the first version.
- No tracked SQLite database.
- No JSONL as the canonical format.
- No complex workflow engine before the file format proves itself.

## Shape

```text
.forge/
  README.md
  specs/
    F-0000-forge-v0.md
  tasks/
    F-0001-define-task-format.md
    F-0002-build-task-parser.md
```

Each task is a Markdown document with YAML frontmatter. The Markdown body should remain useful even if Forge tooling does not exist.

## First Loop

1. Pick a ready task from `.forge/tasks`.
2. Claim it in the task frontmatter.
3. Do the work in a branch or worktree.
4. Update the task notes with what changed.
5. Mark it done when the acceptance criteria are met.
6. Commit the code and task update together.

Forge should build itself by following this loop from the beginning.

## CLI

The current CLI lives in `packages/cli` and reads the repo-local `.forge/tasks`
directory from the current working directory.

```sh
bun packages/cli/src/index.ts list
bun packages/cli/src/index.ts ready
bun packages/cli/src/index.ts claim F-0005 --by codex
bun packages/cli/src/index.ts done F-0005
```

## Current Target

Forge is currently designed to view and maintain the plan more than to replace a full issue tracker.

The first useful product is a local web app that shows the work graph, task details, dependencies, claims, and review state. A TUI may come later, but the web app is the first interactive surface.
