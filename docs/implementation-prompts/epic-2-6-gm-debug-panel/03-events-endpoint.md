# 03 — Events Endpoint: `GET /v1/admin/sessions/{sessionId}/events`

## Context

The Game Master emits a `gm_triggered` or `gm_skipped` event after every turn
(see `docs/GAME_MASTER_CONTRACT.md` §14). These events are persisted in the `event_log` table via
`IEventLogRepository.append`, but until now no HTTP endpoint surfaces them.

This endpoint makes GM events queryable per session so operators can understand:

- how many turns triggered the GM vs were skipped
- what trigger reason fired
- which avatar was active at each GM decision
- whether notes were injected
- how long each GM run took

Prerequisite: `IEventLogRepository.findBySessionId` must be implemented first (see prompt 01).

## Scope

### In scope

- `ListSessionEventsUseCase` in `apps/core/src/application/use-cases/list-session-events/`
- Route handler wired under `GET /v1/admin/sessions/:sessionId/events`
- Optional `limit` query parameter (integer, default 50, max 200)
- Response: array of safe event records ordered newest-first
- Auth enforcement via existing `x-api-key` guard
- `404` for unknown session (check session exists before querying events)
- Filter: only return events of type `gm_triggered` and `gm_skipped` — never surface internal
  system events or error events to the admin endpoint

### Out of scope

- Filter by event type via query param — not needed for Phase A
- Raw user message content — the `StoredEvent.payload` filtering rules below apply
- Cursor-based pagination — `limit` is sufficient for Phase A

## Relevant Docs

- `docs/GAME_MASTER_CONTRACT.md` §14 — `GameMasterEvent` payload shape and safety rules
- `docs/API_CONTRACT.md` — response envelope pattern
- `apps/core/src/application/ports/IEventLogRepository.ts` (after prompt 01)

## Implementation Guidance

### Response type

```ts
type ListSessionEventsResponse = {
  events: Array<{
    type: 'gm_triggered' | 'gm_skipped'
    correlationId: string
    createdAt: string
    payload: {
      triggerReason: string
      turnIndex: number
      interactionCount: number
      stateBefore: {
        currentAvatarId?: string
        progression: string
        topicsCovered: string[]
      }
      decision?: {
        avatarId: string
        conversationMode: 'new' | 'continue'
        notesInjected: boolean
        directiveCount: number
      }
      stateAfter?: {
        currentAvatarId?: string
        progression: string
        topicsCovered: string[]
      }
      latencyMs: number
      inputTokens?: number
      outputTokens?: number
    }
  }>
}
```

### Filtering rule

`ListSessionEventsUseCase` must filter results to only expose events whose `type` is `gm_triggered`
or `gm_skipped`. Any other event type stored in the log (system events, error events, future types)
must be silently excluded. This prevents accidental leakage of internal events through the admin API.

### Use case

Constructor takes: `ISessionRepository`, `IEventLogRepository`

Logic:

1. `sessionRepository.findById(sessionId)` — throw `DomainError('NOT_FOUND')` if null
2. `eventLogRepository.findBySessionId(sessionId, { limit: resolvedLimit })` with clamped limit
3. Filter to `type === 'gm_triggered' || type === 'gm_skipped'`
4. Map each `StoredEvent` to the response shape (extract safe fields from `payload`)

### Route

Add the `GET /v1/admin/sessions/:sessionId/events` handler to the existing `admin-sessions.ts` route
file created in prompt 02. Keep it in the same route file to avoid fragmenting the admin route
surface.

### Query parameter validation

Validate `limit` at the API boundary:

- must be a positive integer when provided
- clamp to max 200
- default to 50 when absent
- return `400 VALIDATION_ERROR` for non-integer or negative values

## Constraints

- The response must never contain raw user message text — the `StoredEvent.payload` from GM events
  follows the §14 contract which already excludes user messages
- Filter by GM event types only — never surface non-GM events
- Max function length: 100 lines (ESLint rule)
- No direct DB access from route handler

## Deliverables

- `apps/core/src/application/use-cases/list-session-events/list-session-events.use-case.ts`
- `apps/core/src/application/use-cases/list-session-events/list-session-events.use-case.test.ts`
- Route handler added to `apps/core/src/api/routes/admin-sessions.ts`
- Console API client function `listSessionEvents(sessionId, opts?: { limit?: number })` in
  `apps/console/src/api/`

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/API_CONTRACT.md` — add `GET /v1/admin/sessions/{sessionId}/events` contract block
- `docs/GAME_MASTER_CONTRACT.md` §14 — mark the endpoint as now implemented
- `docs/PROJECT_STATUS.md` — note endpoint added under EPIC 2.6

## Acceptance Criteria

- [ ] `ListSessionEventsUseCase` implemented with unit tests
- [ ] Route mounted and returns correct shape for a session with events
- [ ] `limit` query parameter validated; default 50, max 200, `400` on invalid value
- [ ] Only `gm_triggered` / `gm_skipped` event types appear in response
- [ ] `401` on missing/wrong API key
- [ ] `404` on unknown session
- [ ] Events ordered newest-first
- [ ] `pnpm lint && pnpm typecheck && pnpm test` pass
