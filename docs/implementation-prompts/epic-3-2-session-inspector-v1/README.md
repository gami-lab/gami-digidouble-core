# EPIC 3.2 — Session Inspector v1

## Objective

Consolidate the existing session-inspection surfaces into one clean operator flow. This EPIC audits and prunes redundant admin observability routes, shared DTO copies, and console query layers. It should prefer the current read surfaces and remove duplication rather than add a new inspector endpoint.

## Generated

May 10, 2026

## Prompt Files

| #   | File                                                                         | What It Delivers                                                                                   |
| --- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 0   | [00-contract-cleanup.md](00-contract-cleanup.md)                             | Audit inspector contracts, remove duplicated DTO ownership, and pick the canonical source of truth |
| 1   | [01-core-surface-consolidation.md](01-core-surface-consolidation.md)         | Collapse redundant backend inspector read paths and remove backwards-compatibility code            |
| 2   | [02-console-session-inspector-flow.md](02-console-session-inspector-flow.md) | Unify the console session-inspector flow around one composition layer and one operator path        |
| 3   | [03-tests-and-hardening.md](03-tests-and-hardening.md)                       | Update unit, E2E, and stack-E2E coverage for the final inspector surface                           |
| 4   | [04-doc-sync.md](04-doc-sync.md)                                             | Sync API, architecture, status, and testing docs with the final clean inspector shape              |

## Execution Order

Run the prompts sequentially. Each prompt assumes the previous one is complete and committed.

```
00 -> 01 -> 02 -> 03 -> 04
```

## Dependencies Between Prompts

- Prompt 0 is mandatory because this EPIC touches existing session, message, memory, GM state, metrics, and admin DTOs.
- Prompt 1 depends on the contract audit because it should remove redundant backend surfaces only after the canonical owners are clear.
- Prompt 2 depends on the backend cleanup so the console can consume one clean read path instead of juggling compatibility branches.
- Prompt 3 depends on the final route and console shape so it can remove stale tests and lock the final contract down.
- Prompt 4 is always last because documentation must reflect the final implementation, not the draft design.

## Definition of Done (Full EPIC)

- [ ] There is one canonical owner for each session-inspector DTO and no console-local copies of the same admin shapes remain.
- [ ] Redundant inspector endpoints, aliases, and compatibility branches are removed instead of preserved in parallel.
- [ ] The backend exposes one clean operator path for session inspection and the console consumes it without fan-out drift.
- [ ] Session detail, messages, memory, events, metrics, and context can be inspected without introducing a new read surface.
- [ ] If a new HTTP endpoint turns out to be unavoidable after the audit, it is added with the required stack-E2E coverage immediately; otherwise no new endpoint is introduced.
- [ ] Tests cover auth, validation, not-found behavior, redaction, and the final canonical inspector shapes.
- [ ] `docs/PROJECT_STATUS.md` and any impacted docs are updated to match the final implementation.
- [ ] `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass.

## Notes

This EPIC is explicitly cleanup-first. The goal is not to expand the observability surface, but to make the existing surface coherent, minimal, and easy to reason about.
