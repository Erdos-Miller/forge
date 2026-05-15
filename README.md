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

## Repo Hygiene

Forge uses one tracked `.forge/` directory at the repository root, similar to how
repos keep automation and collaboration metadata in directories such as
`.github/` or `.vscode/`.

Keep canonical tasks and specs in `.forge/` so they branch, diff, merge, and
travel with the code they describe. Use task `scope` globs and optional `area`
labels to relate work to packages, apps, modules, or docs without creating
nested task stores.

Generated indexes, caches, or local UI state should stay ignored by git. The
Markdown files remain the source of truth.

Repo and project guidance can also live under `.forge/`. The committed
`.forge/guidance.yml` file routes shared `.forge/guidance/*.md` files by task
area, task scope, explicit paths, and current working directory. Personal
machine-local guidance belongs in ignored `.forge/local/user.md` and is included
last by tools that support guidance routing.

Local guidance can override or supplement personal preferences, but it should
not change task acceptance criteria. The repo must work when `.forge/local/`
does not exist.

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
bun packages/cli/src/index.ts create F-0006 --title "Add task creation" --why "New tasks should start with enough context." --success "The task is ready to pick up." --area cli --scope "packages/cli/**"
bun packages/cli/src/index.ts loop-prompt
bun packages/cli/src/index.ts prompt next
bun packages/cli/src/index.ts claim F-0005 --by codex
bun packages/cli/src/index.ts done F-0005
bun packages/cli/src/index.ts web
```

Use `forge loop-prompt` when starting a Codex Goal that should keep taking the
next ready task until it hits a real stop condition. Each iteration still handles
one coherent task at a time. Use `forge prompt next` when you want the concrete
prompt for the currently highest-ranked ready task.

For a local `forge` command, link the CLI once:

```sh
cd packages/cli
bun link
```

Then run `forge list`, `forge ready`, or `forge web` from any directory inside a repo that has a `.forge` directory.

## Web Board

The local web board lives in `packages/web`. It is a read-only view over the
same `.forge/tasks` files used by the CLI. The first screen is a recommended
queue from Forge's ranking engine with a task detail pane beside it.

```sh
bun run web
```

Open the printed local URL, usually `http://127.0.0.1:5174/`.

To serve another repo or worktree:

```sh
forge web --dir /path/to/repo --port 5175
```

To keep a local install up to date, pull the Forge repo and relink if the CLI package path changes:

```sh
git pull
bun install
cd packages/cli
bun link
```

## Current Target

Forge is currently designed to view and maintain the plan more than to replace a full issue tracker.

The first useful product is a local web app that shows the work graph, task details, dependencies, claims, and review state. A TUI may come later, but the web app is the first interactive surface.
