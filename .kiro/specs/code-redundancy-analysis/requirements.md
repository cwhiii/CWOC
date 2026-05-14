# Code Deduplication Audit

## Goal

Find every place in the CWOC codebase (frontend JS + backend Python) where the same logic is implemented more than once, and consolidate into a single shared implementation so that one change propagates everywhere.

## What Counts as Duplication

A pattern qualifies if: **changing the behavior of one instance would require you to remember to change the other(s) to stay consistent.**

Examples:
- Two functions that render the same kind of UI component (cards, trees, lists) in different files
- The same data transformation/formatting logic copy-pasted across files
- Validation or business logic that appears in multiple places
- Modal/dialog construction that's reimplemented per-page instead of calling a shared builder

## What Does NOT Count

- Boilerplate inherent to the pattern (e.g., every route opens a DB connection — that's just how SQLite works)
- Two-line utility calls that happen to look similar but serve genuinely different purposes
- Functions that look alike but have different semantics and would evolve independently

## Deliverables

1. **Tracking file** (`Tasks/deduplication-tracker.md`) with three numbered sections:
   - **Fixed** — duplications that were consolidated into a shared implementation
   - **Left Alone** — things that looked similar but aren't real duplication (with brief reason)
   - **Gray Area** — borderline cases, numbered, with brief description so the user can decide yes/no

2. **Consolidated code** — for every item in "Fixed", the actual code change: extract shared function, delete duplicates, wire up callers

## Constraints

- Must not change existing behavior — pure refactor
- Must not introduce new dependencies
- Must follow existing code style and conventions
- Each consolidation should be independently reversible
- Update INDEX.md at the end to reflect any new shared functions or moved code