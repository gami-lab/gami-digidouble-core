# EPIC 4.2c — Memory System v3 (Working + Episodic Memory): Implementation Prompt Pack

**Generated:** May 8, 2026

## Objective

Implement the target memory behavior defined in `docs/MEMORY_SYSTEM_SPEC.md` with bounded short-term memory, rewritten conversation working memory, durable episodic memory, conversation hydration, GM memory usage, and inspectable memory decisions.

This EPIC replaces partial memory behavior from v2 while preserving modular boundaries and avoiding contract drift.

## Prompt Files — Ordered Execution List

| #   | File                                              | Description                                                                                    | Depends On |
| --- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------- |
| 0   | `00-contract-cleanup.md`                          | Remove memory contract drift and define canonical type ownership before feature work           | —          |
| 1   | `01-conversation-working-memory-lifecycle.md`     | Implement conversation-scoped working-memory lifecycle and refresh policy                      | 0          |
| 2   | `02-episodic-memory-persistence-and-hydration.md` | Add episodic-memory persistence and hydration on conversation start                            | 0,1        |
| 3   | `03-memory-selection-and-gm-integration.md`       | Add selection policy and inject episodic memory into GM + avatar context assembly              | 0,1,2      |
| 4   | `04-memory-observability-and-debug-surface.md`    | Expose memory/hydration selection observability through admin debug APIs and console consumers | 0,1,2,3    |
| 5   | `05-hardening-tests-and-doc-sync.md`              | End-to-end hardening, regressions, and full documentation sync                                 | 0-4        |

## Dependencies Between Prompts

- Prompt `00` is mandatory. No implementation starts before canonical contract ownership is clean.
- Prompt `01` establishes working-memory behavior required by episodic generation in `02`.
- Prompt `02` creates persisted episodic data required by selection/injection in `03`.
- Prompt `03` must land before `04` so observability reflects real runtime behavior.
- Prompt `05` closes the EPIC and is required for honest completion.

## Suggested Execution Order

`00 -> 01 -> 02 -> 03 -> 04 -> 05`

## Definition of Done (Full EPIC)

- [ ] Short-term memory is bounded and deterministic (no transcript replay dependency).
- [ ] Working memory is conversation-scoped, rewritten periodically, and refreshed at close/switch/admin trigger.
- [ ] Every closed conversation produces one durable episodic memory entry.
- [ ] New conversations hydrate from relevant episodic memories for user+avatar+scenario scope.
- [ ] Avatar and GM both consume the same canonical layered memory selection outputs.
- [ ] Memory and hydration decisions are observable through admin/debug surfaces.
- [ ] Memory refresh failures are isolated and do not block avatar response flow.
- [ ] Contract ownership remains canonical (no duplicated memory DTO shapes across layers).
- [ ] Any new endpoint introduced includes `*.stack-e2e.test.ts` coverage (auth, validation, not-found).
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm test:coverage` pass.
- [ ] Documentation is updated and accurate, including `docs/PROJECT_STATUS.md`.
