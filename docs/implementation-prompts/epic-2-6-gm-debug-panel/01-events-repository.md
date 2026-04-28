# 01 — Extend EventLog Repository with `findBySessionId`

## Context

The `IEventLogRepository` port currently exposes only one method: `append`. A `Phase B` comment in
`apps/core/src/application/ports/IEventLogRepository.ts` already marks `findBySessionId` as deferred.

EPIC 2.6 needs this method immediately: the `GET /v1/admin/sessions/{sessionId}/events` endpoint
must retrieve stored GM events per session. Before any endpoint can be built, all three
implementations must expose the read path.

## Scope

### In scope

- Add `findBySessionId(sessionId: string, opts?: { limit?: number }): Promise<StoredEvent[]>` to
  `IEventLogRepository` (replace the Phase B comment with the real signature)
- Implement it in `InMemoryEventLogRepository` (filter by `sessionId`, respect optional `limit`,
  return newest-first)
- Implement it in `PostgresEventLogRepository` (query `event_log` table by `session_id`, order by
  `created_at DESC`, apply `LIMIT` when provided)
- Add a `createdAt` field to `StoredEvent` so callers can surface timestamps in the API response
  without a second query
- Update `InMemoryEventLogRepository.getAll()` (test-only helper) if needed for consistency

### Out of scope

- Pagination (cursor / offset) — `limit` is sufficient for Phase A
- Filtering by `type` — not required for EPIC 2.6 endpoints
- Any changes to event emission logic — events are already emitted correctly by `RunGameMasterUseCase`

## Relevant Docs

- `docs/GAME_MASTER_CONTRACT.md` §14 — event payload shape and rules
- `docs/ARCHITECTURE.md` — ports/adapters layer rules
- `apps/core/src/application/ports/IEventLogRepository.ts` — current interface
- `apps/core/src/infrastructure/db/in-memory-event-log.repository.ts`
- `apps/core/src/infrastructure/db/repositories/postgres-event-log.repository.ts`
- `apps/core/src/infrastructure/db/repositories/postgres-event-log.repository.integration.test.ts`

## Implementation Guidance

### Interface change

```ts
// IEventLogRepository.ts
export interface IEventLogRepository {
  append(event: StoredEvent): Promise<void>
  findBySessionId(sessionId: string, opts?: { limit?: number }): Promise<StoredEvent[]>
}

export type StoredEvent = {
  sessionId?: string
  type: string
  severity: 'info' | 'warning' | 'error'
  correlationId?: string
  requestId?: string
  payload: Record<string, unknown>
  createdAt?: string // ISO 8601 UTC — populated on read; optional to not break existing append callers
}
```

Adding `createdAt` as optional on `StoredEvent` avoids breaking the many existing `append` call sites
that don't set it. The Postgres implementation populates it from the DB column on reads.

### In-memory implementation

- Store events with an appended `createdAt: new Date().toISOString()` on `append`
- `findBySessionId`: filter `this.events` where `event.sessionId === sessionId`, reverse for
  newest-first, slice to `limit` if provided

### Postgres implementation

```sql
SELECT id, session_id, type, severity, correlation_id, request_id, payload, created_at
FROM event_log
WHERE session_id = $1
ORDER BY created_at DESC
LIMIT $2
```

Use `NULL` / no LIMIT clause when `opts?.limit` is undefined.
Map `correlation_id` → `correlationId`, `request_id` → `requestId`, `created_at` → `createdAt`.

### Integration test

Add a `findBySessionId` test to
`postgres-event-log.repository.integration.test.ts` covering:

- returns events for the target session ordered newest-first
- respects `limit`
- returns empty array for unknown sessionId

## Constraints

- TypeScript strict mode — no `any`
- Do not change the `append` signature — it is called in many places
- Keep `createdAt` optional on `StoredEvent` to avoid mass-updating existing append call sites
- In-memory implementation must remain deterministic for unit tests

## Deliverables

- Updated `IEventLogRepository` interface
- Updated `InMemoryEventLogRepository`
- Updated `PostgresEventLogRepository`
- Integration tests for `findBySessionId` in existing integration test file

## Mandatory Final Step — Documentation Update

After implementation, verify:

- `docs/PROJECT_STATUS.md` — note the repository extension under EPIC 2.6 progress
- `docs/GAME_MASTER_CONTRACT.md` §14 — remove the "Phase B" deferral comment from the interface
  if it references this method

## Acceptance Criteria

- [ ] `IEventLogRepository` interface exports `findBySessionId` with the new signature
- [ ] `InMemoryEventLogRepository.findBySessionId` returns newest-first, respects optional `limit`
- [ ] `PostgresEventLogRepository.findBySessionId` executes correct SQL with optional LIMIT
- [ ] `StoredEvent.createdAt` is populated on reads (Postgres: from column; in-memory: from `append` time)
- [ ] Existing `append` call sites compile without changes
- [ ] Integration tests added and passing
- [ ] `pnpm lint && pnpm typecheck && pnpm test` pass
