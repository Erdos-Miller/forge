---
id: F-0059
title: Add URL-driven web task selection
kind: task
status: done
priority: high
parent: F-0000
depends_on:
  - F-0058
claimed_by: ""
area: web
scope:
  - packages/web/**
  - .forge/tasks/**
created_at: 2026-05-15T16:17:58-05:00
updated_at: 2026-05-15T21:28:53.939Z
closed_at: 2026-05-15T21:28:53.939Z
close_reason: "URL-driven web task selection implemented; web harness, quality gate, and manual URL smoke pass."
blocked_reason: ""
review_reason: ""
---

# Add URL-driven web task selection

## Why

Agents and humans need links from terminal output to open the matching task in the local Forge web UI.

## What success looks like

Opening the web app with `?task=F-0059` selects that task when it is visible, and normal queue navigation keeps the URL in sync.

## Acceptance Criteria

- Support `?task=<id>` on initial web app load.
- Select the requested task only when it is present and visible under the current queue filters.
- Preserve the empty detail state when the requested task is hidden by filters or no visible row exists.
- Update the browser URL when a user selects another visible task.
- Do not select an unrelated fallback task only because the requested task is invalid or hidden.
- Tests cover direct URL load, invalid task IDs, hidden task IDs, and selection updating the URL.

## Execution Plan

Summary: Make the task detail selection addressable by URL without weakening the visible-queue rules.

Scope: `packages/web/**`.

Approach:
- Inspect the current selected-task initialization and refresh path in the web app.
- Read the initial `task` query parameter before choosing the first visible queue task.
- Keep `selectedTaskId` and `window.history` synchronized when the visible selected task changes.
- Reuse the existing empty-state behavior when the requested task is not visible.
- Add focused web tests for URL initialization and URL update behavior.

Verification:
- `bun test packages/web/test/app.test.tsx`
- `bun run harness:web`

Stop conditions:
- Stop if URL selection would require changing task filtering semantics or showing hidden done/canceled tasks.

Human review triggers:
- Ask for review if the URL should encode additional UI state such as scope, grouping, or Show done.

## Dependencies

Depends on `F-0058` because URL selection must respect the fixed empty visible queue behavior.

## Verification

- Run `bun test packages/web/test/app.test.tsx`.
- Run `bun run harness:web`.
- Manually open the web UI with `?task=<id>` and confirm the matching visible task is selected.

## Notes

Do not add browser-tab push navigation in this task. This is only URL-addressable selection.

Implemented URL-driven task selection.

Decisions:
- Initial render reads `?task=<id>` and uses it as the requested selection.
- URL-requested tasks only render detail when the task is present and visible in the current queue.
- Invalid or hidden URL-requested tasks preserve the empty detail state instead of falling back to an unrelated visible task.
- User queue selection and keyboard navigation update the browser URL with the selected task id.
- URL helper logic lives in `packages/web/src/url-selection.ts` to keep `App.tsx` inside the readability ratchet.

Verification:
- `bun test packages/web/test/app.test.tsx`
- `bun run harness:web`
- `bun run quality:check`
- Manual smoke via local `forge web` against a fixture repo at `http://127.0.0.1:5189/?task=F-0002`; headless Chrome rendered the `Ready URL target` row as selected and showed the matching `F-0002` detail pane.

## History

- Created 2026-05-15T16:17:58-05:00.
