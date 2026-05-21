---
id: F-0089
title: "Add decision capture to prompts and closeout"
kind: task
status: open
priority: medium
area: "cli"
parent: "F-0000"
depends_on:
  - "F-0080"
claimed_by: ""
scope:
  - "packages/cli/**"
  - ".forge/**"
  - "README.md"
created_at: 2026-05-21T11:54:53-05:00
updated_at: 2026-05-21T11:54:53-05:00
---
# Add decision capture to prompts and closeout

## Why

Agents need reminders to capture durable design decisions when tasks change cross-cutting semantics.

## What success looks like

Generated prompts and closeout guidance remind agents to record decisions in task notes or durable decision records at the right time.

## Acceptance Criteria

- Update task prompt guidance to tell agents to record meaningful decisions.
- Update loop prompt guidance to call out durable cross-cutting decisions.
- Update closeout guidance to ask whether a task changed conventions, architecture, or public semantics.
- Keep reminders concise and non-blocking.
- Tests cover prompt and closeout output where changed.

## Execution Plan

Summary: Thread the decision-record convention into agent-facing guidance.

Scope: CLI prompt formatting, closeout guidance, docs, and focused tests.

Approach:
- Use F-0080's terminology and decision-record convention.
- Add concise guidance to prompts without crowding out task context.
- Add closeout advisory text for durable decisions.
- Keep output advisory; do not require decision records for every task.
- Update tests that assert prompt or closeout text.

Verification:
- `bun run harness:cli`
- Focused prompt and closeout tests.

Stop conditions:
- Stop if prompt output becomes too long or repeats the full decision-record template.

Human review triggers:
- Ask for review if the guidance tone should be stricter than advisory.

## Dependencies

Tracked in frontmatter: F-0080.

## Verification

- Run focused prompt and closeout tests.
- Run `bun run harness:cli`.

## Notes

This task adds reminders only. It should not add doctor warnings yet.

## History

- Created 2026-05-21T11:54:53-05:00.
