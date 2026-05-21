# Decision 0002: Dirty Worktree Coordination

## Context

Forge supports a planner/worker workflow in one shared Worktree. The planner may
create or refine future task files while the worker is implementing a claimed
task. Treating every dirty file as a stop condition would block useful planning
work, but ignoring relevant dirty files can overwrite another agent's work.

## Decision

Classify dirty files relative to the worker's current claimed task:

- `blocking`: the dirty file is inside the claimed task's task scope and the
  worker did not intentionally create or edit it during this task.
- `non_blocking`: the dirty file is unrelated to the claimed task, such as a
  future unclaimed task file, planning notes for later work, or docs outside the
  claimed task scope.
- `review`: the dirty file may affect coordination but is not clearly blocking.
  This includes the claimed task file, dependency task files, shared manifests,
  root config, generated files, central exports, and other shared coordination
  surfaces.

Workers should continue through `non_blocking` dirty files, stop for
`blocking` dirty files, and ask for review or record a decision before changing
`review` files. A worker may edit shared files when the current task explicitly
owns them, but the task Notes should say why the shared edit belongs there.

## Alternatives

- Stop on any dirty worktree. Rejected because it prevents the planner from
  working ahead.
- Ignore all dirty files outside the claimed task scope. Rejected because
  shared manifests, central exports, root config, and dependency task files can
  still affect the worker's implementation.
- Require a new task schema field before documenting policy. Rejected because
  agents need the rule now and later tooling can classify the same cases.

## Consequences

Future tooling can implement `forge worktree-status --json` using these classes.
Prompt and closeout guidance should eventually surface `blocking`, `review`, and
`non_blocking` files instead of treating a dirty worktree as a single state.

## Related Tasks

- F-0091
- F-0092
- F-0093
- F-0094
