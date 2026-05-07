# EPIC 2.8 — Console Debugging Redesign (Cleanup-First)

## Objective

Redesign the console into a clean operator-grade debugging workspace focused on how the system actually works today:

- Avatar memory state and evolution across turns
- Game Master decisions and their user-visible impact
- Per-turn technical timing and latency breakdown
- Persona-first testing path from session start
- Removal of obsolete and duplicate debug surfaces

This EPIC must prioritize clarity and signal over feature sprawl.

## Generated

May 7, 2026

## Prompt Files — Ordered Execution List

| #   | File                                            | Description                                                                          | Depends On |
| --- | ----------------------------------------------- | ------------------------------------------------------------------------------------ | ---------- |
| 0   | 00-contract-cleanup-and-console-path-pruning.md | Remove duplicate contracts and legacy console branches before redesign work          | —          |
| 1   | 01-debugging-shell-and-navigation.md            | Build one clean debugging shell and route users into the latest path only            | 0          |
| 2   | 02-memory-evolution-workspace.md                | Redesign memory visualization to show what avatars hold and how it changes over time | 0,1        |
| 3   | 03-gm-impact-trace.md                           | Redesign GM visibility to show decision, trigger, and user impact causality          | 0,1        |
| 4   | 04-turn-profiler-latency.md                     | Add per-exchange technical timing view for where time is spent                       | 0,1        |
| 5   | 05-persona-first-flow-hardening-doc-sync.md     | Make persona setup first-class and finalize tests, cleanup, and docs                 | 0-4        |

## Dependencies Between Prompts

- Prompt 0 is mandatory and must land first to avoid reinforcing structural drift.
- Prompt 1 establishes the single shell and navigation model used by prompts 2 to 5.
- Prompts 2, 3, and 4 can run in parallel after prompt 1 if ownership is clear.
- Prompt 5 is final and must complete hardening, deletion of leftovers, and documentation synchronization.

## Suggested Execution Order

0 → 1 → 2 → 3 → 4 → 5

## Definition of Done (Full EPIC)

- [ ] Console has one primary debugging path and removes obsolete/duplicate panels and branches.
- [ ] Avatar memory is understandable at a glance and across time (short-term, working, long-term, changes per turn).
- [ ] GM actions are visible with trigger, timing, and user/system impact (for example unlocks, directives, switches).
- [ ] Per-turn technical timing is visible and explains where latency is spent.
- [ ] Persona is part of the happy path at session start, not a hidden late-stage action.
- [ ] Contract ownership remains canonical (no console-local duplicated DTO shapes).
- [ ] If any new endpoint is added, route tests plus stack-e2e auth/validation/not-found coverage are added in the same EPIC.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` pass (and `pnpm test:coverage` when available).
- [ ] `docs/PROJECT_STATUS.md` and all impacted docs are updated and accurate.
