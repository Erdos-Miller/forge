# Decision 0003: Explicit Project Config Compatibility

## Context

Fallback navigation inference keeps the web selector readable, but monorepos
need a repo-local source of truth for the Projects humans expect to browse. Task
frontmatter `scope` already has a different meaning: it is an edit-boundary glob
for agents.

## Decision

Forge's preferred concept is Project: an explicit user-facing slice of work
inside a Worktree. The existing optional `.forge/scopes.yml` file remains the
compatibility config for explicit Projects until follow-up CLI and web work
renames the surface. The file is repo-local, committed, and advisory: repos
without it keep using inferred fallback navigation.

```yaml
version: 1
scopes:
  - id: web
    label: Web
    paths:
      - packages/web/**
  - id: cli
    label: CLI
    paths:
      - packages/cli/**
```

Fields:

- `id`: stable machine id for URLs, CLI output, and future structured tools.
- `label`: human label shown in the web UI.
- `paths`: task edit-boundary globs that belong to this Project.
- `description`: optional human context for agents and docs.

Configured Projects take precedence over inferred fallback navigation. A task can
belong to every configured Project whose `paths` overlap its frontmatter `scope`
globs. Task frontmatter `scope` remains edit-boundary data and is not renamed.

Agents should maintain `.forge/scopes.yml` through structured commands:
`forge scopes --json`, `forge scopes infer --json`, `forge scopes add`, and
`forge scopes update` until Project-named commands exist. Direct edits remain
acceptable for planning only when the structured command surface cannot express
the intended change yet.

## Alternatives

- Keep only inferred navigation. Rejected because inference cannot know product or
  team boundaries.
- Rename task frontmatter `scope`. Rejected because existing tasks and agents
  use it for edit boundaries.
- Store Projects in task frontmatter. Rejected because Projects are shared
  navigation metadata, not per-task lifecycle data.

## Consequences

F-0086 adds structured CLI tools for `.forge/scopes.yml`; F-0087 should validate
the file in `forge doctor`; F-0088 wires configured entries into the web
selector while preserving inferred fallback behavior. Follow-up Project tasks
should add project-facing compatibility and UI language without breaking legacy
`.forge/scopes.yml` users.

## Related Tasks

- F-0080
- F-0084
- F-0085
- F-0086
- F-0087
- F-0088
- F-0101
