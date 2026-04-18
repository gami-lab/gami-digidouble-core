# EPIC 2.2 — Scenario & Session Lifecycle v1

**Generated:** 2026-04-18  
**EPIC reference:** `docs/EPICS.md` — Sprint 2

---

## Objective

Allow an operator to create a Scenario and Avatar via API, then let a user start a session,
converse across turns, read history, and reset the session.

This EPIC delivers the first fully testable end-to-end conversation lifecycle from content
configuration through runtime use.

It also unblocks the `messages.stack-e2e.test.ts` happy path, which has been deferred since
EPIC 2.1 due to the absence of an avatar creation API.

---

## What Is Already Built

| Asset                                                               | Location                                                        |
| ------------------------------------------------------------------- | --------------------------------------------------------------- |
| `Scenario` domain type                                              | `domain/scenario/scenario.types.ts`                             |
| `Avatar` + `AvatarConfig` types                                     | `domain/avatar/avatar.types.ts`                                 |
| `Session`, `Message` types                                          | `domain/conversation/session.types.ts`                          |
| `IAvatarRepository` (read-only `findById`)                          | `application/ports/IAvatarRepository.ts`                        |
| `ISessionRepository` (full CRUD)                                    | `application/ports/ISessionRepository.ts`                       |
| `IMessageRepository` (`findBySessionId`, `save`)                    | `application/ports/IMessageRepository.ts`                       |
| `InMemoryAvatarRepository` (read-only)                              | `infrastructure/db/in-memory-avatar.repository.ts`              |
| `InMemorySessionRepository` (full CRUD)                             | `infrastructure/db/in-memory-session.repository.ts`             |
| `InMemoryMessageRepository` (find + save)                           | `infrastructure/db/in-memory-message.repository.ts`             |
| `SendMessageUseCase` + `POST /v1/conversations/:sessionId/messages` | `application/use-cases/send-message/`, `api/routes/messages.ts` |
| Stack-e2e (auth/validation/404 only)                                | `api/routes/messages.stack-e2e.test.ts`                         |
| `DomainError`                                                       | `domain/errors.ts`                                              |
| `ServerAdapters` type (avatar, session, message repos)              | `api/server.ts`                                                 |

---

## What Needs to Be Built

| Asset                                                                | Prompt |
| -------------------------------------------------------------------- | ------ |
| `IScenarioRepository` port (`create`, `findById`)                    | 01     |
| `InMemoryScenarioRepository`                                         | 01     |
| `CreateScenarioUseCase`                                              | 01     |
| `POST /v1/scenarios` route + plugin                                  | 01     |
| `scenarios.stack-e2e.test.ts` (auth + validation + 200 happy path)   | 01     |
| `IAvatarRepository.create(...)`                                      | 02     |
| `InMemoryAvatarRepository.create(...)`                               | 02     |
| `CreateAvatarUseCase` (validates scenario exists)                    | 02     |
| `POST /v1/scenarios/:scenarioId/avatars` route                       | 02     |
| API_CONTRACT.md avatar endpoint definition                           | 02     |
| `avatars.stack-e2e.test.ts` (auth + validation + 404 + 200)          | 02     |
| `IMessageRepository.deleteBySessionId(...)`                          | 03     |
| `InMemoryMessageRepository.deleteBySessionId(...)`                   | 03     |
| `StartSessionUseCase`                                                | 03     |
| `GetHistoryUseCase`                                                  | 03     |
| `ResetSessionUseCase`                                                | 03     |
| `api/routes/conversations.ts` plugin (start, history, reset)         | 03     |
| `conversations.stack-e2e.test.ts` (full lifecycle happy path)        | 03     |
| `messages.stack-e2e.test.ts` happy-path completion                   | 04     |
| Coverage gate + test gap fill                                        | 05     |
| API_CONTRACT.md sync (avatar endpoint, session start simplification) | 05     |
| DATA_MODEL.md + PROJECT_STATUS.md sync                               | 05     |

---

## Execution Order

```
01 → 02 → 03 → 04 → 05
```

Each prompt depends on the previous being complete. Do not start 02 before schema/ports from
01 are in place.

---

## Dependencies Between Prompts

| Prompt                           | Depends On                                                                         |
| -------------------------------- | ---------------------------------------------------------------------------------- |
| 01 — Scenario domain + endpoint  | Nothing new (Scenario type already exists)                                         |
| 02 — Avatar creation endpoint    | 01 (IScenarioRepository + InMemoryScenarioRepository for scenario existence check) |
| 03 — Session lifecycle endpoints | 02 (avatarRepository must now support create for stack-e2e happy path)             |
| 04 — Unblock messages stack-e2e  | 03 (conversations start endpoint available)                                        |
| 05 — Hardening + doc sync        | 04 (all endpoints and tests in place)                                              |

---

## Definition of Done

- [ ] `POST /v1/scenarios` creates a scenario and returns it
- [ ] `POST /v1/scenarios/:scenarioId/avatars` creates an avatar scoped to a scenario
- [ ] `POST /v1/conversations/start` creates a session with a valid scenarioId
- [ ] `GET /v1/conversations/:sessionId/history` returns session + ordered messages
- [ ] `DELETE /v1/conversations/:sessionId` resets messages and returns count
- [ ] `messages.stack-e2e.test.ts` happy-path covers the full lifecycle
- [ ] `scenarios.stack-e2e.test.ts` covers auth, validation, and 200 create
- [ ] `avatars.stack-e2e.test.ts` covers auth, validation, 404 scenario, and 200 create
- [ ] `conversations.stack-e2e.test.ts` covers lifecycle: start → history → reset
- [ ] `IAvatarRepository` updated: `create` method added
- [ ] `IMessageRepository` updated: `deleteBySessionId` method added
- [ ] `IScenarioRepository` port created
- [ ] `InMemoryScenarioRepository` created
- [ ] `scenarioRepository` added to `ServerAdapters` in `server.ts`
- [ ] `TODO(EPIC-2.2)` in `send-message.use-case.ts` updated to `TODO(EPIC-4.1)`
- [ ] `TODO(EPIC-2.2)` in `API_CONTRACT.md` updated to `TODO(EPIC-4.1)`
- [ ] Coverage gate (≥80%) still passes
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` all pass
- [ ] `docs/API_CONTRACT.md`, `docs/DATA_MODEL.md`, `docs/PROJECT_STATUS.md` all synced

---

## Note: Superseded Folder

The folder `docs/implementation-prompts/epic-2-2-async-game-master-v1/` (if it exists) was
generated for an earlier EPICS.md numbering where Game Master was EPIC 2.2. Game Master is
now **EPIC 4.1** per the current roadmap. Those prompts remain valid for their intended
content but the folder name is stale.
