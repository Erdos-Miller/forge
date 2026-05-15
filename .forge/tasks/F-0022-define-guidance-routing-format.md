---
id: F-0022
title: Define guidance routing format
kind: task
status: done
priority: urgent
parent: F-0000
depends_on:
  - F-0010
claimed_by: ""
area: docs
scope:
  - .forge/**
  - README.md
  - AGENTS.md
created_at: 2026-05-15T00:00:00-05:00
updated_at: 2026-05-15T05:30:00.000Z
closed_at: 2026-05-15T05:00:00.000Z
close_reason: "Backfilled by F-0045; timestamp is approximate."
---

# Define guidance routing format

## Why

Agents need the right repo, project, library, and user guidance based on where they are working. Forge should route that context from files instead of hardcoding product rules.

## What success looks like

Forge has a documented `.forge/guidance.yml` format and guidance file convention for matching context by task area, task scope, explicit paths, and current working directory.

## Acceptance Criteria

- Document `.forge/guidance.yml` as the committed routing config.
- Document `.forge/guidance/*.md` as shared repo guidance files.
- Document matching by `area`, `scope`, explicit `path`, and `cwd`.
- Document `## Prompt Summary` as the default excerpt used in agent prompts.
- Document local ignored user guidance as included last when present.
- Document deterministic include order and de-duplication expectations.

## Dependencies

Depends on `F-0010` because guidance routing should fit the robot JSON and prompt contracts.

## Verification

- `forge list` parsed the task graph successfully after adding the guidance docs.
- Reviewed the format against monorepo contexts: product apps via `area`, shared libraries via `scope`, frontend/test paths via `path`, and nested package work via `cwd`.
- Kept the config to `version`, `routes`, `include`, and `when` so agents and humans can maintain it by hand.

## Notes

Documented the routing contract without implementing a resolver. Added a starter `.forge/guidance.yml`, shared `.forge/guidance/forge.md`, and `.forge/.gitignore` entry for local `.forge/guidance.local.md`.

## History

- Created 2026-05-15T00:00:00-05:00.
- Claimed and documented 2026-05-15.
