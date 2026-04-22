# EPIC 4.1 — Async Game Master v1

## Objective

Implement the Director/Actor model: a Game Master that runs **asynchronously after every Avatar turn**, observes the conversation, maintains a small state object, and injects guidance notes into the Avatar's next context when triggers fire.

The Avatar always answers directly. The GM never blocks a response. By the end of this EPIC, GM state is persisted per-session, triggers fire deterministically from policy rules, and every GM run emits a structured diagnostic event.

## Generated

April 22, 2026

---

## Prompt Files

| #   | File                                                                   | What It Delivers                                                                                     |
| --- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 01  | [01-gm-state-persistence.md](01-gm-state-persistence.md)               | `gm_states` DB table, `IGmStateRepository` port, Postgres + in-memory implementations                |
| 02  | [02-trigger-engine.md](02-trigger-engine.md)                           | Deterministic trigger evaluation — pure domain logic, no LLM                                         |
| 03  | [03-gm-use-case-and-wiring.md](03-gm-use-case-and-wiring.md)           | `RunGameMasterUseCase`, LLM reasoning path, state reducer, async injection into `SendMessageUseCase` |
| 04  | [04-event-log-and-observability.md](04-event-log-and-observability.md) | `event_log` table, `IEventLogRepository`, `GameMasterEvent` emission per GM run                      |
| 05  | [05-tests-and-hardening.md](05-tests-and-hardening.md)                 | Full unit test coverage — triggers, reducer, use case, event emission                                |
| 06  | [06-doc-sync.md](06-doc-sync.md)                                       | GAME_MASTER_CONTRACT, DATA_MODEL, API_CONTRACT, PROJECT_STATUS sync                                  |

---

## Execution Order

```
01 → 02 → 03 → 04 → 05 → 06
```

- **01** before everything: state persistence underpins prompts 02, 03, and 04
- **02** before **03**: the use case calls the trigger engine
- **03** after **01** and **02**: wires state + triggers together
- **04** after **03**: event emission happens inside the use case
- **05** after **04**: tests cover the full assembled system
- **06** always last

---

## System Constraints

- The GM **never blocks** the Avatar response — it is always fired with `void` after the Avatar message is persisted
- The `SendMessageUseCase` `// TODO(EPIC-4.1): trigger GM observation` comment marks the exact injection point
- Domain types in `apps/core/src/domain/game-master/game-master.types.ts` already exist — extend them, do not replace them
- `Session` does not yet carry `activeAvatarId` — prompt 01 adds it to the DB and type

---

## Dependencies

- EPIC 2.3 (persistence layer) — `PostgresSessionRepository`, DB client, test helpers
- EPIC 2.1 `SendMessageUseCase` — contains the TODO injection point
- `docs/GAME_MASTER_CONTRACT.md` — the definitive specification for GM types, state, triggers, and diagnostic events

---

## Definition of Done

- [ ] `gm_states` table exists in `infra/postgres/init.sql` and `test-helpers.ts` `TRUNCATE` list
- [ ] `Session.activeAvatarId` field added to type and DB
- [ ] Trigger engine evaluates `turn_threshold`, `topic_repeat`, and `progression_stalled` deterministically from `GameMasterState`
- [ ] `RunGameMasterUseCase` fires after every Avatar message (non-blocking) and:
  - runs the trigger engine
  - if a trigger fires: calls the LLM for GM reasoning, updates state, stores guidance notes on the session
  - if no trigger: increments `interactionCount`, persists state, emits `gm_skipped` event
- [ ] GM guidance notes are injected into the Avatar's system prompt on the next turn
- [ ] Every GM run emits a `GameMasterEvent` to the `event_log` table
- [ ] Unit tests cover trigger logic (all paths), state reducer, use case (trigger/no-trigger/LLM-error), and event emission
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` all pass
- [ ] `docs/GAME_MASTER_CONTRACT.md` reflects the implemented trigger rules
- [ ] `docs/DATA_MODEL.md` updated with `gm_states` and `event_log` tables
- [ ] `docs/PROJECT_STATUS.md` updated
