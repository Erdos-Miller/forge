---
id: F-0072
title: "Add harness engineering doctrine docs"
kind: task
status: done
priority: high
area: "docs"
parent: "F-0000"
depends_on:
  - "F-0066"
  - "F-0068"
claimed_by: ""
scope:
  - ".forge/**"
  - "packages/cli/**"
  - "README.md"
created_at: 2026-05-21T09:50:50-05:00
updated_at: 2026-05-21T15:05:17.904Z
closed_at: 2026-05-21T15:05:17.904Z
close_reason: "Harness engineering doctrine documented, prompt pointer added, and required checks passed."
blocked_reason: ""
review_reason: ""
---
# Add harness engineering doctrine docs

## Why

Forge needs explicit harness engineering guidance so future agents build fast, observable workflows instead of relying on vague task notes or the real local workspace.

## What success looks like

Forge has a concise harness doctrine document that references the two OpenAI harness posts and translates them into Forge-specific agent workflow rules.

## Acceptance Criteria

- Add a Forge harness engineering doc that references `https://openai.com/index/harness-engineering/`.
- Reference `https://openai.com/index/unlocking-the-codex-harness/` as the app-server harness follow-up.
- Translate the posts into Forge rules for task briefs, fast feedback, fixture-first tests, live web visibility, and closeout evidence.
- Update Forge docs or prompt guidance to point agents at the doctrine without reintroducing routed repo guidance.
- Keep the guidance concise enough to fit into prompts as a summary, with the longer document available for deeper reading.

## Execution Plan

Summary: Document Forge's harness engineering doctrine before the workspace web arc starts.

Scope: Forge docs, prompt guidance text if needed, and focused prompt/doc tests.

Approach:
- Add a durable harness engineering document under `.forge/` or the repo docs area.
- Link the two OpenAI posts and state that they are inspiration, not external runtime dependencies.
- Write Forge-specific rules around fixtures, focused harnesses, visible state, and verification notes.
- Update prompt or loop guidance only with a short summary and reference, not the full essay.
- Verify that routed repo guidance removal remains intact.

Verification:
- `bun run harness:cli`
- `bun run quality:check`

Stop conditions:
- Stop if this starts reintroducing `.forge/guidance.yml` routing or repo-local hidden guidance.

Human review triggers:
- Ask for review if the doctrine needs stronger product language than practical agent workflow guidance.

## Dependencies

Tracked in frontmatter: F-0066, F-0068.

## Verification

- Run `bun run harness:cli`.
- Run `bun run quality:check`.
- Inspect a generated prompt if prompt text changes.

## Notes

This task should set the expectations that later workspace tasks use fixture workspaces and focused harnesses.

Implemented Forge harness engineering doctrine.

Decisions:
- Added `.forge/harness-engineering.md` with concise Forge-specific rules inspired by the OpenAI harness engineering and Codex App Server harness posts.
- Added a `.forge/README.md` pointer from internal harness commands to the doctrine doc.
- Added one compact generated prompt reminder that points agents at `.forge/harness-engineering.md` when deciding whether a failure needs a fixture, harness, doctor warning, or smoke test.
- Did not reintroduce routed repo guidance or `.forge/guidance.yml`.

Verification:
- Inspected generated prompt command guidance for `F-0072`; it includes the doctrine pointer and keeps the command surface concise.
- `bun test packages/cli/test/prompt-guidance.test.ts` passed: 2 tests, 0 failures.
- `bun run harness:cli` passed: 7 tests, 0 failures.
- `bun run quality:check` passed: 176 tests, 0 failures, web production build passed.

Closeout review resolution:
- The doctrine stayed practical and agent-workflow focused; no stronger product language was needed.
- No `.forge/guidance.yml`, `.forge/guidance/*`, or repo-local hidden guidance path was added.

## History

- Created 2026-05-21T09:50:50-05:00.
