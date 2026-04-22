# 04 — Tests and Hardening

## Context

The domain model, probes, and endpoint are implemented. This prompt adds full test coverage: unit tests for probe logic and the use case, route-level inject tests, and the mandatory stack E2E test file.

## Scope

**In scope:**

- Unit tests for `PostgresProbe`, `RedisProbe`, `LlmProbe` — happy path + error path
- Unit tests for `GetHealthUseCase` — all healthy, partial degraded, all degraded, one probe rejects
- Route inject tests for `GET /v1/admin/health` — auth, shape, status field
- `admin-health.stack-e2e.test.ts` — auth enforcement + response shape against live stack
- Edge case hardening: probe timeout, 3-second ceiling verified in unit test

**Out of scope:**

- Performance benchmarks
- Load testing
- Langfuse trace assertions

## Relevant Docs

- `docs/TEST_STRATEGY.md` — unit vs integration vs E2E definitions
- `apps/core/src/api/routes/exchange.stack-e2e.test.ts` — stack E2E file pattern to follow
- `apps/core/vitest.config.ts` and `vitest.integration.config.ts` for test configuration

## Implementation Guidance

### Unit tests: probes

`apps/core/src/infrastructure/health/postgres.probe.test.ts`

Test with a mock `Sql` object:

- happy path: `SELECT 1` resolves → `{ status: 'healthy', latencyMs: <number> }`
- error path: `SELECT 1` rejects with `new Error('connection refused')` → `{ status: 'degraded', message: 'connection refused' }`
- timeout path: mock `SELECT 1` to never resolve → probe returns `degraded` within 3100ms (use `vi.useFakeTimers`)

Same structure for `redis.probe.test.ts` (mock `ioredis` client) and `llm.probe.test.ts` (mock `ILlmAdapter`).

For `LlmProbe`:

- happy path: adapter resolves → `healthy`
- `LlmError` thrown → `degraded` with message
- non-`LlmError` thrown → `degraded` with message

### Unit tests: use case

`apps/core/src/application/use-cases/get-health/get-health.use-case.test.ts`

Use `NullProbe` instances and a custom stub that returns `degraded`:

```ts
class DegradedProbe implements IDependencyProbe {
  constructor(private readonly probeName: string) {}
  async probe() {
    return { name: this.probeName, status: 'degraded' as const }
  }
}
```

Test cases:

- All probes healthy → `report.status === 'healthy'`
- One probe degraded → `report.status === 'degraded'`
- All probes degraded → `report.status === 'degraded'`
- `Promise.allSettled` resilience: one probe `throw`s synchronously → still returns result with all others
- `checkedAt` is a valid ISO 8601 string
- `dependencies` array length equals number of probes passed

### Route inject tests

`apps/core/src/api/routes/admin-health.test.ts`

Use Fastify `inject()`. Inject `NullProbe` instances for all three dependencies via `createServer({ probes: [...] })`.

Test cases:

- Missing API key → 401
- Wrong API key → 401
- Valid key, all probes healthy → 200, `data.status === 'healthy'`
- Valid key, one degraded probe → 200, `data.status === 'degraded'`
- `data.dependencies` is an array of the correct length
- `data.checkedAt` is present and parseable as a date

### Stack E2E test

`apps/core/src/api/routes/admin-health.stack-e2e.test.ts`

Follow the exact pattern of `exchange.stack-e2e.test.ts`.

**Always-on (no API key constraints):**

```ts
describe('Stack E2E — GET /v1/admin/health — auth', () => {
  it('rejects requests with no API key (401)')
  it('rejects requests with wrong API key (401)')
})
```

**Happy-path shape (always-on when stack is running):**

```ts
describe('Stack E2E — GET /v1/admin/health — shape', () => {
  it('returns 200 with correct HealthReport shape', async () => {
    // status is 'healthy' or 'degraded' (Redis/LLM may not be wired in null stack)
    // assert: data.status is a known HealthStatus value
    // assert: data.dependencies is an array
    // assert: data.checkedAt is a valid ISO string
  })
})
```

Do not assert specific dependency statuses — the stack E2E environment may not have Redis or LLM wired.

### Hardening

Review probe implementations with these edge cases in mind:

1. **Postgres probe with closed connection** — if the DB pool has been ended before a probe runs, the `SELECT 1` throws; confirm the catch block handles this
2. **Redis probe with undefined client** — if Redis URL is missing from config, `getRedisClient()` should throw at startup, not silently pass a `null` client to the probe
3. **LLM probe with NullLlmAdapter** — must not make any network call; verify `NullLlmAdapter.complete()` still resolves immediately

## Constraints

- Stack E2E tests must be in `vitest.integration.config.ts` scope (same pattern as other stack E2E files)
- Unit tests must use no real network connections — mock all adapters
- `NullProbe` must be the default in `createServer()` when no probes are provided (for backward compatibility with all existing tests)
- Do not modify the coverage thresholds — new code must stay above 80% on all dimensions

## Deliverables

- `apps/core/src/infrastructure/health/postgres.probe.test.ts`
- `apps/core/src/infrastructure/health/redis.probe.test.ts`
- `apps/core/src/infrastructure/health/llm.probe.test.ts`
- `apps/core/src/application/use-cases/get-health/get-health.use-case.test.ts`
- `apps/core/src/api/routes/admin-health.test.ts`
- `apps/core/src/api/routes/admin-health.stack-e2e.test.ts`

## Mandatory Final Step — Documentation Update

After implementation:

- `docs/TEST_STRATEGY.md` — verify the integration/E2E test list still accurately reflects what exists; add a note about the admin health stack E2E pattern if needed
- `docs/PROJECT_STATUS.md` — update test count / passing test summary

## Acceptance Criteria

- [ ] Probe unit tests cover both happy path and error path for each probe
- [ ] `GetHealthUseCase` unit tests cover all status combinations
- [ ] Route inject tests cover auth (missing/wrong key) and response shape
- [ ] `admin-health.stack-e2e.test.ts` covers auth and shape — no hardcoded dependency statuses
- [ ] All tests are in the correct vitest config scope
- [ ] `pnpm test` passes (all unit tests)
- [ ] `pnpm test:integration-e2e` passes (stack E2E tests)
- [ ] Coverage floor (≥80%) maintained
