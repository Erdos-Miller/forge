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
travel with the code they describe. Use Projects for human navigation inside a
worktree, task `scope` globs for edit boundaries, and optional `area` labels for
task categories such as `web`, `cli`, `core`, `docs`, `test`, or `harness`
without creating nested task stores.

Do not create nested `.forge/` stores inside packages, apps, or modules in v0.
One canonical task graph per repo or worktree keeps dependencies, ranking, and
agent ownership understandable.

Generated indexes, caches, or local UI state should stay ignored by git. The
Markdown files remain the source of truth.

Forge does not currently route committed project guidance. Keep durable work
context in task Markdown and repository agent instructions such as `AGENTS.md`.
Personal guidance is intentionally separate from repo task state.

Durable product and architecture choices live in `.forge/decisions/`. Task
`Notes` are for implementation evidence, verification, blockers, and local task
decisions; promote cross-cutting rules into a decision record.

Workspace discovery can be tuned with an optional `forge.workspace.yml` file at
the directory passed to `forge web --dir`. Ignore paths are relative to that
directory and prune downward discovery only:

```yaml
version: 1
discovery:
  ignore:
    - "sandbox-output"
    - "fixtures/generated/**"
```

## First Loop

1. Pick a ready task from `.forge/tasks`.
2. Claim it in the task frontmatter.
3. Do the work in a branch or worktree.
4. Update the task notes with what changed.
5. Mark it done when the acceptance criteria are met.
6. Commit the code and task update together.

If a task changes conventions, architecture, or public semantics, record the
decision in task `Notes` or promote it to `.forge/decisions/` before closeout.

Forge should build itself by following this loop from the beginning.

## CLI

The current CLI lives in `packages/cli` and reads the repo-local `.forge/tasks`
directory from the current working directory.

```sh
bun packages/cli/src/index.ts list
bun packages/cli/src/index.ts ready
bun packages/cli/src/index.ts create F-0006 --title "Add task creation" --why "New tasks should start with enough context." --success "The task is ready to pick up." --acceptance "The task has observable acceptance criteria." --verification "bun run harness:cli" --notes "Keep rich task context in Markdown." --area cli --scope "packages/cli/**"
bun packages/cli/src/index.ts loop-prompt
bun packages/cli/src/index.ts prompt next
bun packages/cli/src/index.ts user-guidance
bun packages/cli/src/index.ts claim F-0005 --by codex
bun packages/cli/src/index.ts done F-0005
bun packages/cli/src/index.ts web
```

Use `forge loop-prompt` when starting a Codex Goal that should keep taking the
next ready task until it hits a real stop condition. Each iteration still handles
one coherent task at a time. Use `forge prompt next` when you want the concrete
prompt for the currently highest-ranked ready task.

Personal guidance lives outside the repo at `~/.config/forge/guidance.md`. When
that file exists, Forge includes it in `forge prompt` and `forge loop-prompt`
under a clearly labeled personal user guidance heading. Inspect it with
`forge user-guidance`.

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

When Forge serves multiple `.forge` roots from one parent directory, the web UI
calls each selectable root a Worktree. A Worktree may be a git repository, a git
worktree, or any directory that owns a `.forge` store. The parent view is a
Workspace.

Inside a Worktree, a Project is an explicit user-facing slice of work. It is
separate from Area, which is a task category such as `web` or `docs`, and from
the task frontmatter `scope` globs that agents use as edit boundaries.

Repos can optionally define explicit Projects in `.forge/scopes.yml`. The file
and current CLI commands still use `scope` naming for compatibility:

```yaml
version: 1
scopes:
  - id: web
    label: Web
    paths:
      - packages/web/**
  - id: planning
    label: Planning
    paths:
      - .forge/**
      - README.md
```

Configured Projects take precedence over inferred fallback navigation. The task
frontmatter `scope` field remains the edit-boundary data for agents.

Maintain the compatibility config with structured commands:

```sh
forge scopes --json
forge scopes infer --json
forge scopes add web --label "Web" --path "packages/web/**" --json
forge scopes update web --path "packages/web/test/**" --json
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
