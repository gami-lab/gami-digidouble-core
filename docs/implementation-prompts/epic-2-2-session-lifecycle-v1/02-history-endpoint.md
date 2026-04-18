# 02 — GetHistoryUseCase + GET /v1/conversations/:sessionId/history

## Context

After a session exists and messages have been exchanged, callers need to read back the
conversation. This endpoint serves back-office UIs, the manual test console (EPIC 2.3), and
export flows. It is also the mechanism that validates message persistence is working correctly
across turns — which is a key DoD item for EPIC 2.2.

---

## Scope

**In scope:**

- `GetHistoryUseCase` in `application/use-cases/get-history/`
- `GET /v1/conversations/:sessionId/history` route added to `api/routes/conversations.ts`
- Unit tests for the use case
- API tests (`inject()`) for the route
- Stack-e2e test cases for this endpoint added to `conversations.stack-e2e.test.ts`

**Out of scope:**

- Pagination (deferred; full history works for MVP session sizes)
- `memory` field in the response (EPIC 4.2 — Memory Layer)
- Filtering messages by role or date range (not needed in Phase A)

---

## Relevant Docs

- `docs/API_CONTRACT.md` — §4 Get Conversation History (endpoint shape, response type)
- `docs/DATA_MODEL.md` — §5 Message entity
- `docs/TEST_STRATEGY.md` — Rule 6: stack-e2e additions for existing-endpoint changes
- `apps/core/src/application/ports/IMessageRepository.ts` — `findBySessionId` signature

---

## Implementation Guidance

### `GetHistoryUseCase`

**Types (`get-history.types.ts`):**

```ts
export interface GetHistoryInput {
  sessionId: string
}

export interface GetHistoryOutput {
  session: SessionSummary
  messages: Message[]
}
```

**Use case (`get-history.use-case.ts`):**

Constructor dependencies: `ISessionRepository`, `IMessageRepository`

`execute(input)`:

1. Load session via `sessionRepository.findById(input.sessionId)`
2. If `null` → throw `DomainError('SESSION_NOT_FOUND', 'Session not found')`
3. Load messages via `messageRepository.findBySessionId(input.sessionId)` (no limit — full history)
4. Map `Session` to `SessionSummary`
5. Return `{ session, messages }`

Messages come back sorted chronologically — the repository already guarantees this order.

No status check is needed here: history is readable regardless of session status (active, closed,
archived). A caller may want to read history after a session is closed.

### Route addition to `api/routes/conversations.ts`

Add `GET '/:sessionId/history'` to the existing `conversationsRoute` plugin from Prompt 01.

- Auth: `authenticateApiKey` preHandler
- Params schema: `{ sessionId: string }`
- On success: 200 → `ok({ session, messages })`
- Error mapping:
  - `401` → `UNAUTHORIZED`
  - `404` → `SESSION_NOT_FOUND` (from `DomainError`)
  - `500` → `INTERNAL_ERROR`

`ConversationsRouteOptions` (defined in Prompt 01) must already include `messageRepository?` — if
not, add it here.

### Stack-e2e additions to `conversations.stack-e2e.test.ts`

Add a new `describe` block: `Stack E2E — GET /v1/conversations/:sessionId/history`.

Cases:

- No API key → 401
- Wrong API key → 401
- Unknown `sessionId` → 404 with `error.code === 'SESSION_NOT_FOUND'`
- Happy path:
  1. Create session via `POST /v1/conversations/start`
  2. `GET /v1/conversations/:sessionId/history` → 200
  3. `data.session.sessionId` matches the created session
  4. `data.messages` is an empty array (no messages sent yet)
  5. Each message (if any) has `messageId`, `role`, `content`, `createdAt`

The history happy-path test verifies empty state. A more interesting case (non-empty history)
is part of the full lifecycle stack-e2e in Prompt 04, where messages are sent before reading
history.

---

## Constraints

- `GetHistoryUseCase` must not apply any message limit — it returns the full session history
  (unlike `SendMessageUseCase` which caps at 20 for the LLM context window)
- Do not add pagination logic — YAGNI for Phase A
- `memory` field in the API contract response is intentionally omitted in EPIC 2.2; the route
  should return `{ session, messages }` without a `memory` key
- No `any`; TypeScript strict mode

---

## Deliverables

- `apps/core/src/application/use-cases/get-history/get-history.types.ts`
- `apps/core/src/application/use-cases/get-history/get-history.use-case.ts`
- `apps/core/src/application/use-cases/get-history/get-history.use-case.test.ts`
- `apps/core/src/api/routes/conversations.ts` — history route added
- `apps/core/src/api/routes/conversations.test.ts` — history route test cases added
- `apps/core/src/api/routes/conversations.stack-e2e.test.ts` — history stack-e2e cases added

---

## Mandatory Final Step — Documentation Update

After implementation:

- `docs/PROJECT_STATUS.md` — note Prompt 02 complete; record new files
- `docs/API_CONTRACT.md` — verify §4 Get Conversation History matches response shape as
  implemented; note that `memory` field is `undefined` until EPIC 4.2

---

## Acceptance Criteria

- [ ] `GET /v1/conversations/:sessionId/history` returns 200 with `{ session, messages }` for an active session
- [ ] Returns 404 with `SESSION_NOT_FOUND` for unknown session
- [ ] Returns 401 for missing/wrong API key
- [ ] Messages are sorted chronologically (earliest first)
- [ ] `memory` is not present in the response (not yet implemented)
- [ ] Use case unit tests pass (happy path, empty messages, session not found)
- [ ] API tests (`inject()`) cover 200, 401, 404
- [ ] Stack-e2e cases pass (auth, 404, empty history happy path)
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` all pass
