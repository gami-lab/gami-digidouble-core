# 01 — StartSessionUseCase + POST /v1/conversations/start

## Context

The platform currently has no way to create a session through an API call. Sessions in the
existing test suite are pre-seeded into `InMemorySessionRepository` as test fixtures.

This prompt delivers the first real lifecycle step: a caller creates a session, receives a
`sessionId`, and can immediately start sending messages. This unblocks the full stack-e2e
happy path for the messaging endpoint and makes the platform usable as a self-contained API.

---

## Scope

**In scope:**

- `StartSessionUseCase` in `application/use-cases/start-session/`
- `POST /v1/conversations/start` route in `api/routes/conversations.ts`
- Unit tests for the use case
- API tests (`inject()`) for the route
- `conversations.stack-e2e.test.ts` — auth, validation, and full happy-path (200) tests for this endpoint
- Update the `TODO(EPIC-2.2)` comment in `send-message.use-case.ts` to `TODO(EPIC-4.1)` (Game Master is now EPIC 4.1)

**Out of scope:**

- User creation / user management (for now, `userId` is passed by the caller)
- `initialContext` / `userFacts` injection (Memory layer — EPIC 4.2)
- Game Master init on session start (EPIC 4.1)
- Session listing endpoint (not in EPIC 2.2 scope)

---

## Relevant Docs

- `docs/API_CONTRACT.md` — §1 Start Session (request/response shape)
- `docs/DATA_MODEL.md` — §4 Session entity
- `docs/ARCHITECTURE.md` — Application layer rules; route registration pattern
- `docs/TEST_STRATEGY.md` — Rule 6: every new API endpoint must have a stack-e2e test file

---

## Implementation Guidance

### `StartSessionUseCase`

**Types (`start-session.types.ts`):**

```ts
export interface StartSessionInput {
  userId: string
  scenarioId: string
}

export interface StartSessionOutput {
  session: SessionSummary
}
```

`userId` is required for EPIC 2.2. Auto-generation of userId is deferred to a later EPIC when
user management is formalized.

**Use case (`start-session.use-case.ts`):**

Constructor dependencies: `ISessionRepository`

`execute(input)`:

1. Validate `userId` and `scenarioId` are non-empty strings
2. Call `sessionRepository.create({ userId, scenarioId })`
3. Map the returned `Session` to `SessionSummary`
4. Return `{ session }`

No observability trace is needed for session start in Phase A (low-risk, cheap operation).

**Request body scope for EPIC 2.2:**

```ts
type StartSessionRequest = {
  userId: string
  scenarioId: string
}
```

The full contract shape in `API_CONTRACT.md` includes `user.userId?`, `user.externalId?`,
`user.email?`, `initialContext?`, etc. For EPIC 2.2, implement only `userId` + `scenarioId`.
The route must return `400` if either is missing or empty. Do not implement the nested `user`
object wrapper yet — that is a Phase B concern when multi-user support is formalized.

### Route file — `api/routes/conversations.ts`

Create a new Fastify plugin: `conversationsRoute`.

Register it in `server.ts`:

```ts
app.register(conversationsRoute, { prefix: '/v1/conversations', config, ...adapters })
```

`MessagesRouteOptions` pattern in `messages.ts` is the exact model to follow.

**`POST /v1/conversations/start`:**

- Auth: `authenticateApiKey` preHandler
- Body schema: `{ userId: string (minLength 1), scenarioId: string (minLength 1) }`
- On success: 200 → `ok({ session: SessionSummary })`
- Error mapping:
  - `401` → `UNAUTHORIZED` (missing/wrong API key)
  - `400` → `VALIDATION_ERROR` (missing or blank fields)
  - `500` → `INTERNAL_ERROR` (unexpected)

**No 404 / 409 is expected here** (start always creates, not looks up).

### Stack-e2e — `conversations.stack-e2e.test.ts`

This endpoint can be fully tested from the stack without any pre-seeded data. The happy-path
20test sends a valid request and verifies the returned session shape. This is different from
the messages endpoint which required a pre-existing session.

Minimum test cases:

- No API key → 401
- Wrong API key → 401
- Missing `scenarioId` → 400
- Missing `userId` → 400
- Valid request → 200 with `data.session.sessionId` matching expected format, `status: 'active'`

The `data.session.sessionId` returned can be captured and used in the history/reset stack-e2e
tests (Prompts 02 and 03) for lifecycle progression.

---

## Constraints

- No `any`; TypeScript strict mode throughout
- `StartSessionUseCase` has no LLM or observability dependencies — it is a simple repository
  operation
- Route file `conversations.ts` will grow across Prompts 01, 02, 03 — structure it so adding
  more routes in the same file does not require refactoring the plugin registration
- The `ConversationsRouteOptions` type must include optional `sessionRepository` so tests can
  inject `InMemorySessionRepository`

---

## Deliverables

- `apps/core/src/application/use-cases/start-session/start-session.types.ts`
- `apps/core/src/application/use-cases/start-session/start-session.use-case.ts`
- `apps/core/src/application/use-cases/start-session/start-session.use-case.test.ts`
- `apps/core/src/api/routes/conversations.ts` — new route file (start endpoint for now)
- `apps/core/src/api/routes/conversations.test.ts` — API tests via `inject()` for start
- `apps/core/src/api/routes/conversations.stack-e2e.test.ts` — stack-e2e (auth + validation + happy path)
- `apps/core/src/api/server.ts` — register `conversationsRoute`
- `apps/core/src/application/use-cases/send-message/send-message.use-case.ts` — update `TODO(EPIC-2.2)` → `TODO(EPIC-4.1)`

---

## Mandatory Final Step — Documentation Update

After implementation:

- `docs/PROJECT_STATUS.md` — note EPIC 2.2 / Prompt 01 complete; record new files
- `docs/API_CONTRACT.md` — verify §1 Start Session matches request shape as implemented; note
  that `user` nesting and `initialContext` are deferred to Phase B

---

## Acceptance Criteria

- [ ] `POST /v1/conversations/start` returns 200 with a valid `sessionId` and `status: 'active'`
- [ ] Missing `userId` or `scenarioId` returns 400
- [ ] Missing/wrong API key returns 401
- [ ] Use case unit tests pass (happy path, missing userId, missing scenarioId)
- [ ] API tests (`inject()`) cover all error cases
- [ ] `conversations.stack-e2e.test.ts` includes a full 200 happy-path test (no deferred comment)
- [ ] `TODO(EPIC-2.2)` comment updated to `TODO(EPIC-4.1)` in `send-message.use-case.ts`
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` all pass
