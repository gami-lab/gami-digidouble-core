# Prompt 04 — Server Wiring

## Context

This is the fourth prompt in the EPIC 2.3 Persistence Layer v1 pack. It depends on:

- **Prompt 01** — DB client (`getDbClient`, `closeDbClient`) and migration runner.
- **Prompts 02 and 03** — all four Postgres repository implementations.

In this prompt you will:

1. Update `apps/core/src/infrastructure/db/index.ts` to export all four Postgres repositories and
   remove the stale placeholder comment.
2. Update `apps/core/src/index.ts` (the server entry point) to wire Postgres repositories when
   `NODE_ENV !== 'test'`, running migrations at startup.
3. Register a Fastify `onClose` hook to gracefully close the DB pool on shutdown.
4. Update `apps/core/src/api/server.ts` with no logic changes — only ensure `InMemoryScenarioRepository`
   fallback in `createServer` is replaced by a proper wiring convention.

Leave the codebase fully passing before handing off to Prompt 05.

---

## Prerequisite Reading

Before writing any code, read the following files in full:

- `apps/core/src/index.ts` — the entry point; this is where DB pool creation and migration must be
  added.
- `apps/core/src/api/server.ts` — `createServer` and `ServerAdapters`; understand the current
  fallback to `InMemoryScenarioRepository`.
- `apps/core/src/infrastructure/db/index.ts` — current state; stale comment.
- `apps/core/src/infrastructure/db/client.ts` — `getDbClient`, `closeDbClient` from Prompt 01.
- `apps/core/src/infrastructure/db/migrations/runner.ts` — `runMigrations` from Prompt 01.
- `apps/core/src/config.ts` — `config.databaseUrl`, `config.nodeEnv`.

---

## What to Build

### 1. Update `infrastructure/db/index.ts`

Remove the stale placeholder comment. Export all four Postgres repositories alongside the existing
in-memory exports.

```typescript
// DB adapters — infrastructure layer
// In-memory stubs are used in unit tests (injected via ServerAdapters).
// Postgres repositories are wired in production via apps/core/src/index.ts.
export { InMemoryAvatarRepository } from './in-memory-avatar.repository.js'
export { InMemorySessionRepository } from './in-memory-session.repository.js'
export { InMemoryMessageRepository } from './in-memory-message.repository.js'
export { InMemoryScenarioRepository } from './in-memory-scenario.repository.js'
export { PostgresScenarioRepository } from './repositories/postgres-scenario.repository.js'
export { PostgresAvatarRepository } from './repositories/postgres-avatar.repository.js'
export { PostgresSessionRepository } from './repositories/postgres-session.repository.js'
export { PostgresMessageRepository } from './repositories/postgres-message.repository.js'
export { getDbClient, closeDbClient } from './client.js'
export { runMigrations } from './migrations/runner.js'
```

Rules:

- Both in-memory and Postgres repos are exported — the entry point decides which to wire.
- Do **not** remove in-memory exports; unit tests injecting stubs still compile against these.

---

### 2. Update `apps/core/src/index.ts` — Wire Postgres in Production

This is the key change of this prompt. The entry point must create a DB pool, run migrations, and
pass real Postgres repositories to `createServer`.

```typescript
import { loadConfig } from './config.js'
import { createServer } from './api/server.js'
import { createObservabilityAdapter } from './infrastructure/observability/index.js'
import {
  getDbClient,
  closeDbClient,
  runMigrations,
  PostgresScenarioRepository,
  PostgresAvatarRepository,
  PostgresSessionRepository,
  PostgresMessageRepository,
} from './infrastructure/db/index.js'

async function main(): Promise<void> {
  const config = loadConfig()
  const observability = createObservabilityAdapter(config)

  const sql = getDbClient(config.databaseUrl)
  await runMigrations(sql)

  const adapters = {
    observabilityAdapter: observability,
    scenarioRepository: new PostgresScenarioRepository(sql),
    avatarRepository: new PostgresAvatarRepository(sql),
    sessionRepository: new PostgresSessionRepository(sql),
    messageRepository: new PostgresMessageRepository(sql),
  }

  const server = createServer(config, adapters)

  server.addHook('onClose', async () => {
    await closeDbClient()
    await observability.flush()
  })

  async function shutdown(): Promise<void> {
    await server.close()
    process.exit(0)
  }

  process.on('SIGTERM', () => void shutdown())
  process.on('SIGINT', () => void shutdown())

  try {
    await server.listen({ port: config.port, host: config.host })
  } catch (err) {
    server.log.error(err)
    await server.close()
    process.exit(1)
  }
}

await main()
```

Key rules:

- `runMigrations` is awaited before the server starts listening — no traffic is accepted before
  the schema is up to date.
- `closeDbClient` is called in the `onClose` hook — it runs on `server.close()` which is called in
  `shutdown()`, ensuring the pool is drained before the process exits.
- The old `process.exit(0)` in `shutdown` is preserved; `onClose` runs synchronously to completion
  before the process exits because `server.close()` is awaited.
- Do **not** add a `NODE_ENV` branch here — the entry point is always production. Unit tests never
  call `main()`; they instantiate `createServer` directly with mocked adapters.

---

### 3. Update `apps/core/src/api/server.ts` — Remove the InMemoryScenarioRepository Fallback

The current `server.ts` has a fallback for `scenarioRepository`:

```typescript
scenarioRepository: adapters.scenarioRepository ?? new InMemoryScenarioRepository(),
```

This fallback was added during EPIC 2.2 because `InMemoryScenarioRepository` had not yet been
introduced formally. Now that the entry point always passes a real `scenarioRepository`, the
fallback is unnecessary and creates a hidden coupling between `server.ts` and infrastructure.

**Change:** Remove the `InMemoryScenarioRepository` import and the `?? new InMemoryScenarioRepository()`
fallback. Pass `adapters.scenarioRepository` directly to `scenariosRoute`. If it is absent (test
scenarios where callers pass partial adapters), the route will simply have `undefined` and rely on
the route's own initialization — which already handles the absent case via its own defaults.

Read the current `server.ts` file before making this change to see the exact lines to modify.

```typescript
// Before
import { InMemoryScenarioRepository } from '../infrastructure/db/in-memory-scenario.repository.js'
// ...
app.register(scenariosRoute, {
  prefix: '/v1/scenarios',
  config,
  scenarioRepository: adapters.scenarioRepository ?? new InMemoryScenarioRepository(),
  ...(adapters.avatarRepository !== undefined
    ? { avatarRepository: adapters.avatarRepository }
    : {}),
})

// After
app.register(scenariosRoute, {
  prefix: '/v1/scenarios',
  config,
  ...adapters,
})
```

> **Important:** Before making this change, read `apps/core/src/api/routes/scenarios.ts` to
> confirm how it receives `scenarioRepository` and whether spreading `adapters` directly into the
> route options is compatible with its type contract. If the route uses a specific options shape,
> keep the explicit spread pattern instead of the short `...adapters` form.

---

### 4. Verify Unit Tests Pass Without Change

After these changes, run the full unit test suite:

```bash
pnpm test
```

The unit tests use the following pattern (from `*.e2e.test.ts` and `*.test.ts` files): they call
`createServer(config, { llmAdapter: mockAdapter, ... })` with in-memory adapters. Since
`createServer` still accepts `ServerAdapters` and does not instantiate any real DB client, all
unit tests must continue to pass unchanged.

If any unit test fails because it relied on the `InMemoryScenarioRepository` fallback inside
`server.ts`, update that test to pass an `InMemoryScenarioRepository` explicitly via
`ServerAdapters`. Do not restore the fallback in `server.ts`.

---

### 5. Smoke-Test the Full Stack Locally

```bash
docker compose up -d          # start Postgres and Redis
cd apps/core
pnpm dev                      # should start without errors; migrations run at startup
```

Verify the startup log shows no migration errors and the health endpoint responds:

```bash
curl http://localhost:3000/health
# {"ok":true}
```

---

## Acceptance Criteria

- [ ] `infrastructure/db/index.ts` exports all four Postgres repositories, `getDbClient`,
      `closeDbClient`, `runMigrations`; stale "EPIC 3.2" comment removed.
- [ ] `apps/core/src/index.ts` creates a DB pool, runs migrations, and wires all four Postgres
      repositories into `ServerAdapters`.
- [ ] `closeDbClient` is registered as a Fastify `onClose` hook — fires on `server.close()`.
- [ ] `server.ts` no longer imports or references `InMemoryScenarioRepository`.
- [ ] All 146 existing unit tests pass: `pnpm test` exits 0.
- [ ] Server starts cleanly locally with `docker compose up -d` + `pnpm dev`.
- [ ] No `any`, no implicit types.
- [ ] No source file exceeds 300 lines.
