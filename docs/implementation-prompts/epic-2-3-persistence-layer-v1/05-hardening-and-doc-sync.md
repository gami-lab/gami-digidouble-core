# Prompt 05 — Hardening and Doc Sync

## Context

This is the final prompt in the EPIC 2.3 Persistence Layer v1 pack. It depends on all four
preceding prompts being applied and passing.

In this prompt you will:

1. Add a migration gate to CI — integration tests must wait for migrations to run.
2. Write a stack-level persistence verification test to confirm data survives a server restart.
3. Update `docs/DATA_MODEL.md` to reflect the implemented schema.
4. Update `docs/ARCHITECTURE.md` to reflect real persistence in the infrastructure layer.
5. Update `docs/PROJECT_STATUS.md` to mark EPIC 2.3 as Complete.

This prompt contains no new repositories or domain logic — only validation and documentation.

---

## Prerequisite Reading

Before writing any code or docs:

- `.github/workflows/ci.yml` — the full CI configuration; understand the existing gates.
- `apps/core/vitest.integration.config.ts` — integration test config.
- `docs/TEST_STRATEGY.md` — understand the stack-e2e tier and when it runs.
- `docs/DATA_MODEL.md` — current state; locate the sections to update.
- `docs/ARCHITECTURE.md` — current state; locate the infrastructure layer notes.
- `docs/PROJECT_STATUS.md` — current EPIC 2.3 row (line ~229): status is "Not started".
- `docker-compose.yml` — confirm the Postgres service name and port used in CI.

---

## What to Build

### 1. CI Migration Gate

**File:** `.github/workflows/ci.yml`

The integration test gate (the `main`-only job that runs `pnpm --filter @gami/core
test:integration-e2e`) must apply migrations before tests run. This is already handled by
`createTestSql()` from `test-helpers.ts` (each test file calls `runMigrations` in `beforeAll`),
so no explicit migration step is needed at the CI job level.

However, confirm that the CI workflow:

1. Has the Postgres service defined as a service container (or uses `docker compose` to start it).
2. Sets `DATABASE_URL` in the environment for the integration test step.
3. Waits for the Postgres service to be healthy before running tests (use a health-check command or
   a `wait-for-postgres` step).

If `DATABASE_URL` is not set in the integration CI step, add it. Example for a GitHub Actions
service container:

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    env:
      POSTGRES_DB: gami_core
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - 5432:5432
    options: >-
      --health-cmd pg_isready
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5

# In the test step:
env:
  DATABASE_URL: postgres://postgres:postgres@localhost:5432/gami_core
```

Read the existing CI file first and make the minimal change to add Postgres service + `DATABASE_URL`
to the integration gate. Do **not** change the PR fast gate — it must never touch the DB.

---

### 2. Stack-Level Persistence Verification

**File:** `apps/core/src/infrastructure/db/repositories/persistence.stack-e2e.test.ts`

This test confirms the persistence stack end-to-end: create a scenario, an avatar, a session, and
a message using the Postgres repositories, then read them back using separate repository instances
(simulating a "restart" by creating fresh repository objects backed by the same pool).

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { DB_AVAILABLE, createTestSql, truncateAllTables } from '../test-helpers.js'
import { PostgresScenarioRepository } from './postgres-scenario.repository.js'
import { PostgresAvatarRepository } from './postgres-avatar.repository.js'
import { PostgresSessionRepository } from './postgres-session.repository.js'
import { PostgresMessageRepository } from './postgres-message.repository.js'
import type { Sql } from 'postgres'

describe.skipIf(!DB_AVAILABLE)('Persistence stack — end-to-end', () => {
  let sql: Sql

  beforeAll(async () => {
    sql = await createTestSql()
  })

  afterAll(async () => {
    await truncateAllTables(sql)
    await sql.end()
  })

  it('persists the full conversation fixture across repository instances', async () => {
    // --- Write using first set of repository instances ---
    const scenarioRepo1 = new PostgresScenarioRepository(sql)
    const avatarRepo1 = new PostgresAvatarRepository(sql)
    const sessionRepo1 = new PostgresSessionRepository(sql)
    const messageRepo1 = new PostgresMessageRepository(sql)

    const scenario = await scenarioRepo1.create({
      name: 'Stack E2E Scenario',
      slug: 'stack-e2e-scenario',
      status: 'active',
    })

    const avatar = await avatarRepo1.create({
      scenarioId: scenario.scenarioId,
      name: 'Stack E2E Avatar',
      slug: 'stack-e2e-avatar',
      personaPrompt: 'You are a stack e2e avatar.',
      status: 'active',
    })

    const session = await sessionRepo1.create({
      userId: 'stack-e2e-user',
      scenarioId: scenario.scenarioId,
    })

    await messageRepo1.save({
      messageId: 'e2e00000-0000-0000-0000-000000000001',
      sessionId: session.sessionId,
      role: 'user',
      content: 'Hello from stack e2e!',
      createdAt: new Date().toISOString(),
    })

    // --- Read using fresh repository instances (simulates restart) ---
    const scenarioRepo2 = new PostgresScenarioRepository(sql)
    const avatarRepo2 = new PostgresAvatarRepository(sql)
    const sessionRepo2 = new PostgresSessionRepository(sql)
    const messageRepo2 = new PostgresMessageRepository(sql)

    const foundScenario = await scenarioRepo2.findById(scenario.scenarioId)
    const foundAvatar = await avatarRepo2.findById(avatar.avatarId)
    const foundSession = await sessionRepo2.findById(session.sessionId)
    const foundMessages = await messageRepo2.findBySessionId(session.sessionId)

    expect(foundScenario).not.toBeNull()
    expect(foundScenario!.name).toBe('Stack E2E Scenario')

    expect(foundAvatar).not.toBeNull()
    expect(foundAvatar!.personaPrompt).toBe('You are a stack e2e avatar.')

    expect(foundSession).not.toBeNull()
    expect(foundSession!.userId).toBe('stack-e2e-user')

    expect(foundMessages).toHaveLength(1)
    expect(foundMessages[0]!.content).toBe('Hello from stack e2e!')
  })
})
```

> **Note on test file naming:** The vitest integration config includes `*.integration.test.ts` and
> `*.e2e.test.ts` files. This file uses `*.stack-e2e.test.ts` — confirm the integration config
> also includes this pattern, or rename the file to `persistence.e2e.test.ts` to match the
> existing pattern. Do **not** create a new vitest config for this — minimise infra.

---

### 3. Update `docs/DATA_MODEL.md`

Find the section for each entity (Scenario, Avatar, Session, Message) and add or update an
**"Implementation Status"** subsection confirming:

- The table name
- The migration file (`001_initial_schema.sql`)
- The Postgres repository class
- Any notable deviations from the planned schema (e.g., `adjustments` not persisted in Phase A)

Example for Scenario:

```markdown
### Implementation Status (EPIC 2.3)

- **Table:** `scenarios`
- **Migration:** `apps/core/src/infrastructure/db/migrations/001_initial_schema.sql`
- **Repository:** `PostgresScenarioRepository`
- **Status:** Fully implemented.
```

For Avatar, add a note about `adjustments`:

```markdown
### Implementation Status (EPIC 2.3)

- **Table:** `avatars`
- **Migration:** `apps/core/src/infrastructure/db/migrations/001_initial_schema.sql`
- **Repository:** `PostgresAvatarRepository`
- **Status:** Fully implemented. The `adjustments` field (runtime-only, from `AvatarConfig`) is
  not persisted in Phase A — it is an in-memory concern only. Add a `TEXT[]` column via a new
  migration in a future sprint if persistence is required.
```

---

### 4. Update `docs/ARCHITECTURE.md`

Find the section describing the infrastructure layer (should reference the `infrastructure/db/`
module). Update it to note:

- PostgreSQL is now the production data store, connected via `postgres` (postgres.js).
- The DB client singleton is in `infrastructure/db/client.ts`.
- Migrations run at startup via `infrastructure/db/migrations/runner.ts`.
- All four Postgres repositories are in `infrastructure/db/repositories/`.
- In-memory stubs remain available for unit tests — they are injected via `ServerAdapters`, never
  instantiated by `createServer` itself.

Keep the update concise (a short paragraph or bullet list is sufficient). Do **not** rewrite the
full document.

---

### 5. Update `docs/PROJECT_STATUS.md`

1. Change the EPIC 2.3 status row from `Not started` to `Complete`.
2. Update the "Last updated" date.
3. Add a bullet point in the "Database persistence" section (or create one if it does not exist)
   summarising what was implemented:

```markdown
**Persistence Layer (EPIC 2.3):**

- `PostgresScenarioRepository`, `PostgresAvatarRepository`, `PostgresSessionRepository`,
  `PostgresMessageRepository` replace in-memory stubs in production
- `postgres` (postgres.js) client with lazy singleton pool (`max: 10`)
- SQL migrations in `apps/core/src/infrastructure/db/migrations/`; applied at server startup
- All four repos have integration tests (`*.integration.test.ts`)
- `AvatarConfig` now carries `createdAt` / `updatedAt` (F-01 fix)
- `CreateAvatarUseCase` no longer synthesises timestamps
- Stack-level persistence verified by `persistence.e2e.test.ts`
```

---

## Running the Full Test Suite

```bash
# Unit tests (no DB required)
pnpm test

# Integration + E2E tests (requires docker compose up -d)
cd apps/core
DATABASE_URL=postgres://postgres:postgres@localhost:5432/gami_core pnpm test:integration-e2e
```

Expected results:

- All 146 unit tests pass.
- All 4 repository integration test suites pass.
- `persistence.e2e.test.ts` passes.

---

## Acceptance Criteria

- [ ] CI integration gate has Postgres service container and `DATABASE_URL` env var set.
- [ ] CI PR fast gate does **not** have `DATABASE_URL` — it must never touch DB.
- [ ] `persistence.e2e.test.ts` (or `persistence.stack-e2e.test.ts`) exists and passes.
- [ ] `docs/DATA_MODEL.md` has implementation status for all four entities.
- [ ] `docs/ARCHITECTURE.md` updated with real postgres/postgres.js wiring notes.
- [ ] `docs/PROJECT_STATUS.md` EPIC 2.3 status = Complete; date updated.
- [ ] All 146 unit tests pass.
- [ ] All integration and e2e tests pass against a real Postgres instance.
- [ ] No `any`, no implicit types across all files touched in this EPIC.
- [ ] No source file exceeds 300 lines; no function exceeds 50 lines.

---

## EPIC 2.3 — Full Definition of Done Checklist

Review the README.md for this prompt pack and verify every item is ticked before closing the EPIC.
