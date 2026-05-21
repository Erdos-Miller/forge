# Decision 0001: Workspace Terminology

## Context

Forge now serves multiple `.forge` roots from one local web process. The UI also
has a filter labeled `Scope`, while task frontmatter already has a `scope` field
that means edit-boundary globs. Using the same word for both concepts makes
agent instructions, UI design, and future configuration work ambiguous.

## Decision

Use these terms consistently:

- `Worktree`: a selectable Forge root in the web UI. This may be a git
  repository, a git worktree, or another directory that owns a `.forge` store.
- `UI Scope`: a user-facing slice of work inside the selected Worktree. It is a
  product navigation concept, not a task schema field.
- `Area`: a task category or work type such as `web`, `cli`, `core`, `docs`, or
  `test`.
- `task scope`: the `scope` frontmatter field on a task. It contains file globs
  that describe the expected edit boundary for that task.
- `Priority`: the urgency ordering used by Forge ranking. It is independent of
  Worktree, UI Scope, Area, and task scope.

The current UI label may still say `Scope` until the web controls are renamed,
but docs and task plans should call that concept `UI Scope` when precision
matters.

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
  Rejected because it made workspace planning and agent prompts hard to read.
- Rename task frontmatter `scope`. Rejected because existing tasks and tools
  already use it as edit-boundary data.
- Store decisions only in task `Notes`. Rejected because cross-cutting decisions
  are hard to rediscover after the task closes.

## Consequences

Future UI and CLI work should prefer `Worktree` for the repo selector and should
avoid presenting task edit globs as user-facing project scopes. Later scope
configuration work can define explicit UI Scopes without changing task
frontmatter.

## Related Tasks

- F-0080
- F-0083
- F-0085
