# 03 — Admin Health Endpoint

## Context

Probes exist (prompt 02). Now wire them into a use case and expose the result through a protected HTTP endpoint. The existing flat `GET /health` liveness probe must remain unchanged.

## Scope

**In scope:**

- `GetHealthUseCase` in `application/use-cases/get-health/`
- `GET /v1/admin/health` Fastify route (API-key protected)
- Wire probes through `ServerAdapters` into the route
- HTTP status rule: `200` when healthy, `200` when degraded (body signals degradation — don't 503, operators need the body)
- Update `apps/core/src/index.ts` to construct and wire the three probes

**Out of scope:**

- Streaming, WebSocket
- Per-dependency latency history or alerting
- Writing to Langfuse/observability (deferred)

## Relevant Docs

- `docs/API_CONTRACT.md` — response envelope `ApiResponse<T>`, error codes
- `docs/ARCHITECTURE.md` — API → Application → Domain → Infrastructure; no infrastructure in use case
- Existing routes: `apps/core/src/api/routes/health.ts`, `apps/core/src/api/routes/scenarios.ts` (style reference)
- `apps/core/src/api/hooks/authenticate.ts` — reusable `authenticateApiKey` preHandler

## Implementation Guidance

### Use Case

`apps/core/src/application/use-cases/get-health/get-health.use-case.ts`

```ts
export class GetHealthUseCase {
  constructor(private readonly probes: IDependencyProbe[]) {}

  async execute(): Promise<HealthReport> {
    const results = await Promise.allSettled(probes.map((p) => p.probe()))
    // map settled results: rejected → degraded DependencyProbeResult
    // apply aggregate status rule from prompt 01
    // return HealthReport
  }
}
```

Use `Promise.allSettled` so one probe failure never prevents other probes from running.

For `rejected` settlements (should not happen if probes are correct, but defensive):

```ts
{ name: 'unknown', status: 'degraded', message: String(reason) }
```

### Route

`apps/core/src/api/routes/admin-health.ts`

- `GET /v1/admin/health`
- `preHandler: authenticateApiKey`
- Calls `GetHealthUseCase.execute()`
- Returns `ok<HealthReport>(report)` — always HTTP 200 (the `status` field in the body carries the signal)
- No 503 on degraded: consumers inspect the body, not the HTTP status

**Response shape** (per `ApiResponse<HealthReport>` envelope):

```json
{
  "data": {
    "status": "degraded",
    "checkedAt": "2026-04-22T10:00:00.000Z",
    "dependencies": [
      { "name": "postgres", "status": "healthy", "latencyMs": 4 },
      {
        "name": "redis",
        "status": "degraded",
        "latencyMs": null,
        "message": "connect ECONNREFUSED"
      },
      { "name": "llm", "status": "healthy", "latencyMs": 312 }
    ]
  },
  "error": null
}
```

### ServerAdapters extension

Add a `probes?: IDependencyProbe[]` field to `ServerAdapters` (or equivalent config object in `server.ts`). When not provided, default to an empty array (safe for unit tests).

In `apps/core/src/index.ts`, after constructing the DB/Redis/LLM clients for production, construct the three probes and pass them through:

```ts
const probes: IDependencyProbe[] = [
  new PostgresProbe(sql),
  new RedisProbe(redisClient),
  new LlmProbe(llmAdapter),
]
```

### Route registration

Register `adminHealthRoute` in `apps/core/src/api/server.ts` under no prefix (the route itself is `/v1/admin/health`). Follow the same `server.register(...)` pattern used by `scenarios.ts`.

## Constraints

- `GET /health` must remain unchanged — no new calls, always 200/ok
- Admin route must require API key auth — no open health endpoint
- The use case must depend only on `IDependencyProbe[]`, never on concrete implementations
- No business logic in the route handler — use case handles all decisions

## Deliverables

- `apps/core/src/application/use-cases/get-health/get-health.use-case.ts`
- `apps/core/src/application/use-cases/get-health/get-health.types.ts` (if needed for input/output DTOs)
- `apps/core/src/api/routes/admin-health.ts`
- `apps/core/src/api/server.ts` updated to register the route and thread `probes` through
- `apps/core/src/index.ts` updated to wire concrete probes in production

## Mandatory Final Step — Documentation Update

After implementation:

- `docs/API_CONTRACT.md` — add `GET /v1/admin/health` contract section (request, response shape, auth, error codes)
- `docs/PROJECT_STATUS.md` — note that admin health endpoint is implemented
- Verify `docs/ARCHITECTURE.md` still accurately reflects the layer boundaries

## Acceptance Criteria

- [ ] `GET /v1/admin/health` requires a valid API key (missing/wrong key → 401)
- [ ] Response always uses `ApiResponse<HealthReport>` envelope
- [ ] HTTP status is always 200 (degraded state is in the body)
- [ ] `GetHealthUseCase` depends only on `IDependencyProbe[]` — no concrete probe imports
- [ ] `GET /health` is unchanged
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` pass
