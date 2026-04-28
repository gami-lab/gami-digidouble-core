# 03 — List Sessions + Reset Session

## Context

Today, `POST /v1/sessions` and `GET /v1/sessions/{sessionId}` exist. There is no way to list all sessions or to reset a session's runtime state. Both are required for the console to work as an admin tool. This prompt adds two new endpoints:

1. `GET /v1/sessions` — list sessions with optional filtering, ordered by most recent activity
2. `POST /v1/sessions/{sessionId}/reset` — reset a session's runtime state (clear messages, clear active conversation, clear GM notes, reset unlock progression)

These are the two most operationally critical session admin operations.

## Scope

**In scope:**

- `ISessionRepository.list()` port method + in-memory and Postgres implementations
- `ListSessionsUseCase` in `application/use-cases/list-sessions/`
- `ResetSessionUseCase` in `application/use-cases/reset-session/`
- `GET /v1/sessions` route handler in `sessions.ts`
- `POST /v1/sessions/{sessionId}/reset` route handler in `sessions.ts`
- `sessions.stack-e2e.test.ts` — auth, validation, not-found for both endpoints

**Out of scope:**

- Pagination (page cursors, limit/offset) — Phase A uses simple full-list with deterministic ordering
- Deleting sessions (not in EPIC 2.5 scope)
- Console UI (prompt 04)

## Relevant Docs

- `docs/API_CONTRACT.md` — existing session shapes (`SessionSummary`), existing `POST /v1/sessions` and `GET /v1/sessions/{sessionId}` contracts
- `docs/DATA_MODEL.md` — sessions table columns: `session_id`, `user_id`, `scenario_id`, `status`, `active_avatar_id`, `unlocked_avatar_ids`, `gm_notes`, `started_at`, `last_activity_at`, `ended_at`
- `apps/core/src/application/ports/ISessionRepository.ts` — current interface with `SessionUpdate` type
- `apps/core/src/application/use-cases/get-session/` — reference pattern for a simple session use case
- `apps/core/src/infrastructure/db/repositories/postgres-session.repository.ts` — Postgres repository to extend
- `apps/core/src/api/routes/sessions.ts` — route file to extend
- `apps/core/src/api/routes/sessions.stack-e2e.test.ts` — existing stack-e2e to extend

## Implementation Guidance

### List Sessions — Repository Port

Extend `ISessionRepository`:

```ts
list(filter?: ListSessionsFilter): Promise<Session[]>
```

Where:

```ts
export type ListSessionsFilter = {
  scenarioId?: string
  userId?: string
  status?: Session['status']
}
```

Ordering: `lastActivityAt DESC` (most recently active first). Phase A does not paginate.

### List Sessions — In-Memory Implementation

`InMemorySessionRepository.list()`:

- Return all stored sessions, optionally filtered by `scenarioId`, `userId`, `status`
- Sort by `lastActivityAt DESC`

### List Sessions — Postgres Implementation

`PostgresSessionRepository.list()`:

- `SELECT * FROM sessions WHERE ... ORDER BY last_activity_at DESC`
- Build `WHERE` clause dynamically based on which filter fields are present
- Map rows to `Session[]` using the existing row mapper

### List Sessions — Use Case

`ListSessionsUseCase` in `application/use-cases/list-sessions/`:

Files:

- `list-sessions.types.ts` — `ListSessionsInput` / `ListSessionsOutput`
- `list-sessions.use-case.ts`

```ts
type ListSessionsInput = {
  scenarioId?: string
  userId?: string
  status?: 'active' | 'closed' | 'archived'
}

type ListSessionsOutput = {
  sessions: Session[]
}
```

No domain errors expected here — always returns `[]` for empty result sets.

### List Sessions — Route

Add to `sessions.ts`:

```
GET /v1/sessions
```

- Query string params: `scenarioId?`, `userId?`, `status?`
- Fastify query schema: all optional strings
- Call `ListSessionsUseCase.execute()`
- Response: `{ sessions: SessionSummary[] }`

---

### Reset Session — Semantics

Reset means:

- Session record **stays** (not deleted)
- All **messages** for all conversations in the session are deleted
- All **conversations** for the session are deleted
- `activeAvatarId` is set to `null`
- `unlockedAvatarIds` is reset to `[]` (empty — back to initial unlock state)
- `gmNotes` is cleared to `null`
- `status` is reset to `'active'` (even if previously `'closed'`)
- `lastActivityAt` is refreshed to now

This is a hard reset to a clean slate, preserving only the session identity and original `userId` / `scenarioId` binding.

### Reset Session — Dependencies

`ResetSessionUseCase` needs:

- `ISessionRepository` (to update session record)
- `IConversationRepository` (to delete conversations by sessionId)
- `IMessageRepository` (to delete messages by conversationId or sessionId)

Check `IConversationRepository` and `IMessageRepository` ports for existing `delete` / `deleteBySessionId` methods. Add any missing ones:

- `IConversationRepository.deleteBySessionId(sessionId)` if not present
- `IMessageRepository.deleteByConversationId(conversationId)` or `deleteBySessionId(sessionId)` if not present

Prefer a `deleteBySessionId` at the message level if the DB schema permits it (message → conversation → session join).

### Reset Session — Use Case

`ResetSessionUseCase` in `application/use-cases/reset-session/`:

Files:

- `reset-session.types.ts`
- `reset-session.use-case.ts`

```ts
type ResetSessionInput = {
  sessionId: string
}

type ResetSessionOutput = {
  session: Session
}
```

Steps:

1. Load session by ID — throw `DomainError('NOT_FOUND', ...)` if missing
2. Delete all messages for this session (via `IMessageRepository`)
3. Delete all conversations for this session (via `IConversationRepository`)
4. Update session: `activeAvatarId = null`, `unlockedAvatarIds = []`, `gmNotes = null`, `status = 'active'`, `lastActivityAt = now`
5. Return updated session

### Reset Session — Route

Add to `sessions.ts`:

```
POST /v1/sessions/:sessionId/reset
```

- No request body required
- Call `ResetSessionUseCase.execute({ sessionId })`
- Map `NOT_FOUND` → `404`, everything else → `500`
- Response: `{ session: SessionSummary }`
- Status: `200 OK`

### Stack-E2E Tests

Extend `sessions.stack-e2e.test.ts`:

**For `GET /v1/sessions`:**

- No API key → `401`
- Wrong API key → `401`
- Happy path: returns `200` with `sessions` array (may be empty — no seeding required)

**For `POST /v1/sessions/:id/reset`:**

- No API key → `401`
- Wrong API key → `401`
- `POST /v1/sessions/nonexistent/reset` → `404`
- Happy-path reset test: seed a session via `POST /v1/sessions`, start a conversation, send a message, reset, verify the history endpoint returns empty. This requires the full session flow to be available — use existing session + conversation + message endpoints to set up state.

## Constraints

- The reset operation must be atomic from the caller's perspective — if the session update fails after messages are deleted, the session should be in a known state. Use a try/catch; do not implement DB transactions in Phase A (KISS)
- `deleteBySessionId` is preferred over iterating conversations and deleting messages one by one — check if the Postgres message repository already supports this pattern
- Phase A: no pagination for list sessions — full result set returned
- TypeScript strict mode — no `any`
- `sessions.ts` is already large — group the new handlers cleanly after existing ones, following the same option-injection and use-case instantiation pattern

## Deliverables

1. `ISessionRepository.list()` + `IConversationRepository.deleteBySessionId()` + `IMessageRepository` delete extension — ports updated
2. All in-memory repository implementations updated
3. All Postgres repository implementations updated
4. `ListSessionsUseCase` implemented + unit tested
5. `ResetSessionUseCase` implemented + unit tested (happy path, not found, state after reset)
6. `GET /v1/sessions` and `POST /v1/sessions/:id/reset` route handlers wired in `sessions.ts`
7. `sessions.stack-e2e.test.ts` extended with coverage for both new endpoints

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/API_CONTRACT.md` — add `GET /v1/sessions` section (query params, response, ordering) and `POST /v1/sessions/{sessionId}/reset` section (semantics, response, error mapping)
- `docs/PROJECT_STATUS.md` — note both session admin endpoints implemented
- Verify `docs/DATA_MODEL.md` reflects that `gm_notes`, `active_avatar_id`, `unlocked_avatar_ids` are all clearable via reset

## Acceptance Criteria

- [ ] `ISessionRepository` defines `list(filter?): Promise<Session[]>`
- [ ] In-memory and Postgres session repositories implement `list()`
- [ ] `ListSessionsUseCase` returns all sessions, supports filter by `scenarioId`, `userId`, `status`
- [ ] `GET /v1/sessions` returns `200` with ordered session list
- [ ] `ResetSessionUseCase` deletes messages + conversations, resets session state fields
- [ ] `POST /v1/sessions/:id/reset` returns `200` with updated session record
- [ ] `POST /v1/sessions/nonexistent/reset` returns `404`
- [ ] Stack-e2e covers auth, not-found, and happy path for both endpoints
- [ ] `pnpm lint && pnpm typecheck && pnpm test` pass cleanly
- [ ] `docs/API_CONTRACT.md` documents both new endpoints
