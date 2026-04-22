# 02 — Dependency Probe Implementations

## Context

With the domain model in place (prompt 01), this prompt implements the three concrete probes: Postgres, Redis, and LLM. Each probe implements `IDependencyProbe` and is self-contained in the infrastructure layer.

## Scope

**In scope:**

- `PostgresProbe` — runs a lightweight DB query (`SELECT 1`) and measures latency
- `RedisProbe` — issues a `PING` command and measures latency
- `LlmProbe` — checks that the configured LLM adapter is reachable (model list or echo call)
- `NullProbe` — always returns `healthy` with zero latency (for unit tests)
- All probes catch their own errors and return `degraded` with `message` set — they never throw

**Out of scope:**

- HTTP endpoint (prompt 03)
- Registration/wiring into the server (prompt 03)
- Tests beyond basic smoke (prompt 04)

## Relevant Docs

- `docs/ARCHITECTURE.md` — probes live in `infrastructure/`
- `docs/TECH_STACK.md` — Postgres: `postgres.js`; Redis: `ioredis`
- `apps/core/src/infrastructure/db/client.ts` — existing Postgres singleton
- `apps/core/src/infrastructure/cache/index.ts` — existing Redis placeholder
- `apps/core/src/application/ports/IDependencyProbe.ts` (from prompt 01)

## Implementation Guidance

### File locations

```
apps/core/src/infrastructure/health/
  postgres.probe.ts
  redis.probe.ts
  llm.probe.ts
  null.probe.ts
  index.ts
```

### PostgresProbe

- Constructor receives a `Sql` instance from `postgres.js`
- `probe()` runs `sql\`SELECT 1\``inside a`try/catch`
- Measures latency with `Date.now()` before and after
- On success: `{ name: 'postgres', status: 'healthy', latencyMs }`
- On error: `{ name: 'postgres', status: 'degraded', latencyMs, message: error.message }`

### RedisProbe

- Constructor receives an `ioredis` client instance
- `probe()` calls `client.ping()` and expects `'PONG'`
- Same latency measurement and catch pattern as Postgres
- On unexpected response: treat as `degraded`

The Redis client in `apps/core/src/infrastructure/cache/index.ts` may be a placeholder. If `ioredis` is not yet installed, install it and implement a minimal `getRedisClient(url: string): Redis` factory following the same singleton pattern as the DB client.

### LlmProbe

- Constructor receives an `ILlmAdapter` instance
- `probe()` sends a minimal, cheap LLM call — a single-token system ping:
  ```ts
  adapter.complete({
    systemPrompt: 'ping',
    messages: [{ role: 'user', content: 'ping' }],
    maxTokens: 1,
  })
  ```
- On success: `{ name: 'llm', status: 'healthy', latencyMs }`
- On `LlmError`: `{ name: 'llm', status: 'degraded', message: error.message, latencyMs }`
- When the app uses `NullLlmAdapter`, always return `healthy` (the null adapter never fails)

**Note on `maxTokens`:** the `ILlmAdapter.complete()` call signature may not yet include `maxTokens`. If it doesn't, add the optional field `maxTokens?: number` to `LlmRequest` in `application/ports/ILlmAdapter.ts`. Each concrete adapter should pass it through to the provider SDK when present.

### NullProbe

- Constructor accepts a `name: string` parameter
- Always resolves: `{ name, status: 'healthy', latencyMs: 0 }`
- Used in unit tests to inject predictable results

### index.ts

Export all four probes so consumers import from one place.

## Constraints

- Probes must never throw — all errors must be caught and converted to `degraded` status
- No latency probe should timeout under 5 seconds; consider wrapping in `Promise.race` with a 3-second timeout that returns `{ status: 'degraded', message: 'probe timed out' }`
- Keep probes stateless — constructors accept dependencies, no mutable state
- LLM probe should use the cheapest possible call; avoid streaming

## Deliverables

- `apps/core/src/infrastructure/health/postgres.probe.ts`
- `apps/core/src/infrastructure/health/redis.probe.ts`
- `apps/core/src/infrastructure/health/llm.probe.ts`
- `apps/core/src/infrastructure/health/null.probe.ts`
- `apps/core/src/infrastructure/health/index.ts`
- `apps/core/src/infrastructure/cache/index.ts` updated with real `ioredis` client if not yet done
- `apps/core/src/application/ports/ILlmAdapter.ts` updated with `maxTokens?: number` if absent

## Mandatory Final Step — Documentation Update

After implementation:

- `docs/PROJECT_STATUS.md` — no user-visible change yet; update only if a new module is worth noting
- If `ioredis` is added: update `docs/TECH_STACK.md` Redis section to confirm the dependency is now wired

## Acceptance Criteria

- [ ] All three concrete probes implement `IDependencyProbe`
- [ ] Each probe catches its own errors and returns `degraded` — never throws
- [ ] Each probe includes a latency measurement in milliseconds
- [ ] `NullProbe` always returns `healthy` and is usable in unit tests
- [ ] Probes time out after ≤ 3 seconds
- [ ] `pnpm lint`, `pnpm typecheck` pass
