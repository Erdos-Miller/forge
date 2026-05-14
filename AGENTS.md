# Agent Guidance

Forge is built from its own task files. Treat `.forge/tasks/*.md` as the coordination surface.

## Roles

Forge currently targets a two-agent workflow.

- The planning agent works ahead: refines specs, breaks down tasks, adjusts dependencies, and records decisions.
- The execution agent works the goal loop: picks ready tasks, implements them, updates task notes, and flags review when blocked or uncertain.

One agent may do both roles in a small session, but keep the distinction clear in the task notes.

## Operating Loop

1. Read `.forge/README.md` and `.forge/specs/F-0000-forge-v0.md`.
2. Pick one ready task: `status: open`, no unfinished `depends_on`, and no `claimed_by`.
3. Claim the task before editing code or docs.
4. Keep edits inside the task scope.
5. Update the task body with decisions, blockers, and verification notes.
6. Mark the task `done` only when its acceptance criteria are satisfied.
7. Commit task-file updates with the work they describe.

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

## File Ownership

Tasks may declare a `scope` field. Treat it as the allowed edit area for that task.

Shared files such as package manifests, root config, generated files, and central exports should be changed by a coordinating task, not casually by multiple agents in parallel.
