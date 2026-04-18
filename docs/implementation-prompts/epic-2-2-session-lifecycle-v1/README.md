# EPIC 2.2 — Session Lifecycle v1

## Objective

Make the platform continuously usable through real conversations.

An Avatar that can only respond to isolated exchanges has no product value. This EPIC completes
the conversational lifecycle: create a session, send messages, read history, reset.

After this EPIC, the full stack-e2e happy path for `POST /v1/conversations/:sessionId/messages`
can be exercised without any manual DB seeding.

**Generated:** April 2026  
**Depends on:** EPIC 1.1, EPIC 1.2, EPIC 2.1 (all complete)

---

## Prompt Files

| #   | File                                                                     | Description                                                      |
| --- | ------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| 01  | [01-start-session.md](./01-start-session.md)                             | `StartSessionUseCase` + `POST /v1/conversations/start` route     |
| 02  | [02-history-endpoint.md](./02-history-endpoint.md)                       | `GetHistoryUseCase` + `GET /v1/conversations/:sessionId/history` |
| 03  | [03-reset-endpoint.md](./03-reset-endpoint.md)                           | `ResetSessionUseCase` + `DELETE /v1/conversations/:sessionId`    |
| 04  | [04-complete-messages-stack-e2e.md](./04-complete-messages-stack-e2e.md) | Complete happy-path stack-e2e for messages now that start exists |
| 05  | [05-hardening-and-doc-sync.md](./05-hardening-and-doc-sync.md)           | Coverage gate, lint/typecheck, final doc sync                    |

---

## Execution Order

Run in strict sequence. Each prompt builds on the previous output.

```
01 → 02 → 03 → 04 → 05
```

**01** must come first — routes 02 and 03 register in the same Fastify plugin as 01.  
**02** and **03** depend on 01 (shared route file, shared use-case factory pattern).  
**04** depends on 01 being done — completing the messages happy-path stack-e2e requires a working start endpoint.  
**05** is always last — coverage and doc sync run over the completed implementation.

---

## Dependencies Between Prompts

```
01 (StartSessionUseCase + POST /v1/conversations/start)
  └─▶ 02 (GetHistoryUseCase + GET /v1/conversations/:sessionId/history)
        └─▶ 03 (ResetSessionUseCase + DELETE /v1/conversations/:sessionId)
              ├─▶ 04 (complete messages.stack-e2e.test.ts happy path)
              └─▶ 05 (hardening + doc sync)
```

---

## What Is Already Built (Do Not Rebuild)

| Module                                       | Status | Notes                                                   |
| -------------------------------------------- | ------ | ------------------------------------------------------- |
| `Session` + `Message` types                  | ✅     | `domain/conversation/session.types.ts`                  |
| `ISessionRepository` port                    | ✅     | `create`, `findById`, `update`, `delete` all defined    |
| `IMessageRepository` port                    | ✅     | `findBySessionId`, `save` — `deleteBySessionId` missing |
| `InMemorySessionRepository`                  | ✅     | Full CRUD, constructable with initial data              |
| `InMemoryMessageRepository`                  | ✅     | `findBySessionId` + `save` — delete not yet implemented |
| `DomainError`                                | ✅     | `domain/errors.ts`                                      |
| `SendMessageUseCase`                         | ✅     | Full use case — session validation, message persistence |
| `POST /v1/conversations/:sessionId/messages` | ✅     | Route, tests, e2e — complete                            |

## What Needs to Be Built

| Module                                        | Notes                                           |
| --------------------------------------------- | ----------------------------------------------- |
| `StartSessionUseCase`                         | New use case                                    |
| `GetHistoryUseCase`                           | New use case                                    |
| `ResetSessionUseCase`                         | New use case                                    |
| `IMessageRepository.deleteBySessionId`        | New method on existing port                     |
| `InMemoryMessageRepository.deleteBySessionId` | Implement new port method                       |
| `api/routes/conversations.ts`                 | New route file: start, history, reset endpoints |
| `conversations.stack-e2e.test.ts`             | Stack-e2e for new endpoints                     |
| `messages.stack-e2e.test.ts` happy path       | Complete the deferred 200 test now start exists |
| Update TODO comment in send-message use case  | `TODO(EPIC-2.2)` → `TODO(EPIC-4.1)` (GM is 4.1) |

---

## Definition of Done

- [ ] `POST /v1/conversations/start` creates and returns a session
- [ ] `GET /v1/conversations/:sessionId/history` returns all messages in chronological order
- [ ] `DELETE /v1/conversations/:sessionId` deletes all messages; keeps session record; returns deletion counts
- [ ] All three endpoints enforce API-key auth
- [ ] All three endpoints return correct `ApiResponse<T>` envelope on success and error
- [ ] `conversations.stack-e2e.test.ts` covers auth, validation, and 404 for all new endpoints; happy-path for start (200) is fully implemented
- [ ] `messages.stack-e2e.test.ts` happy-path test is implemented and no longer deferred
- [ ] Unit tests for all new use cases pass
- [ ] API tests (`inject()`) for all new routes pass
- [ ] `TODO(EPIC-2.2)` comment in `send-message.use-case.ts` updated to `TODO(EPIC-4.1)`
- [ ] Coverage gate (≥80%) remains green
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:coverage` all pass
- [ ] `docs/PROJECT_STATUS.md` updated
- [ ] `docs/API_CONTRACT.md` sections 1, 4, 6 verified accurate against implementation
