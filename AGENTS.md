# Agent Guidance

Forge is built from its own task files. Treat `.forge/tasks/*.md` as the coordination surface.

## Roles

Forge currently works with one builder or multiple cooperating agents. Treat
planning and execution as workflow modes, not required separate people.

- Planning mode works ahead: refines specs, breaks down tasks, adjusts dependencies, and records decisions.
- Execution mode works the goal loop: picks ready tasks, implements them, updates task notes, and flags review when blocked or uncertain.

A single builder may do both modes in one session. Keep the distinction clear in
task notes when switching between planning and implementation.

## Operating Loop

1. Read `.forge/README.md` and `.forge/specs/F-0000-forge-v0.md`.
2. Pick the next ready task: `status: open`, no unfinished `depends_on`, and no `claimed_by`.
3. Claim the task before editing code or docs.
4. Keep edits inside the task scope.
5. Update the task body with decisions, blockers, and verification notes.
6. Follow the check-in convention in `.forge/README.md`: write verification
   evidence in `Notes`, record review needs in `review_reason`, and block work
   instead of closing when a stop condition prevents completion.
7. Mark the task `done` only when its acceptance criteria are satisfied and the
   verification evidence is recorded.
8. Commit task-file updates with the work they describe.
9. Repeat from step 2 until no task is ready, the next task is ambiguous, the work exceeds scope, verification cannot run, or user judgment is needed.

## Planning Loop

1. Read the current spec and task graph.
2. Add or refine tasks before implementation needs them.
3. Keep tasks small enough for one coherent change.
4. Add dependencies when ordering matters.
5. Record open questions in the spec or task body.
6. Avoid planning far beyond what the implementation can validate.

## Coordination Rules

- Do not edit another active agent's claimed task unless asked.
- Do not invent new schema fields casually; update `.forge/README.md` first.
- Prefer one task per coherent change.
- If a task needs shared files or broad architecture decisions, pause and document the decision in the task before implementing.
- Keep task files readable as Markdown documents, not just machine records.
- Flag tasks for review in the notes when judgment is needed before continuing.
- Put app-specific review rules in normal repo docs, task Markdown, or
  `AGENTS.md`. Keep Forge's generic task schema focused on common lifecycle
  state.

## Dirty Worktree Policy

Dirty files are evaluated relative to the current claimed task, not as one
global stop signal.

- `blocking`: dirty implementation or docs files inside the claimed task scope
  that this worker did not intentionally create or edit. Stop before touching
  them.
- `non_blocking`: unrelated future task files, unclaimed planning notes, or
  docs outside the claimed task scope. Continue, but do not commit them with
  worker changes.
- `review`: dirty files that affect coordination or shared behavior, including
  the claimed task file, dependency task files, package manifests, root config,
  generated files, and central exports. Pause or record a clear task note before
  editing them unless the current task explicitly owns that surface.

Planner-created future tasks are not a worker stop condition by themselves.
Workers stop for relevant conflicts, not for all dirty worktree state.

## File Ownership

Tasks may declare a `scope` field. Treat it as the allowed edit area for that task.
This is task edit-boundary scope, not the user-facing Project concept.

Use the terminology from `.forge/README.md`: a Workspace is the parent multi-root
view, a Worktree is one discovered `.forge` root, a Project is an explicit work
slice inside a Worktree, Area is the task category, and task `scope` is only
edit-boundary globs.

Shared files such as package manifests, root config, generated files, and central exports should be changed by a coordinating task, not casually by multiple agents in parallel.
