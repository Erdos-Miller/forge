---
id: F-0008
title: Design rationale
kind: spec
status: open
priority: high
parent: F-0000
depends_on: []
claimed_by: ""
scope:
  - .forge/**
  - AGENTS.md
  - README.md
created_at: 2026-05-14T00:00:00-05:00
updated_at: 2026-05-14T00:00:00-05:00
---

# Design Rationale

Forge exists because agent work needs a coordination surface that works with git, branches, and worktrees.

## Why Files

Files in git are the source of truth because they branch, diff, merge, and survive without a service.

The task format should be readable in a normal editor. If Forge tooling breaks, the plan should still be understandable and repairable.

## Why Markdown

Markdown gives each task room for context, decisions, acceptance criteria, and review notes. YAML frontmatter gives tools enough structure without making the whole task feel like a machine record.

JSONL is technically open, but it is awkward for agents and humans to edit safely. One invalid line, reformat, or merge conflict can damage the task store.

## Why Not Tracked SQLite

SQLite is useful as a local cache or index, but it should not be tracked as the canonical state. It does not merge well, and it creates confusion when branches or worktrees disagree with the database.

If Forge adds a database later, it should be disposable and ignored by git.

## Why Derived Graphs

Store only the forward relationships:

- `parent`
- `depends_on`

Everything else should be computed:

- `children`
- `blocks`
- `ready`

Duplicating both directions makes the graph easier to corrupt.

## Why Web First

A TUI could be useful later, but the first interactive view should be a local web app.

The web app is meant to feel like Storybook for work: a fast local browser for the plan, task details, dependency state, branches, and review status. It should help humans and agents see the work graph, not become a hosted project manager.

## Why Two Agents

The target workflow starts with two roles:

- a planning agent that thinks ahead, breaks down work, clarifies dependencies, and prepares tasks
- an execution agent that loops on ready tasks, implements them, and flags review when needed

This keeps architecture and planning coherent while still allowing steady implementation.

## Why Not Full Parallelism First

Early product work needs coherent decisions more than raw parallel code output. Forge should support parallel agents, but the first workflow should avoid many agents editing the same files and creating merge debt.
