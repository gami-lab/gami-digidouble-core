# 03 — Admin Metrics Endpoint

## Context

The `GetTurnMetricsUseCase` (prompt 02) produces structured per-turn performance data. This prompt exposes it via a new admin API endpoint: `GET /v1/admin/sessions/{sessionId}/metrics`.

This follows the same pattern as `GET /v1/admin/sessions/{sessionId}/inspect` (EPIC 2.6): admin-only, API-key protected, always returns 200 when authenticated and the session exists.

## Scope

**In scope:**

- New Fastify route plugin: `admin-metrics.ts`
- Endpoint: `GET /v1/admin/sessions/{sessionId}/metrics`
- Auth: `authenticateApiKey` hook (same as all admin routes)
- Response: `ApiResponse<TurnMetricsReport>` envelope
- Not-found handling: if session does not exist in the database, return `404`
- Registration under the `/v1/admin` prefix in `server.ts`
- `ServerAdapters` extended with `eventLogRepository` reference for the new route (already exists — confirm it is forwarded to the admin prefix block)

**Out of scope:**

- Query parameters (date range, provider filter) — add in a future hardening pass
- Caching of results
- Any changes to `TurnMetrics` domain types
- Console UI — deferred to a future EPIC

## Relevant Docs

- `docs/API_CONTRACT.md` — understand the `ApiResponse<T>` envelope and admin endpoint conventions
- `docs/ARCHITECTURE.md` — route handlers must not contain business logic; delegate to use case
- `apps/core/src/api/routes/admin-sessions.ts` — pattern reference for admin routes
- `apps/core/src/api/routes/admin-health.ts` — simplest admin route pattern
- `apps/core/src/api/server.ts` — how route plugins are registered and how `ServerAdapters` is forwarded

## Implementation Guidance

### Route shape

```
GET /v1/admin/sessions/:sessionId/metrics
Authorization: x-api-key: <key>
```

Response `200`:

```json
{
  "data": {
    "sessionId": "uuid",
    "checkedAt": "2026-04-30T12:00:00.000Z",
    "summary": {
      "totalTurns": 4,
      "turnsWithGm": 3,
      "avgAvatarLatencyMs": 842,
      "avgTotalTurnLatencyMs": 1120,
      "avgInputTokens": 312,
      "avgOutputTokens": 98,
      "avgGmLatencyMs": 640
    },
    "turns": [
      {
        "turnIndex": 1,
        "correlationId": "uuid",
        "avatarLatencyMs": 820,
        "totalTurnLatencyMs": 1100,
        "overheadMs": 280,
        "inputTokens": 300,
        "outputTokens": 90,
        "totalTokens": 390,
        "model": "gpt-4o-mini",
        "hasGm": true,
        "gmLatencyMs": 610,
        "gmInputTokens": 450,
        "gmOutputTokens": 55
      }
    ]
  },
  "error": null
}
```

Response `401`: standard `UNAUTHORIZED` envelope (handled by `authenticateApiKey`).

Response `404`:

```json
{
  "data": null,
  "error": {
    "code": "NOT_FOUND",
    "message": "Session <sessionId> was not found."
  }
}
```

### Not-found check

The route handler must verify the session exists before calling `GetTurnMetricsUseCase`. Use `ISessionRepository.findById`. If null, return `404 fail('NOT_FOUND', ...)`.

This check prevents the endpoint from returning an empty-but-200 metrics report for a typo'd session ID.

### Route plugin

File: `apps/core/src/api/routes/admin-metrics.ts`

Options interface:

```ts
type AdminMetricsRouteOptions = {
  config: Config
  sessionRepository: ISessionRepository
  eventLogRepository: IEventLogRepository
}
```

The plugin creates a `GetTurnMetricsUseCase` instance from `options.eventLogRepository` and uses `options.sessionRepository` for the existence check.

### server.ts registration

Register `adminMetricsRoute` under the `/v1/admin` prefix, forwarding `config`, `sessionRepository`, and `eventLogRepository` from `ServerAdapters`. These adapters already exist on `ServerAdapters` — do not add new fields.

### Input validation

Validate that `:sessionId` is a non-empty string. Fastify schema validation is sufficient; a UUID format check is optional but not required.

## Constraints

- No business logic in the route handler — it delegates entirely to `GetTurnMetricsUseCase`.
- The `TurnMetricsReport` is serialized as-is in the `ok()` envelope — no DTO transformation needed.
- Always return HTTP 200 on authenticated requests where the session exists, even if `turns` is empty.
- The `null` vs `0` distinction for `avgGmLatencyMs` must be preserved in the JSON response.

## Mandatory Pre-Implementation Check

Before coding:

1. Read `apps/core/src/api/server.ts` — confirm `eventLogRepository` is already in `ServerAdapters` and forwarded to admin routes. If not, add it.
2. Read `apps/core/src/api/routes/admin-sessions.ts` — confirm the `authenticateApiKey` hook pattern.
3. Check `apps/core/src/api/routes/admin-health.ts` — the simplest admin route reference.
4. Verify the `ok()` and `fail()` helpers are imported from `@gami/shared`.

## Deliverables

- `apps/core/src/api/routes/admin-metrics.ts` — Fastify route plugin
- Updated `apps/core/src/api/server.ts` — registration under `/v1/admin`

## Mandatory Final Step — Documentation Update

After implementation:

- `docs/API_CONTRACT.md` — add the new endpoint definition (see prompt 05 for full doc sync, but add a placeholder if doc sync is a separate step)
- `docs/PROJECT_STATUS.md` — note that the metrics endpoint is wired

## Acceptance Criteria

- [ ] `GET /v1/admin/sessions/{sessionId}/metrics` returns `401` without API key
- [ ] `GET /v1/admin/sessions/{sessionId}/metrics` returns `401` with wrong API key
- [ ] `GET /v1/admin/sessions/{sessionId}/metrics` returns `404` for unknown session ID
- [ ] `GET /v1/admin/sessions/{sessionId}/metrics` returns `200` with `TurnMetricsReport` shape for a known session
- [ ] Response includes `summary` and `turns` array (may be empty for a new session with no turns)
- [ ] `pnpm typecheck` passes
