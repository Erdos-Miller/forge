---
id: F-0000
title: Forge v0
kind: spec
status: open
priority: high
parent: ""
depends_on: []
claimed_by: ""
scope:
  - .forge/**
  - README.md
  - AGENTS.md
created_at: 2026-05-14T00:00:00-05:00
updated_at: 2026-05-14T00:00:00-05:00
---

# Forge v0

## Vision

Forge is a local-first task system for codebases where humans and agents work through git.

Work should be understandable from the repository alone. The CLI and web app should make the workflow faster, but should not become required to inspect or repair project state.

## Principles

- Files are the source of truth.
- Markdown is the durable human interface.
- Frontmatter is for small, boring structured fields.
- Derived state should be computed, not duplicated.
- Branches and worktrees are first-class.
- A local web app should feel like Storybook for work: browsable, inspectable, and fast.
- The first workflow should support one planning agent and one execution agent.

## V0 Capabilities

- Define a stable Markdown task format.
- Parse task files.
- List tasks by status.
- Compute ready tasks from dependencies.
- Claim and close tasks.
- Serve a local web UI over the same files.
- Document a simple agent loop.
- Show enough plan context that a human can review direction before code changes land.

## Open Questions

- Should task ids be sequential, timestamp-based, or generated from git history?
- Should status be represented only in frontmatter, or also by folders?
- Should claims include expiry?
- Should the web app write files directly, or call the CLI/core library?
- How much branch/worktree awareness belongs in v0?
- What is the smallest useful review state: notes, status field, or a separate field?
