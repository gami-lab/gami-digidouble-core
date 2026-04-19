# Prompt 02 — Postgres Scenario and Avatar Repositories

## Context

This is the second prompt in the EPIC 2.3 Persistence Layer v1 pack. It depends on the DB client,
migration runner, and initial schema from **Prompt 01**.

In this prompt you will:

1. Implement `PostgresScenarioRepository` — the Postgres persistence adapter for scenarios.
2. Implement `PostgresAvatarRepository` — the Postgres persistence adapter for avatars.
3. Update `AvatarConfig` to include `createdAt: string` and `updatedAt: string`, resolving finding
   **F-01** from the EPIC 2.2 audit.
4. Update `CreateAvatarUseCase` to remove the synthetic timestamp — read it from the returned
   entity instead.
5. Write integration tests for both repositories.

Leave the codebase fully passing before handing off to Prompt 03.

---

## Prerequisite Reading

Before writing any code:

- `docs/ARCHITECTURE.md` — layer rules; infrastructure never imports from application.
- `docs/DATA_MODEL.md` — authoritative column names; map them to domain field names precisely.
- `apps/core/src/domain/avatar/avatar.types.ts` — `AvatarConfig` and `Avatar` types.
- `apps/core/src/domain/scenario/scenario.types.ts` — `Scenario` and `ScenarioConfig` types.
- `apps/core/src/application/ports/IAvatarRepository.ts` — the interface to implement.
- `apps/core/src/application/ports/IScenarioRepository.ts` — the interface to implement.
- `apps/core/src/application/use-cases/create-avatar/create-avatar.use-case.ts` — the F-01 synthesis code to remove.
- `apps/core/src/application/use-cases/create-avatar/create-avatar.types.ts` — `CreateAvatarOutput` shape.
- `apps/core/src/infrastructure/db/client.ts` — the `getDbClient` singleton from Prompt 01.
- `apps/core/src/infrastructure/db/test-helpers.ts` — `DB_AVAILABLE`, `createTestSql`, `truncateAllTables`.
- `apps/core/vitest.integration.config.ts` — the integration test vitest config.

---

## What to Build

### 1. Update `AvatarConfig` — Add Timestamps (F-01 Fix)

**File:** `apps/core/src/domain/avatar/avatar.types.ts`

Add `createdAt: string` and `updatedAt: string` to the `AvatarConfig` interface. These fields are
now sourced from the database, not synthesised by the application.

```typescript
export interface AvatarConfig {
  avatarId: string
  scenarioId: string
  name: string
  slug: string
  status: AvatarStatus
  personaPrompt: string
  tone?: string
  description?: string
  adjustments?: string[]
  config?: Record<string, unknown>
  createdAt: string // ← NEW: DB-generated, ISO 8601 UTC
  updatedAt: string // ← NEW: DB-generated, ISO 8601 UTC
}
```

> **Note on `InMemoryAvatarRepository`:** The `InMemoryAvatarRepository` must be updated to
> synthesise the timestamps (using `new Date().toISOString()`) because it has no DB to source them
> from. This is a temporary measure — the in-memory stubs exist only for unit tests. The unit tests
> themselves do not assert timestamp values beyond existence, so this change must not break them.

---

### 2. Update `InMemoryAvatarRepository`

**File:** `apps/core/src/infrastructure/db/` (find the actual in-memory avatar repo file)

After adding timestamps to `AvatarConfig`, the in-memory repository's `create` method must return
them. Synthesise them as `new Date().toISOString()` at the time of creation.

Read the existing file first — do not guess at the structure.

---

### 3. Update `CreateAvatarUseCase` — Remove Timestamp Synthesis

**File:** `apps/core/src/application/use-cases/create-avatar/create-avatar.use-case.ts`

The current code synthesises a `now` timestamp before calling the repository, then passes it to
`mapAvatarOutput`. After this change, `AvatarConfig` carries `createdAt` / `updatedAt` directly,
so the synthesis is no longer needed.

Changes:

1. Remove `const now = new Date().toISOString()`
2. Remove the `timestamp: string` parameter from `mapAvatarOutput`.
3. Update `mapAvatarOutput` to read `avatar.createdAt` and `avatar.updatedAt` directly.
4. Update the call site in `execute()` accordingly.

The function signature change:

```typescript
// Before
function mapAvatarOutput(
  avatar: Awaited<ReturnType<IAvatarRepository['create']>>,
  timestamp: string,
): CreateAvatarOutput['avatar']

// After
function mapAvatarOutput(
  avatar: Awaited<ReturnType<IAvatarRepository['create']>>,
): CreateAvatarOutput['avatar']
```

And the body:

```typescript
function mapAvatarOutput(
  avatar: Awaited<ReturnType<IAvatarRepository['create']>>,
): CreateAvatarOutput['avatar'] {
  return {
    avatarId: avatar.avatarId,
    scenarioId: avatar.scenarioId,
    name: avatar.name,
    slug: avatar.slug,
    status: avatar.status,
    personaPrompt: avatar.personaPrompt,
    ...(avatar.tone !== undefined ? { tone: avatar.tone } : {}),
    ...(avatar.description !== undefined ? { description: avatar.description } : {}),
    ...(avatar.adjustments !== undefined ? { adjustments: avatar.adjustments } : {}),
    createdAt: avatar.createdAt,
    updatedAt: avatar.updatedAt,
  }
}
```

After this change run the unit tests to confirm nothing is broken: the existing tests already
assert `createdAt` and `updatedAt` are present in the output; they should continue to pass because
the in-memory stub now synthesises the values.

---

### 4. Implement `PostgresScenarioRepository`

**File:** `apps/core/src/infrastructure/db/repositories/postgres-scenario.repository.ts`

```typescript
import type { Sql } from 'postgres'
import type {
  IScenarioRepository,
  CreateScenarioParams,
} from '../../../application/ports/IScenarioRepository.js'
import type { Scenario } from '../../../domain/scenario/scenario.types.js'

interface ScenarioRow {
  id: string
  name: string
  slug: string
  status: string
  config: Record<string, unknown>
  created_at: Date
  updated_at: Date
}

function rowToScenario(row: ScenarioRow): Scenario {
  return {
    scenarioId: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status as Scenario['status'],
    config: row.config as Scenario['config'],
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

export class PostgresScenarioRepository implements IScenarioRepository {
  constructor(private readonly sql: Sql) {}

  async create(params: CreateScenarioParams): Promise<Scenario> {
    const [row] = await this.sql<[ScenarioRow]>`
      INSERT INTO scenarios (name, slug, status, config)
      VALUES (
        ${params.name},
        ${params.slug},
        ${params.status ?? 'draft'},
        ${this.sql.json(params.config ?? {})}
      )
      RETURNING id, name, slug, status, config, created_at, updated_at
    `
    return rowToScenario(row)
  }

  async findById(scenarioId: string): Promise<Scenario | null> {
    const [row] = await this.sql<[ScenarioRow?]>`
      SELECT id, name, slug, status, config, created_at, updated_at
      FROM scenarios
      WHERE id = ${scenarioId}
    `
    return row ? rowToScenario(row) : null
  }
}
```

Rules:

- Do **not** import or use `getDbClient` inside the repository — the `Sql` instance is injected
  via the constructor. Repositories receive the db connection; they do not create it.
- All queries use tagged template literals — never string concatenation.
- `this.sql.json()` wraps JSONB values.
- `status` cast uses `as Scenario['status']` — the DB stores a plain `TEXT`; trust that the
  application layer only writes valid enum values.
- File must be ≤ 300 lines; each method ≤ 50 lines.

---

### 5. Implement `PostgresAvatarRepository`

**File:** `apps/core/src/infrastructure/db/repositories/postgres-avatar.repository.ts`

```typescript
import type { Sql } from 'postgres'
import type {
  IAvatarRepository,
  CreateAvatarParams,
} from '../../../application/ports/IAvatarRepository.js'
import type { AvatarConfig } from '../../../domain/avatar/avatar.types.js'

interface AvatarRow {
  id: string
  scenario_id: string
  name: string
  slug: string
  status: string
  persona_prompt: string
  tone: string | null
  description: string | null
  config: Record<string, unknown>
  created_at: Date
  updated_at: Date
}

function rowToAvatarConfig(row: AvatarRow): AvatarConfig {
  return {
    avatarId: row.id,
    scenarioId: row.scenario_id,
    name: row.name,
    slug: row.slug,
    status: row.status as AvatarConfig['status'],
    personaPrompt: row.persona_prompt,
    ...(row.tone !== null ? { tone: row.tone } : {}),
    ...(row.description !== null ? { description: row.description } : {}),
    config: row.config,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  }
}

export class PostgresAvatarRepository implements IAvatarRepository {
  constructor(private readonly sql: Sql) {}

  async create(params: CreateAvatarParams): Promise<AvatarConfig> {
    const [row] = await this.sql<[AvatarRow]>`
      INSERT INTO avatars (
        scenario_id, name, slug, status,
        persona_prompt, tone, description, config
      )
      VALUES (
        ${params.scenarioId},
        ${params.name},
        ${params.slug},
        ${params.status ?? 'active'},
        ${params.personaPrompt},
        ${params.tone ?? null},
        ${params.description ?? null},
        ${this.sql.json(params.config ?? {})}
      )
      RETURNING
        id, scenario_id, name, slug, status,
        persona_prompt, tone, description, config,
        created_at, updated_at
    `
    return rowToAvatarConfig(row)
  }

  async findById(avatarId: string): Promise<AvatarConfig | null> {
    const [row] = await this.sql<[AvatarRow?]>`
      SELECT
        id, scenario_id, name, slug, status,
        persona_prompt, tone, description, config,
        created_at, updated_at
      FROM avatars
      WHERE id = ${avatarId}
    `
    return row ? rowToAvatarConfig(row) : null
  }
}
```

> **Note on `adjustments`:** The `avatars` table does not have an `adjustments` column in the
> initial schema — this field is runtime-only (stored in `AvatarConfig` but not persisted to the
> DB in Phase A). The `create` method simply ignores `params.adjustments` for now. If needed in a
> future phase, an `adjustments TEXT[]` column can be added via a new migration. Log this as a
> known gap in a code comment.

---

### 6. Write Integration Tests — Scenario Repository

**File:** `apps/core/src/infrastructure/db/repositories/postgres-scenario.repository.integration.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { DB_AVAILABLE, createTestSql, truncateAllTables } from '../test-helpers.js'
import { PostgresScenarioRepository } from './postgres-scenario.repository.js'
import type { Sql } from 'postgres'

describe.skipIf(!DB_AVAILABLE)('PostgresScenarioRepository', () => {
  let sql: Sql
  let repo: PostgresScenarioRepository

  beforeAll(async () => {
    sql = await createTestSql()
    repo = new PostgresScenarioRepository(sql)
  })

  afterEach(async () => {
    await truncateAllTables(sql)
  })

  afterAll(async () => {
    await sql.end()
  })

  it('creates a scenario and returns it with generated id and timestamps', async () => {
    const result = await repo.create({
      name: 'Test Scenario',
      slug: 'test-scenario',
    })

    expect(result.scenarioId).toBeTypeOf('string')
    expect(result.name).toBe('Test Scenario')
    expect(result.slug).toBe('test-scenario')
    expect(result.status).toBe('draft')
    expect(result.createdAt).toBeTypeOf('string')
    expect(result.updatedAt).toBeTypeOf('string')
  })

  it('creates a scenario with explicit status and config', async () => {
    const result = await repo.create({
      name: 'Active Scenario',
      slug: 'active-scenario',
      status: 'active',
      config: { language: 'fr' },
    })

    expect(result.status).toBe('active')
    expect(result.config).toEqual({ language: 'fr' })
  })

  it('findById returns the scenario by its id', async () => {
    const created = await repo.create({ name: 'Findable', slug: 'findable' })
    const found = await repo.findById(created.scenarioId)

    expect(found).not.toBeNull()
    expect(found!.scenarioId).toBe(created.scenarioId)
    expect(found!.name).toBe('Findable')
  })

  it('findById returns null for a non-existent id', async () => {
    const result = await repo.findById('00000000-0000-0000-0000-000000000000')
    expect(result).toBeNull()
  })

  it('enforces unique slug constraint', async () => {
    await repo.create({ name: 'First', slug: 'same-slug' })
    await expect(repo.create({ name: 'Second', slug: 'same-slug' })).rejects.toThrow()
  })
})
```

---

### 7. Write Integration Tests — Avatar Repository

**File:** `apps/core/src/infrastructure/db/repositories/postgres-avatar.repository.integration.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { DB_AVAILABLE, createTestSql, truncateAllTables } from '../test-helpers.js'
import { PostgresScenarioRepository } from './postgres-scenario.repository.js'
import { PostgresAvatarRepository } from './postgres-avatar.repository.js'
import type { Sql } from 'postgres'

describe.skipIf(!DB_AVAILABLE)('PostgresAvatarRepository', () => {
  let sql: Sql
  let scenarioRepo: PostgresScenarioRepository
  let avatarRepo: PostgresAvatarRepository
  let scenarioId: string

  beforeAll(async () => {
    sql = await createTestSql()
    scenarioRepo = new PostgresScenarioRepository(sql)
    avatarRepo = new PostgresAvatarRepository(sql)
    const scenario = await scenarioRepo.create({ name: 'Harness', slug: 'harness' })
    scenarioId = scenario.scenarioId
  })

  afterEach(async () => {
    // Truncate only avatars to reuse the scenario across tests
    await sql`TRUNCATE avatars CASCADE`
  })

  afterAll(async () => {
    await truncateAllTables(sql)
    await sql.end()
  })

  it('creates an avatar and returns it with generated id and timestamps', async () => {
    const result = await avatarRepo.create({
      scenarioId,
      name: 'Test Avatar',
      slug: 'test-avatar',
      personaPrompt: 'You are a test avatar.',
    })

    expect(result.avatarId).toBeTypeOf('string')
    expect(result.scenarioId).toBe(scenarioId)
    expect(result.name).toBe('Test Avatar')
    expect(result.slug).toBe('test-avatar')
    expect(result.status).toBe('active')
    expect(result.personaPrompt).toBe('You are a test avatar.')
    expect(result.createdAt).toBeTypeOf('string')
    expect(result.updatedAt).toBeTypeOf('string')
  })

  it('creates an avatar with optional fields', async () => {
    const result = await avatarRepo.create({
      scenarioId,
      name: 'Rich Avatar',
      slug: 'rich-avatar',
      personaPrompt: 'You are rich.',
      tone: 'formal',
      description: 'A formal avatar.',
    })

    expect(result.tone).toBe('formal')
    expect(result.description).toBe('A formal avatar.')
  })

  it('tone and description are undefined (not null) when absent', async () => {
    const result = await avatarRepo.create({
      scenarioId,
      name: 'Sparse Avatar',
      slug: 'sparse-avatar',
      personaPrompt: 'Sparse.',
    })

    expect(result.tone).toBeUndefined()
    expect(result.description).toBeUndefined()
  })

  it('findById returns the avatar by its id', async () => {
    const created = await avatarRepo.create({
      scenarioId,
      name: 'Findable Avatar',
      slug: 'findable-avatar',
      personaPrompt: 'Find me.',
    })
    const found = await avatarRepo.findById(created.avatarId)

    expect(found).not.toBeNull()
    expect(found!.avatarId).toBe(created.avatarId)
  })

  it('findById returns null for a non-existent id', async () => {
    const result = await avatarRepo.findById('00000000-0000-0000-0000-000000000000')
    expect(result).toBeNull()
  })
})
```

---

## Running the Tests

```bash
# Unit tests — must remain fully green
cd /path/to/monorepo
pnpm test

# Integration tests — requires a running Postgres (docker compose up -d)
cd apps/core
DATABASE_URL=postgres://postgres:postgres@localhost:5432/gami_core pnpm test:integration
```

---

## Acceptance Criteria

- [ ] `AvatarConfig` has `createdAt: string` and `updatedAt: string`.
- [ ] `InMemoryAvatarRepository.create` synthesises `createdAt` / `updatedAt`.
- [ ] `CreateAvatarUseCase` no longer synthesises `now`; `mapAvatarOutput` reads timestamps from
      the returned avatar.
- [ ] All 146 existing unit tests pass without change.
- [ ] `PostgresScenarioRepository` implements `IScenarioRepository`; compiles in strict mode.
- [ ] `PostgresAvatarRepository` implements `IAvatarRepository`; compiles in strict mode.
- [ ] Both integration test files exist; each test is guarded by `describe.skipIf(!DB_AVAILABLE)`.
- [ ] Integration tests pass against a real Postgres instance.
- [ ] `tone` and `description` are returned as `undefined` (not `null`) when absent.
- [ ] No `any`, no implicit types.
- [ ] No source file exceeds 300 lines; no function exceeds 50 lines.
