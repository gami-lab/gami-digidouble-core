# EPIC 2.2 — Async Game Master v1

## Objective

Validate the Director–Actor model by implementing a Game Master that observes
conversations in the background and injects lightweight guidance into future
Avatar turns — without ever blocking the Avatar's response path.

**Generated:** April 2026  
**Depends on:** EPIC 2.1 (Avatar Agent v1 — complete)

---

## Prompt Files

| #   | File                                                     | Description                                                                                         |
| --- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 01  | [01-gm-domain-state.md](./01-gm-domain-state.md)         | Enrich GM domain types, state reducer, trigger conditions, event types — pure domain logic          |
| 02  | [02-gm-llm-service.md](./02-gm-llm-service.md)           | `GameMasterService` — structured LLM call that turns a `GameMasterInput` into a `GameMasterOutput`  |
| 03  | [03-gm-state-repository.md](./03-gm-state-repository.md) | `IGmStateRepository` port + in-memory implementation; GM state persistence contract                 |
| 04  | [04-trigger-gm-use-case.md](./04-trigger-gm-use-case.md) | `TriggerGmObservationUseCase` + async wiring inside `SendMessageUseCase` (replace `TODO(EPIC-2.2)`) |
| 05  | [05-tests-and-hardening.md](./05-tests-and-hardening.md) | Unit + API tests, coverage gate, lint/typecheck                                                     |
| 06  | [06-doc-sync.md](./06-doc-sync.md)                       | Final documentation synchronization and EPIC closure                                                |

---

## Execution Order

Run in strict sequence. Each prompt builds on the previous output.

```
01 → 02 → 03 → 04 → 05 → 06
```

**01** must be first — every subsequent prompt depends on the enriched types and
trigger logic it defines.  
**02** depends on the types from 01.  
**03** depends on `GameMasterState` from 01.  
**04** depends on 01 + 02 + 03 — assembles everything into the async flow.  
**05** can start once 04 is done.  
**06** is always last.

---

## Dependencies Between Prompts

```
01 (GM domain types, state reducer, trigger conditions, EventLog event types)
  └─▶ 02 (GameMasterService — LLM call for GM decision)
  └─▶ 03 (IGmStateRepository port + in-memory impl)
        └─▶ 04 (TriggerGmObservationUseCase + SendMessageUseCase wiring)
              └─▶ 05 (tests + hardening + coverage gate)
                    └─▶ 06 (doc sync)
```

---

## Definition of Done

- [ ] `GameMasterState` state reducer is pure, deterministic, and unit-tested
- [ ] Trigger conditions (turn threshold, topic repeat, progression stalled) are implemented as pure predicate functions and unit-tested
- [ ] `GameMasterService` turns a `GameMasterInput` into a validated `GameMasterOutput` via the `ILlmAdapter` port — no direct SDK calls
- [ ] `IGmStateRepository` port is defined; in-memory implementation exists and is tested
- [ ] `TriggerGmObservationUseCase` loads GM state, calls `GameMasterService`, applies the state reducer, persists the new state, and emits a `GameMasterEvent` to the `IObservabilityAdapter`
- [ ] `TriggerGmObservationUseCase` is called non-blocking from `SendMessageUseCase` after the avatar message is persisted (replaces `TODO(EPIC-2.2)`)
- [ ] GM directive (`context.notes`) is stored on GM state for the Avatar to read on the next turn
- [ ] Avatar picks up any pending GM directive when assembling its system prompt (injected after persona sections)
- [ ] GM failures never surface to the user — errors are caught and logged
- [ ] `GameMasterEvent` (type `gm_triggered` or `gm_skipped`) is emitted for every GM run with the required fields from `GAME_MASTER_CONTRACT.md`
- [ ] Unit tests cover: state reducer, trigger predicates, use case orchestration, directive injection into persona prompt
- [ ] API tests verify: GM trigger fires after Avatar responds (observability called), GM failure does not affect HTTP response
- [ ] Coverage gate (≥80%) remains green
- [ ] All quality gates pass: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:coverage`
- [ ] `docs/PROJECT_STATUS.md` updated
- [ ] All impacted docs synchronized
