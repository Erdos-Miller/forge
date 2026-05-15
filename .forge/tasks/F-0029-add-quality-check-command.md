---
id: F-0029
title: Add quality check command
kind: task
status: done
priority: urgent
parent: F-0000
depends_on:
  - F-0022
claimed_by: ""
area: test
scope:
  - package.json
  - packages/**
  - .forge/tasks/**
created_at: 2026-05-15T00:00:00-05:00
updated_at: 2026-05-15T04:07:52.388Z
closed_at: 2026-05-15T04:07:52.388Z
close_reason: ""
---

# Add quality check command

## Why

Agents need one obvious closeout command that proves the current Forge checkout is healthy before marking tasks done.

## What success looks like

The repo has a root `bun run quality:check` command that runs the standard Forge test and build gates.

## Acceptance Criteria

- Add a root `quality:check` script.
- The script runs all package tests.
- The script runs the web build.
- The script includes task-store parse validation through existing core tests for now.
- Documentation or task notes name `bun run quality:check` as the default pre-closeout command for agents.
- The command is suitable for local agent use and CI adoption.

## Dependencies

Depends on `F-0022` so quality guidance can reference the settled guidance routing format.

## Verification

- `bun run quality:check` passed from the repo root.
- The script uses `bun run test && bun run --cwd packages/web build`, so a failing package test stops before build and a failing web build returns the build failure.

## Notes

Added the root `quality:check` script as the default pre-closeout command for agents. It runs all package tests, including core task-store parsing tests, then runs the web production build.

## History

- Created 2026-05-15T00:00:00-05:00.
- Claimed and implemented 2026-05-15.
