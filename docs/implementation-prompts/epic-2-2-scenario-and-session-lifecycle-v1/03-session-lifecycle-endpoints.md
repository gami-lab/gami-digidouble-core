# 03 — Session Lifecycle Endpoints

## Context

With Scenario and Avatar creation in place (Prompts 01 + 02), the platform now has the content
objects that sessions reference. This prompt implements the session lifecycle:

- **Start Session** — create a new conversation instance
- **Get History** — read all messages for a session
- **Reset Session** — delete runtime conversation data (messages) without deleting the session record

These three endpoints form the backbone of the conversational runtime. They complete the
feedback loop: create → converse → inspect → reset → converse again.

This prompt also extends `IMessageRepository` with the `deleteBySessionId` method needed for reset.

---

## Scope

**In scope:**

- `IMessageRepository.deleteBySessionId(sessionId): Promise<number>` — returns count deleted
- `InMemoryMessageRepository.deleteBySessionId()` — mutate internal array in-place
- `StartSessionUseCase` — validates non-empty `userId` + `scenarioId`, creates session
- `GetHistoryUseCase` — loads session + messages, returns both
- `ResetSessionUseCase` — deletes messages, does NOT delete session record
- `api/routes/conversations.ts` Fastify plugin — three routes: start, history, reset
- `conversationsRoute` registered in `createServer()` under `/v1/conversations`
- `conversations.test.ts` — inject() unit tests for all three routes
- `conversations.stack-e2e.test.ts` — full lifecycle happy path using only HTTP calls

**Out of scope:**

- Nested `user` object or `initialContext` in start session request (simplified for Sprint 2)
- Session status transition enforcement (start requires scenario to exist) — deferred to when
  PostgreSQL repositories validate foreign keys
- `GET /v1/conversations/:sessionId/state` (debug endpoint) — deferred to EPIC 3.2
- Session memory in history response — deferred to EPIC 4.2
- `events` count in reset response — hardcoded to `0` with `// TODO(EPIC-3.3)`
- `sessionMemory` in reset response — hardcoded to `false` with `// TODO(EPIC-4.2)`
- PostgreSQL repositories — in-memory only for Sprint 2

---

## Relevant Docs

- `docs/API_CONTRACT.md` §1 — Start Session request/response shape
- `docs/API_CONTRACT.md` §4 — History response shape
- `docs/API_CONTRACT.md` §6 — Reset Session response shape
- `docs/DATA_MODEL.md` §4 — Session entity fields
- `docs/DATA_MODEL.md` §5 — Message entity fields
- `apps/core/src/application/ports/IMessageRepository.ts` — current port (missing `deleteBySessionId`)
- `apps/core/src/infrastructure/db/in-memory-message.repository.ts` — internal `messages` field is mutable
- `apps/core/src/application/ports/ISessionRepository.ts` — `create`, `findById` already defined
- `apps/core/src/api/routes/messages.ts` — Fastify plugin pattern to follow
- `apps/core/src/domain/errors.ts` — `DomainError` for not-found and invalid-state

---

## Implementation Guidance

### 1. Extend IMessageRepository

Add to `application/ports/IMessageRepository.ts`:

```
deleteBySessionId(sessionId: string): Promise<number>
```

Returns the number of messages deleted.

### 2. Extend InMemoryMessageRepository

Add `deleteBySessionId(sessionId: string): Promise<number>` to
`infrastructure/db/in-memory-message.repository.ts`.

The internal `messages` array is `readonly Message[]` by type annotation but was initialized
with a mutable copy in the constructor (via spread `[...initialData]`). Mutation via
`Array.prototype.splice` is valid — do not reassign the reference.

Implementation:

1. Collect indices of messages matching `sessionId`
2. Splice them out (iterate in reverse to avoid index shifting)
3. Return the count

### 3. StartSessionUseCase

Create `application/use-cases/start-session/start-session.types.ts` and
`application/use-cases/start-session/start-session.use-case.ts`.

Constructor: takes `ISessionRepository`.

Input DTO:

```
userId: string      — required, non-empty
scenarioId: string  — required, non-empty
```

Note: The `API_CONTRACT.md` §1 specifies a complex nested `user` object and `initialContext`.
For Sprint 2, use the simplified `{ userId, scenarioId }` shape. Document this simplification
with a `// TODO(EPIC-X): expand to full StartSessionRequest shape (nested user, initialContext)`
comment in the use case or the route file.

Validation:

- Blank `userId` or `scenarioId` → `DomainError('VALIDATION_ERROR', '...')`

Behavior:

- Call `ISessionRepository.create({ userId, scenarioId })`
- Return `SessionSummary` (shape matching API_CONTRACT §1 response)

Output DTO: `{ session: SessionSummary }`.

`SessionSummary` fields: `sessionId`, `userId`, `scenarioId`, `status`, `startedAt`, `lastActivityAt`, `endedAt`.

### 4. GetHistoryUseCase

Create `application/use-cases/get-history/get-history.types.ts` and
`application/use-cases/get-history/get-history.use-case.ts`.

Constructor: takes `ISessionRepository` and `IMessageRepository`.

Input DTO: `{ sessionId: string }`.

Behavior:

- Call `ISessionRepository.findById(sessionId)` → if `null` → `DomainError('NOT_FOUND', '...')`
- Call `IMessageRepository.findBySessionId(sessionId)` (no limit; return all)
- Return `{ session: SessionSummary, messages: Message[] }`

No status filtering — history is readable for `active`, `closed`, and `archived` sessions.

`memory` field from API_CONTRACT §4: omit for now with no comment needed (field is optional in
the contract; include `// TODO(EPIC-4.2): include session memory summary` in the use case).

### 5. ResetSessionUseCase

Create `application/use-cases/reset-session/reset-session.types.ts` and
`application/use-cases/reset-session/reset-session.use-case.ts`.

Constructor: takes `ISessionRepository` and `IMessageRepository`.

Input DTO: `{ sessionId: string }`.

Behavior:

- Call `ISessionRepository.findById(sessionId)` → if `null` → `DomainError('NOT_FOUND', '...')`
- Call `IMessageRepository.deleteBySessionId(sessionId)` → capture count
- Do NOT delete the session record itself
- Return `ResetSessionOutput`

Output DTO:

```
{
  sessionId: string
  deleted: {
    messages: number        // actual count from deleteBySessionId
    sessionMemory: false    // TODO(EPIC-4.2): delete session memory when implemented
    events: 0               // TODO(EPIC-3.3): delete events when implemented
  }
}
```

Use literal `false` and `0` — do not make these configurable.

### 6. conversationsRoute Fastify Plugin

Create `api/routes/conversations.ts`.

Three routes under the plugin:

**POST /start**

- Body schema: `userId` (string, minLength 1), `scenarioId` (string, minLength 1)
- Wire `StartSessionUseCase`
- Error mapping: `DomainError VALIDATION_ERROR` → `400`, unknown → `500`
- Success → `201` with `ApiResponse<StartSessionResponse>`

**GET /:sessionId/history**

- No body (GET)
- Wire `GetHistoryUseCase`
- Error mapping: `DomainError NOT_FOUND` → `404`, unknown → `500`
- Success → `200` with `ApiResponse<GetHistoryResponse>`

**DELETE /:sessionId**

- No body (DELETE)
- Wire `ResetSessionUseCase`
- Error mapping: `DomainError NOT_FOUND` → `404`, unknown → `500`
- Success → `200` with `ApiResponse<ResetSessionResponse>`

All three routes share the `authenticateApiKey` pre-handler registered on the plugin root
(add with `app.addHook('preHandler', authenticateApiKey(config))` at plugin level).

Plugin options type mirrors `MessagesRouteOptions`: accepts `config`, `sessionRepository?`,
`messageRepository?`. Defaults to `new InMemorySessionRepository()` and
`new InMemoryMessageRepository()` if not provided.

### 7. server.ts Registration

Register `conversationsRoute` under prefix `/v1/conversations` alongside the existing
`messagesRoute`.

Both share the `/v1/conversations` prefix but mount different sub-paths:

- `conversationsRoute` handles `/start`, `/:sessionId/history`, `DELETE /:sessionId`
- `messagesRoute` handles `/:sessionId/messages`

Ensure both are registered separately — Fastify handles route merging under the same prefix
cleanly when registered as separate plugins.

### 8. conversations.test.ts

Create `api/routes/conversations.test.ts` using `createServer()` + `app.inject()`.

One describe block per route:

**POST /v1/conversations/start:**

- Auth guard (no key → 401, wrong key → 401)
- Validation (blank userId → 400, blank scenarioId → 400)
- Success (valid body → 201, session returned)

**GET /v1/conversations/:sessionId/history:**

- Auth guard
- Not found (unknown sessionId → 404)
- Success (seed session in InMemorySessionRepository → history returns session + empty messages)

**DELETE /v1/conversations/:sessionId:**

- Auth guard
- Not found (unknown sessionId → 404)
- Success (seed session → reset → deleted.messages === 0)

### 9. conversations.stack-e2e.test.ts

Create `api/routes/conversations.stack-e2e.test.ts`.

This test can include **full happy-path tests** because the start endpoint creates its own session,
and history/reset operate on that session without requiring LLM calls.

**Always-on describe blocks:**

- Auth (no key / wrong key → 401 on POST /start)
- Validation (blank userId → 400, blank scenarioId → 400)
- Not found (unknown sessionId → 404 on GET /history and DELETE /:sessionId)

**Happy-path describe block:**
Run as a sequential lifecycle in one `it` or a sequence of `it` blocks within a describe:

1. `POST /v1/conversations/start` with valid `{ userId, scenarioId }` → 201, capture `sessionId`
2. `GET /v1/conversations/:sessionId/history` → 200, `data.messages === []`, session matches
3. `DELETE /v1/conversations/:sessionId` → 200, `data.deleted.messages === 0`
4. `GET /v1/conversations/:sessionId/history` after reset → still 200 (session record preserved)

Use a realistic but fake `scenarioId` value (e.g., `"scenario_test_default"`) — the in-memory
repo does not enforce foreign key constraints, so this works in the stack test.

---

## Constraints

- `GetHistoryUseCase` and `ResetSessionUseCase` may share `ISessionRepository` — no duplicate ports
- `deleteBySessionId` must return a count, not void — the reset use case uses it for the response
- `SessionSummary` shape in DTOs must match `API_CONTRACT.md` §1 response exactly
- InMemoryMessageRepository internal `messages` is `readonly Message[]` — use splice, not reassignment
- Route-level: `scenarioId` validation at body level only (no DB check for foreign key in Sprint 2)
- Stack-e2e: use only real HTTP calls via `fetch()`

---

## Deliverables

- `application/ports/IMessageRepository.ts` updated (`deleteBySessionId` added)
- `infrastructure/db/in-memory-message.repository.ts` updated (`deleteBySessionId` implemented)
- `application/use-cases/start-session/start-session.types.ts`
- `application/use-cases/start-session/start-session.use-case.ts`
- `application/use-cases/get-history/get-history.types.ts`
- `application/use-cases/get-history/get-history.use-case.ts`
- `application/use-cases/reset-session/reset-session.types.ts`
- `application/use-cases/reset-session/reset-session.use-case.ts`
- `api/routes/conversations.ts`
- `api/routes/conversations.test.ts`
- `api/routes/conversations.stack-e2e.test.ts`
- `api/server.ts` updated (register `conversationsRoute`)

---

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md` — note all three session lifecycle endpoints implemented
- `docs/API_CONTRACT.md` §1 — add note: "Sprint 2 simplification: `userId` and `scenarioId`
  are flat fields; nested `user` object and `initialContext` deferred to a later EPIC"
- `docs/API_CONTRACT.md` §4 — add note: "`memory` field is absent in Sprint 2; deferred to EPIC 4.2"
- `docs/API_CONTRACT.md` §6 — add note: "`sessionMemory` hardcoded to `false` (EPIC 4.2);
  `events` hardcoded to `0` (EPIC 3.3)"

If no doc changes are needed, explicitly verify docs are still accurate.

---

## Acceptance Criteria

- [ ] `IMessageRepository.deleteBySessionId(sessionId): Promise<number>` exists and is typed
- [ ] `InMemoryMessageRepository.deleteBySessionId()` splices correctly and returns count
- [ ] `StartSessionUseCase` validates userId + scenarioId; creates and returns session
- [ ] `GetHistoryUseCase` returns 404 for unknown session; returns session + messages otherwise
- [ ] `ResetSessionUseCase` returns 404 for unknown session; deletes messages; does not delete session
- [ ] `POST /v1/conversations/start` returns 201 with session summary
- [ ] `GET /v1/conversations/:sessionId/history` returns 200 with session + messages
- [ ] `DELETE /v1/conversations/:sessionId` returns 200 with deleted counts
- [ ] All three routes return 401 without valid API key
- [ ] `conversations.test.ts` inject tests cover auth, validation, not-found, and success
- [ ] `conversations.stack-e2e.test.ts` runs the full start → history → reset lifecycle
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` all pass
