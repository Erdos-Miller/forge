---
id: F-0071
title: "Privilege expected fields in prompts and web"
kind: task
status: done
priority: medium
area: "web"
parent: "F-0000"
depends_on:
  - "F-0068"
claimed_by: ""
scope:
  - "packages/cli/**"
  - "packages/web/**"
  - ".forge/**"
created_at: 2026-05-20T15:37:30.151Z
updated_at: 2026-05-21T15:56:21.640Z
closed_at: 2026-05-21T15:56:21.640Z
close_reason: ""
blocked_reason: ""
review_reason: ""
---
# Privilege expected fields in prompts and web

## Why

If Why, Success, Acceptance, Verification, and Notes are the standard task brief, agents and humans should see them as the primary reading path.

## What success looks like

Generated prompts and the web detail view emphasize the expected task fields ahead of lower-priority supporting sections.

## Acceptance Criteria

- forge prompt renders expected fields in a clear order and keeps command guidance separate from task content.
- The web detail view keeps Why, What success looks like, Acceptance Criteria, Verification, and Notes as the primary task brief.
- Verification may remain collapsed in the web UI if that best preserves readability.
- Dependencies remain demoted as supporting context.
- Unknown sections remain visible under additional or supporting details.

## Execution Plan

Summary: Align prompt and web reading order with the expected task brief fields.

Scope: CLI prompt formatting, web section organization/detail rendering, and focused tests.

Approach:
- Render Why, What success looks like, Acceptance Criteria, Verification, and Notes as the primary task brief.
- Keep command guidance separate from task content in generated prompts.
- Keep dependencies and unknown sections as supporting details.
- Preserve current readability choices, including collapsed Verification if the UI works better that way.

Verification:
- bun test packages/cli/test/prompt-guidance.test.ts packages/web/test/sections.test.ts packages/web/test/App.test.tsx
- bun run harness:web

Stop conditions:
- Stop if this conflicts with the task card readability direction; capture the design tradeoff before changing layout.

Human review triggers:
- Ask for visual review if the web detail hierarchy changes materially.

## Dependencies

Tracked in frontmatter: F-0068.

## Verification

- bun test packages/cli/test/prompt-guidance.test.ts packages/web/test/sections.test.ts packages/web/test/App.test.tsx
- bun run harness:web

## Notes

This task should preserve the current readable-card direction while aligning it with the expected field convention.

Decision: `forge prompt` now formats task Markdown into a primary Task brief and a separate Supporting task details block. Why, What success looks like, Acceptance Criteria, Verification, and Notes render first; Execution Plan, Dependencies, History, and unknown sections remain visible afterward. Command guidance stays outside the task content.

Decision: The web detail view keeps the same readable-card layout, but moves Notes and collapsed Verification into the primary brief before Execution Plan and demotes Execution Plan, Dependencies, History, implementation notes, and unknown sections into supporting details.

Verification:
- bun test packages/cli/test/prompt-guidance.test.ts packages/web/test/sections.test.ts packages/web/test/app.test.tsx: 33 pass, 194 expect() calls.
- bun run harness:cli: 7 pass, 89 expect() calls.
- bun run harness:web: 41 pass, 163 expect() calls.
- bun run quality:check: 205 pass, 1016 expect() calls, web production build passed.

## History

- Created 2026-05-20T15:37:30.151Z.
