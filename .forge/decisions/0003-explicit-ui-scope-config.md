# Decision 0003: Explicit UI Scope Config

## Context

Fallback UI Scope inference keeps the web selector readable, but monorepos need
a repo-local source of truth for the slices of work humans expect to browse.
Task frontmatter `scope` already has a different meaning: it is an edit-boundary
glob for agents.

## Decision

Forge will use optional `.forge/scopes.yml` configuration for explicit UI
Scopes. The file is repo-local, committed, and advisory: repos without it keep
using inferred fallback scopes.

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
- `paths`: task edit-boundary globs that belong to this UI Scope.
- `description`: optional human context for agents and docs.

Configured UI Scopes take precedence over inferred fallback scopes. A task can
belong to every configured UI Scope whose `paths` overlap its frontmatter
`scope` globs. Task frontmatter `scope` remains edit-boundary data and is not
renamed.

Future tools should maintain `.forge/scopes.yml` through structured commands
such as `forge scopes list`, `forge scopes add`, `forge scopes set`, and
`forge scopes remove`. Until those tools exist, direct edits are acceptable for
planning, but agents should prefer the structured commands once available.

## Alternatives

- Keep only inferred scopes. Rejected because inference cannot know product or
  team boundaries.
- Rename task frontmatter `scope`. Rejected because existing tasks and agents
  use it for edit boundaries.
- Store UI Scopes in task frontmatter. Rejected because UI Scopes are shared
  navigation metadata, not per-task lifecycle data.

## Consequences

F-0086 should add structured CLI tools for `.forge/scopes.yml`; F-0087 should
validate the file in `forge doctor`; F-0088 should wire configured UI Scopes
into the web selector while preserving inferred fallback behavior.

## Related Tasks

- F-0080
- F-0084
- F-0085
- F-0086
- F-0087
- F-0088
