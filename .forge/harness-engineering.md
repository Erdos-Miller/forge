# Forge Harness Engineering

Forge's harness doctrine is inspired by OpenAI's
[Harness engineering](https://openai.com/index/harness-engineering/) post and
the follow-up on the Codex
[App Server harness](https://openai.com/index/unlocking-the-codex-harness/).
Treat those posts as product inspiration, not runtime dependencies.

## Principle

When an agent fails, do not only ask it to try again. Ask what capability,
fixture, check, or visible signal was missing, then add that capability to
Forge so the next agent can verify its own work.

## Rules

- Start with a task brief: `Why`, success state, acceptance criteria,
  verification, and notes should tell the agent what matters and how to prove it.
- Prefer fixture-first checks: reproduce bugs and workflows in disposable
  Forge repos before relying on the real local workspace.
- Keep feedback fast: use focused harnesses such as `bun run harness:cli` and
  `bun run harness:web` before broad quality checks.
- Make state visible: expose task graph JSON, live web views, terminal links,
  and smoke checks so agents can inspect the system directly.
- Record closeout evidence: task notes should name the harnesses, tests, live
  smokes, or screenshots that proved the task is complete.
- Promote repeated failures into tooling: if humans need to report the same
  breakage twice, plan a harness, doctor warning, fixture, or prompt check.

## Forge Defaults

- CLI and robot workflow changes should run `bun run harness:cli`.
- Web UI, Vite server, or `/api/tasks` changes should run `bun run harness:web`.
- Graph, task-store, or cross-surface changes should run
  `bun run harness:check` and usually `bun run quality:check`.
- Workspace or monorepo work should start from fixture repos before touching
  real user workspaces.
- Workspace discovery, API, navigation, live refresh, and terminal-link tasks
  should use the workspace fixture helpers in `packages/core/test/fixture-repo.ts`.
- Planner-ahead / worker-continuation changes should include disposable git
  fixtures proving future task files do not block the active worker, while
  scoped implementation files and dependency task edits still get flagged.
- Close tasks only after the task notes contain concrete verification evidence.
