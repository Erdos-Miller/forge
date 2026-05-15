# Forge Guidance

## Prompt Summary

Forge work is stored in committed Markdown task files under `.forge/tasks`.
Keep task files human-readable, use frontmatter for small structured fields,
and prefer derived graph state over duplicated metadata.

Use internal harness checks as advisory verification: web UI, Vite server, or
`/api/tasks` changes should run `bun run harness:web`; CLI workflow, command,
prompt, or robot JSON changes should run `bun run harness:cli`; broad behavior,
graph, task-store, or cross-surface changes should run
`bun run harness:check`.

## Notes

- Claim a task before editing implementation files.
- Keep each implementation pass inside the task `scope`.
- Update task notes and verification before marking work done.
- Commit code and task-file updates together.
- Write relevant harness commands in task `Verification` or `Notes`; do not add
  new schema fields or per-task harness commands.
