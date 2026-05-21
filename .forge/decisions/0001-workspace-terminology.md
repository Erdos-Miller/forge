# Decision 0001: Workspace, Worktree, Project, Area, and Scope Terminology

## Context

Forge now serves multiple `.forge` roots from one local web process. The UI also
has a filter labeled `Scope`, while task frontmatter already has a `scope` field
that means edit-boundary globs. Using the same word for both concepts makes
agent instructions, UI design, and future configuration work ambiguous. Monorepo
work also needs a human concept for product or package slices without implying
that those slices are separate task stores.

## Decision

Use these terms consistently:

- `Workspace`: the multi-root view launched from a parent directory. A Workspace
  is a web browsing context, not a task store.
- `Worktree`: one discovered Forge root in a Workspace. This may be a git
  repository, a git worktree, or another directory that owns a `.forge` store.
- `Project`: an explicit user-facing slice of work inside a Worktree. It is a
  navigation and planning concept, not a task schema field. Examples include
  `Web`, `CLI`, `Shared UI`, or `ToolHub Wells`.
- `Area`: a task category or work type such as `web`, `cli`, `core`, `docs`, or
  `test`. Area answers what kind of work a task is.
- `Task`: one Markdown work item in the Worktree's canonical `.forge/tasks`
  graph.
- `task scope`: the `scope` frontmatter field on a task. It contains file globs
  that describe the expected edit boundary for that task. It does not define a
  Project.
- `Priority`: the urgency ordering used by Forge ranking. It is independent of
  Worktree, Project, Area, and task scope.

The current UI and config may still say `Scope` until the web and CLI controls
are renamed, but docs and task plans should call the user-facing navigation
concept `Project`.

Keep one canonical `.forge` store per repo or worktree root. Nested `.forge`
stores inside packages, apps, or modules remain out of scope for now because they
split the dependency graph, make cross-project blocking relationships harder to
rank, and create unclear ownership for agents working from a parent Workspace.

## Decision Records

Use `.forge/decisions/NNNN-short-title.md` for durable product or architecture
decisions that future tasks must preserve.

Each decision record should include:

- `Context`: the problem or ambiguity.
- `Decision`: the chosen rule or convention.
- `Alternatives`: serious options that were not chosen.
- `Consequences`: follow-up work, tradeoffs, or compatibility notes.
- `Related tasks`: task ids that introduced or depend on the decision.

Task `Notes` remain the place for local implementation evidence, verification
results, blockers, and task-specific decisions. Use a decision record when the
choice changes shared terminology, product behavior, architecture boundaries, or
agent workflow rules across multiple tasks.

## Alternatives

- Keep using `scope` for both the UI filter and task edit-boundary globs.
  Rejected because it made Workspace planning and agent prompts hard to read.
- Rename task frontmatter `scope`. Rejected because existing tasks and tools
  already use it as edit-boundary data.
- Allow nested `.forge` stores for packages or apps. Rejected for v0 because a
  single graph per Worktree keeps dependencies, ranking, and agent ownership
  understandable.
- Store decisions only in task `Notes`. Rejected because cross-cutting decisions
  are hard to rediscover after the task closes.

## Consequences

Future UI and CLI work should use `Workspace` for the parent multi-root view,
`Worktree` for each selectable root, and `Project` for explicit work slices
inside a Worktree. They should avoid presenting task edit globs as user-facing
Projects. Later config work can expose Project language while preserving
backward compatibility with existing `.forge/scopes.yml` files and without
renaming task frontmatter `scope`.

## Related Tasks

- F-0080
- F-0083
- F-0085
- F-0101
