---
id: F-0020
title: Add keyboard queue navigation
kind: task
status: open
priority: high
parent: F-0000
depends_on:
  - F-0005
claimed_by: ""
area: web
scope:
  - packages/web/**
  - .forge/tasks/**
created_at: 2026-05-15T00:00:00-05:00
updated_at: 2026-05-15T00:00:00-05:00
closed_at: ""
close_reason: ""
---

# Add keyboard queue navigation

## Why

The web board should be fast to scan during dogfooding. Humans should be able to move through the visible queue and inspect task details without switching between mouse and keyboard.

## What success looks like

The Queue view supports keyboard navigation through the currently visible task list, and the selected task detail updates immediately.

## Acceptance Criteria

- ArrowDown selects the next visible queue task.
- ArrowUp selects the previous visible queue task.
- Home selects the first visible queue task.
- End selects the last visible queue task.
- The selected queue row scrolls into view inside the queue panel when navigation moves it.
- Keyboard navigation follows the current visible `queueTasks` order after scope filtering, grouping, and Show done changes.
- Shortcuts are ignored when focus is inside `input`, `select`, `textarea`, or an interactive button/control.
- Existing click selection behavior continues to work.
- Component tests cover ArrowDown, ArrowUp, Home, End, ignored form-control focus, and filtered visible order.

## Dependencies

Depends on `F-0005` because the queue-first web board must exist before adding keyboard navigation.

## Verification

- Run `bun test` in `packages/web`.
- Run `bun run build` in `packages/web`.
- Manually smoke-check keyboard navigation in the local web board.

## Notes

This is a web usability task only. It should not add task mutation behavior or depend on robot-mode CLI work.

## History

- Created 2026-05-15T00:00:00-05:00.
