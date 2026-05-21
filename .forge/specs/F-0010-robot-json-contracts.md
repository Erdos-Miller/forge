# Robot JSON Contracts

Forge robot mode is a compact JSON surface for agents. Human-readable CLI output can change, but these contracts are intended to stay stable once implemented.

## Global Rules

- JSON output is selected by `--json`.
- Every response has `ok` and `version`.
- `version` is `1` for the v0 robot contract.
- Successful commands write one JSON object to stdout and exit according to the exit-code table.
- Failed commands write one JSON object to stderr using the shared error shape.
- Timestamps are ISO strings as stored in task frontmatter.
- Missing optional scalar values are `null`.
- Missing optional list values are `[]`.
- Task ids are the stable foreign keys. Titles and paths are display context only.

## Exit Codes

| Code | Meaning |
| --- | --- |
| `0` | Command succeeded. |
| `1` | Runtime failure such as unreadable files or failed writes. |
| `2` | Usage error, invalid option, or malformed input. |
| `3` | Requested task was not found. |
| `4` | Task graph has blocking diagnostics such as duplicate ids, missing dependencies, or dependency cycles. |
| `5` | Write command could not safely update a task file. |

Graph diagnostics use exit `4` for commands whose purpose requires a healthy graph. Read-only inspection commands may still return `0` when diagnostics are included in the payload and the requested information can be computed.

## Shared Types

### Task Summary

Task summaries are intentionally compact:

```ts
type RobotTaskSummary = {
  id: string;
  title: string;
  status: "open" | "doing" | "blocked" | "done" | "canceled";
  priority: "urgent" | "high" | "medium" | "low";
  area: string | null;
  claimed_by: string | null;
  scope: string[];
  depends_on: string[];
};
```

### Blocker

```ts
type RobotBlocker = {
  kind:
    | "status"
    | "claim"
    | "missing_dependency"
    | "dependency_status"
    | "duplicate_id"
    | "cycle";
  message: string;
  taskId?: string;
  dependencyId?: string;
};
```

### Diagnostics

```ts
type RobotDiagnostics = {
  missingDependencies: Array<{ taskId: string; dependencyId: string }>;
  dependencyCycles: Array<{ taskIds: string[] }>;
  duplicateTaskIds: Array<{ taskId: string; sourcePaths: string[] }>;
};
```

## Commands

### `queue`

Returns ranked work plus diagnostics needed to explain whether each item is actionable.

<!-- contract:queue -->
```json
{
  "ok": true,
  "version": 1,
  "repoRoot": "/repo",
  "tasks": [
    {
      "id": "F-0010",
      "title": "Define robot JSON contracts",
      "status": "open",
      "priority": "urgent",
      "area": "cli",
      "claimed_by": null,
      "scope": [".forge/**", "packages/cli/**", "packages/core/**"],
      "depends_on": ["F-0004"],
      "ready": true,
      "rank": 1,
      "blockers": []
    }
  ],
  "diagnostics": {
    "missingDependencies": [],
    "dependencyCycles": [],
    "duplicateTaskIds": []
  }
}
```

### `next`

Returns the first ready task in Forge ranking order. No ready work is a successful response with `task: null`.

<!-- contract:next -->
```json
{
  "ok": true,
  "version": 1,
  "task": {
    "id": "F-0010",
    "title": "Define robot JSON contracts",
    "status": "open",
    "priority": "urgent",
    "area": "cli",
    "claimed_by": null,
    "scope": [".forge/**", "packages/cli/**", "packages/core/**"],
    "depends_on": ["F-0004"],
    "ready": true,
    "rank": 1,
    "blockers": []
  },
  "reason": "ready"
}
```

When no task is ready:

```json
{
  "ok": true,
  "version": 1,
  "task": null,
  "reason": "empty"
}
```

### `show`

Returns one full task document for agent context.

<!-- contract:show -->
```json
{
  "ok": true,
  "version": 1,
  "task": {
    "id": "F-0010",
    "title": "Define robot JSON contracts",
    "kind": "task",
    "status": "open",
    "priority": "urgent",
    "area": "cli",
    "parent": "F-0000",
    "depends_on": ["F-0004"],
    "claimed_by": null,
    "scope": [".forge/**", "packages/cli/**", "packages/core/**"],
    "created_at": "2026-05-15T00:00:00-05:00",
    "updated_at": "2026-05-15T00:00:00-05:00",
    "closed_at": null,
    "close_reason": null,
    "blocked_reason": null,
    "review_reason": null,
    "sourcePath": "/repo/.forge/tasks/F-0010-define-robot-json-contracts.md",
    "body": "# Define robot JSON contracts\n\n## Why\n\nAgents need stable command output."
  }
}
```

### `done`

Marks one task done and returns the updated task summary when `--json` is present.

<!-- contract:done -->
```json
{
  "ok": true,
  "version": 1,
  "task": {
    "id": "F-0010",
    "title": "Define robot JSON contracts",
    "status": "done",
    "priority": "urgent",
    "area": "cli",
    "claimed_by": null,
    "scope": [".forge/**", "packages/cli/**", "packages/core/**"],
    "depends_on": ["F-0004"],
    "closed_at": "2026-05-15T01:00:00-05:00",
    "close_reason": "Verified"
  }
}
```

### `blockers`

Returns normalized blockers for one task.

<!-- contract:blockers -->
```json
{
  "ok": true,
  "version": 1,
  "taskId": "F-0010",
  "blockers": [
    {
      "kind": "dependency_status",
      "message": "dependency F-0004 is open",
      "taskId": "F-0010",
      "dependencyId": "F-0004"
    }
  ]
}
```

### `deps`

Returns direct dependencies and direct dependents for one task. This command does not recursively expand the graph.

<!-- contract:deps -->
```json
{
  "ok": true,
  "version": 1,
  "taskId": "F-0010",
  "depends_on": [
    {
      "id": "F-0004",
      "title": "Build minimal CLI",
      "status": "done"
    }
  ],
  "dependents": [
    {
      "id": "F-0013",
      "title": "Add robot queue/show introspection",
      "status": "open"
    }
  ]
}
```

### `worktree-status`

Classifies dirty git files relative to the selected task. When `--task` is not
provided, Forge infers the task only when exactly one active claimed task exists.

<!-- contract:worktree-status -->
```json
{
  "ok": true,
  "version": 1,
  "repoRoot": "/repo",
  "task": {
    "id": "F-0010",
    "title": "Define robot JSON contracts",
    "status": "doing",
    "priority": "urgent",
    "area": "cli",
    "claimed_by": "codex",
    "scope": [".forge/**", "packages/cli/**", "packages/core/**"],
    "depends_on": ["F-0004"]
  },
  "summary": {
    "blocking": 1,
    "review": 1,
    "non_blocking": 1,
    "total": 3,
    "clean": false,
    "taskInference": "single_active_claimed"
  },
  "files": [
    {
      "path": "packages/cli/src/index.ts",
      "status": " M",
      "classification": "blocking",
      "reason": "inside_task_scope"
    }
  ],
  "recommendation": "stop"
}
```

### `doctor`

Returns graph health diagnostics. It exits `0` when `summary.errors` is `0`; otherwise it exits `4`.

<!-- contract:doctor -->
```json
{
  "ok": true,
  "version": 1,
  "summary": {
    "errors": 0,
    "warnings": 0
  },
  "diagnostics": {
    "missingDependencies": [],
    "dependencyCycles": [],
    "duplicateTaskIds": []
  }
}
```

## Shared Error Response

<!-- contract:error -->
```json
{
  "ok": false,
  "version": 1,
  "error": {
    "code": "task_not_found",
    "message": "task F-9999 not found",
    "details": {
      "taskId": "F-9999"
    }
  }
}
```

Known error codes:

- `usage_error`
- `task_not_found`
- `graph_diagnostics`
- `read_failed`
- `write_failed`
- `parse_failed`

## Implementation Notes

- `queue` and `next` should use the same ranking engine as the web queue.
- `ready` is derived from status, claim, dependencies, duplicate ids, missing dependencies, and cycles.
- `blockers` should be structured at the boundary even if internal diagnostics start as strings.
- `show` is the only robot command in this set that returns Markdown body content.
- Future lifecycle write commands should reuse the shared error response and exit-code table.
