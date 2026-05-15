---
id: F-0026
title: Add local user guidance convention
kind: task
status: done
priority: high
parent: F-0000
depends_on:
  - F-0022
claimed_by: ""
area: docs
scope:
  - .forge/**
  - .gitignore
  - README.md
created_at: 2026-05-15T00:00:00-05:00
updated_at: 2026-05-15T15:30:01.748Z
closed_at: 2026-05-15T15:30:01.748Z
close_reason: "Local user guidance convention documented and verified"
blocked_reason: ""
review_reason: ""
---

# Add local user guidance convention

## Why

Different users may want different agent preferences without committing those preferences to the repo.

## What success looks like

Forge documents and ignores a local user guidance file that the guidance resolver can include last when present.

## Acceptance Criteria

- Document `.forge/local/user.md` as the local user guidance file.
- Ensure `.forge/local/**` is ignored by git.
- Document that local guidance is included after repo and project guidance.
- Document that local guidance can override or supplement preferences but should not change task acceptance criteria.
- Tests or smoke checks confirm local guidance does not need to exist for normal operation.

## Dependencies

Depends on `F-0022` because local guidance is part of the routing format.

## Verification

- Check git ignore behavior for `.forge/local/user.md`.
- Review docs for clarity on committed versus local guidance.

## Notes

This task establishes the convention. Resolver behavior is covered by `F-0023`.

Documented the local user guidance convention as `.forge/local/user.md`, clarified that local guidance is included after committed repo/project guidance, and stated that it can supplement preferences but must not change task acceptance criteria.

Kept the existing `.forge/guidance.local.md` ignore entry for compatibility and added ignore coverage for `.forge/local/**`.

Verification passed:
- git check-ignore -v .forge/local/user.md
- test ! -e .forge/local/user.md
- bun packages/cli/src/index.ts guidance --json
- Reviewed README.md and .forge/README.md for committed versus local guidance wording.

## History

- Created 2026-05-15T00:00:00-05:00.
