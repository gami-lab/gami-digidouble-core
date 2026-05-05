# EPIC 4.2 — Memory Layer v1: Implementation Prompt Pack

**Generated:** May 5, 2026  
**Epic scope:** Session memory exposure + user fact extraction + persistence + retrieval hooks

---

## Objective

Implement the v1 memory layer so the avatar recalls recent context and key user facts persist
across sessions.

This EPIC does **not** build pyramidal memory (EPIC 4.2b). It delivers the minimum viable
memory system: a working session summary already partially wired, LLM-based user fact extraction
at conversation close, a persistence layer for facts, and injection into avatar context.

---

## What Already Exists (Do Not Re-implement)

| Item                                              | Location                                  | Status                 |
| ------------------------------------------------- | ----------------------------------------- | ---------------------- |
| `sessions.memory_summary` DB column               | `infra/postgres/init.sql`                 | Live                   |
| `SessionMemory` + `UserFact` domain types         | `domain/memory/memory.types.ts`           | Exist                  |
| `SessionMemorySummary` shared type                | `packages/shared/src/lifecycle-types.ts`  | Exported               |
| `RuntimeContext.userFacts` placeholder            | `domain/context/context.types.ts`         | Defined                |
| `MessageHistoryCompactionService` (deterministic) | `application/services/`                   | Compacts on conv close |
| `EndConversationUseCase` compaction trigger       | `application/use-cases/end-conversation/` | Wired async            |
| `sessions.memory_summary` updates on compaction   | `ISessionRepository.SessionUpdate`        | Live                   |

---

## What This EPIC Builds

| Deliverable                                       | Description                                            |
| ------------------------------------------------- | ------------------------------------------------------ |
| `user_memory_facts` DB table                      | New migration; persistent user-scoped facts            |
| `IUserMemoryFactRepository` port                  | CRUD for user facts                                    |
| `InMemoryUserMemoryFactRepository`                | Default test implementation                            |
| `PostgresUserMemoryFactRepository`                | Production implementation                              |
| `IUserFactExtractor` port                         | LLM-based extraction abstraction                       |
| `LlmUserFactExtractor`                            | Extracts structured facts from conversation transcript |
| Fact extraction wired to `EndConversationUseCase` | Non-blocking async after compaction                    |
| `userFacts` injected into `SendMessageUseCase`    | Facts reach avatar system prompt via context           |
| `GET /v1/users/{userId}/memory-facts`             | List all persistent facts for a user                   |
| `DELETE /v1/users/{userId}/memory-facts/{factId}` | Delete one user fact                                   |
| `GET /v1/admin/sessions/{sessionId}/memory`       | Admin: session working memory + fact count             |
| Full unit + route + stack-e2e coverage            | For all new endpoints                                  |

---

## Definition of Done

- Avatar receives `userFacts` in its assembled context during `SendMessageUseCase`
- Conversation close triggers async fact extraction; extracted facts persist to `user_memory_facts`
- `GET /v1/users/{userId}/memory-facts` lists persisted facts
- `DELETE /v1/users/{userId}/memory-facts/{factId}` removes one fact (idempotent)
- `GET /v1/admin/sessions/{sessionId}/memory` returns `SessionMemorySummary` (summary + fact count)
- All new endpoints are API-key protected
- Session reset does **not** delete user facts (facts are cross-session)
- `pnpm lint`, `pnpm typecheck`, `pnpm test` pass at the end of every prompt

---

## Execution Order

| #   | File                             | Delivers                                                                                      |
| --- | -------------------------------- | --------------------------------------------------------------------------------------------- |
| 1   | `01-user-fact-persistence.md`    | DB migration, `IUserMemoryFactRepository` port, in-memory + Postgres implementations          |
| 2   | `02-fact-extraction-service.md`  | `IUserFactExtractor` port, `LlmUserFactExtractor`, async wire into `EndConversationUseCase`   |
| 3   | `03-memory-context-injection.md` | Fetch facts in `SendMessageUseCase`, inject into avatar prompt via `RuntimeContext.userFacts` |
| 4   | `04-memory-api-endpoints.md`     | User memory fact API routes + admin session memory endpoint + route tests                     |
| 5   | `05-tests-hardening-doc-sync.md` | Stack-e2e, hardening checklist, doc sync                                                      |

Execute in order. Each prompt builds on the previous.

---

## Key Constraints (Non-Negotiable)

- **No pyramidal memory** in this EPIC — that is EPIC 4.2b
- **No `session_memory` table** — working memory lives in `sessions.memory_summary` (already implemented)
- **Fact extraction is always non-blocking** — `void` fire-and-forget inside `EndConversationUseCase`
- **Facts do not block conversation close** — close-first, extract after
- **User facts are cross-session** — never deleted on session reset
- **`ApiResponse<T>` envelope** for all new REST endpoints
- **TypeScript strict mode** — no `any`, no implicit types
- **LLM provider SDKs** are never imported in domain or application layers

---

## Architecture Placement

```
domain/memory/
  memory.types.ts           ← UserFact already here (refine if needed)
application/
  ports/
    IUserMemoryFactRepository.ts   ← New port
    IUserFactExtractor.ts          ← New port (LLM boundary)
  use-cases/
    list-user-memory-facts/        ← New use case
    delete-user-memory-fact/       ← New use case
    get-session-memory/            ← New use case (admin)
infrastructure/
  db/
    in-memory-user-memory-fact.repository.ts    ← New
    repositories/
      postgres-user-memory-fact.repository.ts   ← New
  llm/
    user-fact-extractor.ts                      ← New (wraps ILlmAdapter)
api/
  routes/
    users.ts           ← Add memory-facts routes
    admin-memory.ts    ← New file: GET /v1/admin/sessions/{sessionId}/memory
```

---

## Source-of-Truth References

| Topic                                    | Document                                        |
| ---------------------------------------- | ----------------------------------------------- |
| API endpoint shapes                      | `docs/API_CONTRACT.md` §14, §15, §A5            |
| `SessionMemorySummary` type              | `docs/API_CONTRACT.md` "Session Memory Summary" |
| `UserFact` / `UserMemoryFact` data model | `docs/DATA_MODEL.md` §10                        |
| Session fields (`memory_summary`)        | `docs/DATA_MODEL.md` §4                         |
| Architecture layers                      | `docs/ARCHITECTURE.md`                          |
| Testing strategy                         | `docs/TEST_STRATEGY.md`                         |
| GM contract (context injection pattern)  | `docs/GAME_MASTER_CONTRACT.md` §4               |
