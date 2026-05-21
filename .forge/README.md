# Forge Files

`.forge` contains the repo-local source of truth for Forge work.

## User Store Contract

User repositories should only need this minimal tracked Forge store:

- `.forge/tasks/` for canonical Markdown task files.
- `.forge/projects.yml` for optional explicit Project navigation.
- `.forge/archive/` for optional completed or retired task files.
- `.forge/local/` for ignored machine-local runtime state.

`.forge/README.md`, `.forge/harness-engineering.md`, and `.forge/decisions/`
are Forge repo development docs and historical records, not files Forge should
require in arbitrary user repos.

## Task Format

Tasks live in `.forge/tasks/*.md`.

Use plain YAML frontmatter followed by a normal Markdown body:

```markdown
---
id: F-0001
title: Define task format
kind: task
status: open
priority: high
parent: F-0000
depends_on: []
claimed_by: ""
area: core
scope:
  - .forge/**
created_at: 2026-05-14T00:00:00-05:00
updated_at: 2026-05-14T00:00:00-05:00
closed_at:
close_reason:
---

# Define task format

## Why

...

## What success looks like

...

## Acceptance Criteria

- ...

## Execution Plan

Summary: ...

Scope: ...

Approach:
- ...

Verification:
- ...

Stop conditions:
- ...

Human review triggers:
- ...

## Dependencies

None.

## Verification

- ...

## Notes

...

## History

- Created 2026-05-14T00:00:00-05:00.
```

## Canonical Fields

- `id`: stable task id, unique inside the repo.
- `title`: short human label.
- `kind`: `task` or `spec`.
- `status`: `open`, `doing`, `blocked`, `done`, or `canceled`.
- `priority`: `urgent`, `high`, `medium`, or `low`.
- `parent`: optional parent spec/task id.
- `depends_on`: task ids that must finish first.
- `claimed_by`: optional human or agent identifier.
- `area`: optional task category or work type, such as `web`, `cli`, `core`,
  `docs`, `test`, or `harness`.
- `scope`: optional file globs the task expects to touch. This is the task edit
  boundary, not the web Project filter.
- `created_at`: ISO timestamp.
- `updated_at`: ISO timestamp.
- `closed_at`: optional ISO timestamp for completed or canceled work.
- `close_reason`: optional human-readable completion or cancellation reason.
- `blocked_reason`: optional human-readable reason the task is blocked.
- `review_reason`: optional human-readable reason the task needs review.

## Terminology

Forge uses these terms in docs, tasks, and UI planning:

- `Workspace`: the multi-root web view launched from a parent directory, such as
  `forge web --dir ~/Work`.
- `Worktree`: one discovered Forge root inside a Workspace. It may be a git
  repository, a git worktree, a checkout, or another directory that owns one
  canonical `.forge` store.
- `Project`: an explicit work slice inside a Worktree. Projects are for human
  navigation and planning, such as `Web`, `CLI`, `Shared UI`, or a product
  module.
- `Area`: a task category or work type such as `web`, `core`, `docs`, `test`, or
  `harness`.
- `Task`: one Markdown work item in `.forge/tasks`.
- `task scope`: the task frontmatter `scope` field. It contains edit-boundary
  globs for agents and tools. It does not define a Project.

The hierarchy is: Workspace > Worktree > Project > Area > Task. Task `scope`
cuts across that hierarchy as edit-boundary metadata.

## Project Configuration

Forge's preferred term is Project. The user store contract names
`.forge/projects.yml`. Forge still reads legacy `.forge/scopes.yml` when the
preferred file is absent, and `forge scopes ...` remains a compatibility
command surface.

`.forge/projects.yml` is the optional repo-local configuration file for explicit
web Projects. Projects are user-facing slices of work inside a Worktree. They
are separate from task frontmatter `scope`, which remains edit-boundary data for
agents.

When `.forge/projects.yml` or the legacy `.forge/scopes.yml` exists, configured
Projects take precedence over the web UI's inferred fallback navigation. Repos
without either file continue to use fallback inference until explicit Project
config is added.

Use this preferred shape:

```yaml
version: 1
projects:
  - id: web
    label: Web
    description: Web app and browser-facing task surfaces.
    paths:
      - packages/web/**
  - id: cli
    label: CLI
    paths:
      - packages/cli/**
```

Legacy files that use `.forge/scopes.yml` or a `scopes:` root key are still
supported and are normalized to Projects by Forge. New writes use
`.forge/projects.yml`, and user-facing docs should describe that file as the
contract.

Fields:

- `id`: stable machine id for URLs, CLI output, and future structured tools.
- `label`: human-readable selector label.
- `description`: optional context for humans and agents.
- `paths`: task edit-boundary globs that belong to the Project.

A task may belong to multiple configured Projects when its frontmatter `scope`
globs overlap multiple entries. Tasks that do not match configured paths should
fall back to inferred navigation such as `Other`.

Example for Forge itself:

```yaml
version: 1
projects:
  - id: web
    label: Web
    paths: ["packages/web/**"]
  - id: cli
    label: CLI
    paths: ["packages/cli/**"]
  - id: core
    label: Core
    paths: ["packages/core/**"]
  - id: planning
    label: Planning
    paths: [".forge/**", "README.md", "AGENTS.md"]
```

Example for a monorepo-style project:

```yaml
version: 1
projects:
  - id: toolhub-wells
    label: ToolHub Wells
    paths:
      - product/toolhub/src/app/**/wells/**
      - product/toolhub/docs/wells/**
  - id: shared-ui
    label: Shared UI
    paths:
      - lib/typescript/ui/**
  - id: charting
    label: Charting
    paths:
      - lib/typescript/fluxchart/**
```

Agents should maintain this file through structured commands:

```sh
forge projects --json
forge projects infer --json
forge projects add web --label "Web" --path "packages/web/**" --json
forge projects update web --path "packages/web/test/**" --json
forge projects remove web --json
```

Use `forge projects infer --json` to suggest candidate Projects from existing
task edit-boundary globs without writing config.

Legacy `forge scopes ...` commands remain compatible for existing agent
workflows.

## Expected Task Markdown Fields

Keep the body readable Markdown. Forge expects every well-formed task brief to
have these Markdown sections:

1. `Why`
2. `What success looks like`
3. `Acceptance Criteria`
4. `Verification`
5. `Notes`

These are expected fields, not frontmatter schema. Missing fields should be
reported as quality warnings by tools, not task parse errors. Direct Markdown
edits are valid for rich task body changes as long as frontmatter stays intact.

Use `forge create` with `--why`, `--success`, repeated `--acceptance`,
repeated `--verification`, and `--notes` to create these fields up front.

Forge also supports these standard sections when the task needs them:

- `Execution Plan`
- `Dependencies`
- `History`

`Execution Plan` lives in the Markdown body, not frontmatter. It is the durable
per-task plan an agent or human can update before implementation begins and as
the work changes. Use this default shape:

- `Summary`: the short implementation intent.
- `Scope`: the files, packages, or behaviors expected to change.
- `Approach`: the ordered implementation steps.
- `Verification`: the checks that should prove the task is complete.
- `Stop conditions`: blockers or risk signals that should pause execution.
- `Human review triggers`: judgment calls that need explicit review.

The CLI should generate expected fields for new tasks. Users may add extra `##`
sections when a task needs more context. Tools should render known sections
first, preserve existing execution plans, and preserve unknown sections rather
than rejecting them.

## Check-In Convention

Task files are the check-in surface. Record evidence in Markdown first; do not
add frontmatter fields for review policy or closeout notes unless Forge later
needs a general machine-readable rule.

Use these sections for check-ins:

- `Execution Plan`: record the current approach before implementation starts.
  Update `Stop conditions` when a task should pause, and `Human review
  triggers` when a judgment call needs a person.
- `Verification`: keep the planned checks for the task.
- `Notes`: append actual decisions, blockers, review requests, and verification
  results as work happens.
- `History`: keep durable lifecycle events such as task creation. Tools may
  append concise lifecycle entries, but routine work evidence belongs in
  `Notes`.

When work is done and verified:

```markdown
## Notes

Implemented the queue keyboard navigation and kept the change inside
`packages/web/**`.

Verification:
- `bun test packages/web`
- `bun run quality:check`
```

Then set `status: done`, clear `claimed_by`, set `closed_at`, and write a short
`close_reason`.

When work is blocked:

```markdown
## Notes

Blocked: the API contract for persisted claims is not decided. Stop until the
planning agent records whether claims are local-only or shared.
```

Then set `status: blocked` and write the same short reason in `blocked_reason`.

When work needs human review but can keep its current status:

```markdown
## Notes

Review needed: the implementation works, but the visual hierarchy in the task
detail card is a product judgment. Do not close until the user reviews the
browser screenshot.
```

Then keep the task claimed or open as appropriate and write the short reason in
`review_reason`. If the task cannot continue without that answer, block it
instead.

App-specific review policy belongs in task Markdown or repository agent
instructions such as `AGENTS.md`, not in Forge's generic task schema. For
example, a web app may require a browser screenshot before closeout, while a
library task may require API compatibility notes.

## Durable Context

Forge does not require or manage decision records. Keep task-local evidence,
verification results, blockers, and task-specific decisions in task `Notes`.

When a choice needs to outlive one task, put the durable explanation in normal
repo documentation or agent instructions such as `AGENTS.md`, then link or
summarize that context from the relevant task. Forge's own historical
`.forge/decisions/` files may remain for compatibility, but they are not part
of the workflow contract.

## Dirty Worktree Coordination

Forge's planner/worker workflow allows a planner to create future tasks while a
worker continues a claimed task. Dirty files are classified relative to the
worker's current claimed task:

- `blocking`: dirty implementation or docs files inside the claimed task scope
  that the worker did not intentionally create or edit during this task.
- `non_blocking`: unrelated future task files, unclaimed planning notes, or
  docs outside the claimed task scope.
- `review`: dirty files that affect coordination or shared behavior, including
  the claimed task file, dependency task files, package manifests, root config,
  generated files, and central exports.

Workers should continue through `non_blocking` dirty files, stop for `blocking`
dirty files, and ask for review or record a clear task note before changing
`review` files. Shared files may still be edited by a coordinating task that
explicitly owns them; the task Notes should explain why that shared edit belongs
with the current work.

## Storage Model

Use one tracked `.forge/` directory at the git repository or Worktree root.

Do not create nested `.forge/` directories inside packages, apps, or modules in v0.
Nested stores split the task graph, make cross-Project dependencies harder to
rank, and create unclear ownership for agents working from a parent Workspace.

Relate work to projects or directories with:

- explicit Projects for human navigation inside a Worktree.
- task `scope` for machine-readable edit-boundary file globs.
- `area` for task categories such as `core`, `cli`, `web`, `docs`, `test`, or
  `harness`.

When Forge serves several roots, call each selectable repo or worktree a
`Worktree`. Use `Project` for a user-facing slice of work inside a selected
Worktree. Project is a navigation concept backed by explicit config when
available; it is not the same thing as task frontmatter `scope`.

## Derived Relationships

Do not store reverse edges unless there is a strong reason.

- `children` is derived by scanning `parent`.
- `blocks` is derived by scanning `depends_on`.
- `ready` is derived from `status`, `depends_on`, and `claimed_by`.

## Ready Rule

A task is ready when:

- `status` is `open`
- `claimed_by` is empty
- every task in `depends_on` is `done` or `canceled`

## Internal Harness Commands

Forge keeps internal developer and agent checks as package scripts, not as
customer-facing `forge` CLI commands.

Forge's own repo keeps concise harness doctrine in
`.forge/harness-engineering.md`. User repos do not need this file unless they
choose to create similar project-local documentation.

- `bun run harness:cli` runs the focused CLI workflow harness.
- `bun run harness:web` runs the current web harness checks.
- `bun run harness:check` runs the aggregate in-repo harness and test suite.
- `bun run quality:check` runs `harness:check` and the production web build.

Use the focused harness when a task touches one surface:

- Web UI, Vite server, or `/api/tasks` changes should name
  `bun run harness:web`.
- CLI workflow, command, prompt, or robot JSON changes should name
  `bun run harness:cli`.
- Broad behavior, graph, task-store, or cross-surface changes should name
  `bun run harness:check`.

Use `bun run quality:check` before closing broad or cross-surface work. These
checks are advisory task guidance, not schema fields, and they should be written
in the task `Verification` or `Notes` sections when relevant.

## Cache Policy

Future tools may create a local cache or index, but cache files must be ignored
by git. Markdown task files remain canonical.
