# EPIC 2.2b — Conversation Lifecycle v2 (End Signal + Compaction Trigger)

## Objective

Introduce explicit and implicit conversation ending behavior, trigger memory compaction at conversation closure, and ensure new conversations use compacted memory context instead of replaying full historical transcripts.

## Generated

2026-05-03

## Ordered Execution List

1. `01-lifecycle-contract-baseline.md`
2. `02-explicit-conversation-endpoint.md`
3. `03-compaction-trigger-and-session-memory.md`
4. `04-implicit-end-detection.md`
5. `05-hardening-stack-e2e-and-doc-sync.md`

## Dependencies Between Prompts

- `01` must run first to lock canonical contract ownership and avoid field/type drift before feature changes.
- `02` depends on `01` because endpoint request/response shapes must use canonical contracts.
- `03` depends on `02` because compaction is triggered by explicit conversation end flow.
- `04` depends on `03` because implicit end logic must reuse the same close + compaction pipeline.
- `05` depends on all previous prompts and is the final convergence pass for tests, reliability, and documentation sync.

## Suggested Execution Order

`01 -> 02 -> 03 -> 04 -> 05`

## Definition of Done (Full EPIC)

- [ ] Conversation can be explicitly closed via API with clear end reason semantics.
- [ ] Conversation end updates conversation state (`status`, `endedAt`, `reason`) and session runtime state consistently.
- [ ] Memory compaction is triggered on conversation close and persisted in `Session.memorySummary` (or equivalent canonical field).
- [ ] Starting a new conversation uses compacted summary/context and does not require full transcript replay.
- [ ] Implicit end detection path (heuristic-driven) closes conversations through the same canonical close pipeline.
- [ ] No contract duplication is introduced across `core`, `shared`, and `console` for conversation/session DTOs.
- [ ] New/updated endpoint behavior has unit + integration + stack-e2e coverage.
- [ ] All impacted docs are updated and accurate.
- [ ] Build gates pass: `pnpm lint`, `pnpm typecheck`, `pnpm test`.

## Notes

- This EPIC touches existing entities (`Session`, `Conversation`, message lifecycle, API response DTOs). Keep contracts centralized and reuse existing shared types whenever possible.
- If structural duplication is discovered during `01`, resolve it before continuing to feature prompts.
