# Prompt 03 — Postgres Session and Message Repositories

## Context

This is the third prompt in the EPIC 2.3 Persistence Layer v1 pack. It depends on:

- **Prompt 01** — DB client, migration runner, and schema (`sessions` and `messages` tables).
- **Prompt 02** — `PostgresScenarioRepository` (needed as a dependency in integration tests because
  sessions reference a scenario, and messages reference a session).

In this prompt you will:

1. Implement `PostgresSessionRepository` for `ISessionRepository`.
2. Implement `PostgresMessageRepository` for `IMessageRepository`.
3. Write integration tests for both repositories.

Leave the codebase fully passing before handing off to Prompt 04.

---

## Prerequisite Reading

Before writing any code:

- `apps/core/src/application/ports/ISessionRepository.ts` — the interface to implement; note
  `create`, `findById`, `update`, `delete`.
- `apps/core/src/application/ports/IMessageRepository.ts` — the interface to implement; note
  `save`, `findBySessionId`, `deleteBySessionId`.
- `apps/core/src/domain/conversation/session.types.ts` — `Session`, `Message`, `MessageMetadata`
  types; every field must be mapped correctly.
- `apps/core/src/infrastructure/db/client.ts` — `getDbClient` singleton.
- `apps/core/src/infrastructure/db/test-helpers.ts` — test utilities.
- `apps/core/src/infrastructure/db/repositories/postgres-scenario.repository.ts` — reference for
  the constructor injection pattern and row-mapping style.

---

## What to Build

### 1. Implement `PostgresSessionRepository`

**File:** `apps/core/src/infrastructure/db/repositories/postgres-session.repository.ts`

#### Port contract recap

```typescript
export interface ISessionRepository {
  create(params: CreateSessionParams): Promise<Session>
  findById(sessionId: string): Promise<Session | null>
  update(sessionId: string, updates: UpdateSessionParams): Promise<Session>
  delete(sessionId: string): Promise<void>
}

export interface CreateSessionParams {
  userId: string
  scenarioId: string
}

export interface UpdateSessionParams {
  status?: Session['status']
  lastActivityAt?: string
  endedAt?: string
}
```

Read the actual file at `apps/core/src/application/ports/ISessionRepository.ts` to confirm the
current shape before writing the implementation.

#### Domain type recap

```typescript
export interface Session {
  sessionId: string
  userId: string
  scenarioId: string
  status: 'active' | 'paused' | 'ended'
  startedAt: string // ISO 8601 UTC
  lastActivityAt: string // ISO 8601 UTC
  endedAt?: string // ISO 8601 UTC, nullable
}
```

#### Implementation guidelines

```typescript
import type { Sql } from 'postgres'
import type {
  ISessionRepository,
  CreateSessionParams,
  UpdateSessionParams,
} from '../../../application/ports/ISessionRepository.js'
import type { Session } from '../../../domain/conversation/session.types.js'

interface SessionRow {
  id: string
  user_id: string
  scenario_id: string
  status: string
  started_at: Date
  last_activity_at: Date
  ended_at: Date | null
}

function rowToSession(row: SessionRow): Session {
  return {
    sessionId: row.id,
    userId: row.user_id,
    scenarioId: row.scenario_id,
    status: row.status as Session['status'],
    startedAt: row.started_at.toISOString(),
    lastActivityAt: row.last_activity_at.toISOString(),
    ...(row.ended_at !== null ? { endedAt: row.ended_at.toISOString() } : {}),
  }
}

export class PostgresSessionRepository implements ISessionRepository {
  constructor(private readonly sql: Sql) {}

  async create(params: CreateSessionParams): Promise<Session> {
    const [row] = await this.sql<[SessionRow]>`
      INSERT INTO sessions (user_id, scenario_id)
      VALUES (${params.userId}, ${params.scenarioId})
      RETURNING id, user_id, scenario_id, status,
                started_at, last_activity_at, ended_at
    `
    return rowToSession(row)
  }

  async findById(sessionId: string): Promise<Session | null> {
    const [row] = await this.sql<[SessionRow?]>`
      SELECT id, user_id, scenario_id, status,
             started_at, last_activity_at, ended_at
      FROM sessions
      WHERE id = ${sessionId}
    `
    return row ? rowToSession(row) : null
  }

  async update(sessionId: string, updates: UpdateSessionParams): Promise<Session> {
    const [row] = await this.sql<[SessionRow]>`
      UPDATE sessions SET
        status           = COALESCE(${updates.status ?? null}, status),
        last_activity_at = COALESCE(
          ${updates.lastActivityAt ? new Date(updates.lastActivityAt) : null}::TIMESTAMPTZ,
          last_activity_at
        ),
        ended_at         = COALESCE(
          ${updates.endedAt ? new Date(updates.endedAt) : null}::TIMESTAMPTZ,
          ended_at
        )
      WHERE id = ${sessionId}
      RETURNING id, user_id, scenario_id, status,
                started_at, last_activity_at, ended_at
    `
    if (!row) {
      throw new Error(`Session not found: ${sessionId}`)
    }
    return rowToSession(row)
  }

  async delete(sessionId: string): Promise<void> {
    await this.sql`DELETE FROM sessions WHERE id = ${sessionId}`
  }
}
```

Rules:

- `update` uses `COALESCE` to apply only the fields present in `updates` — explicit `null` is
  produced for missing fields so Postgres ignores them and retains the current column value.
- `update` must throw if no row is found (session does not exist).
- `delete` is a hard delete — no soft-delete in Phase A.
- All tagged template queries only — no string concatenation.
- File ≤ 300 lines; each method ≤ 50 lines.

---

### 2. Implement `PostgresMessageRepository`

**File:** `apps/core/src/infrastructure/db/repositories/postgres-message.repository.ts`

#### Port contract recap

```typescript
export interface IMessageRepository {
  save(params: SaveMessageParams): Promise<Message>
  findBySessionId(sessionId: string, options?: FindMessagesOptions): Promise<Message[]>
  deleteBySessionId(sessionId: string): Promise<number>
}

export interface SaveMessageParams {
  messageId: string
  sessionId: string
  role: Message['role']
  content: string
  createdAt: string
  metadata?: MessageMetadata
}

export interface FindMessagesOptions {
  limit?: number
}
```

#### Domain type recap

```typescript
export type MessageRole = 'user' | 'assistant' | 'system'

export interface Message {
  messageId: string
  sessionId: string
  role: MessageRole
  content: string
  createdAt: string
  metadata?: MessageMetadata
}

export interface MessageMetadata {
  model?: string
  latencyMs?: number
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  costUsd?: number
  triggerSource?: string
}
```

#### Implementation guidelines

```typescript
import type { Sql } from 'postgres'
import type {
  IMessageRepository,
  SaveMessageParams,
  FindMessagesOptions,
} from '../../../application/ports/IMessageRepository.js'
import type { Message, MessageMetadata } from '../../../domain/conversation/session.types.js'

interface MessageRow {
  id: string
  session_id: string
  role: string
  content: string
  created_at: Date
  metadata: MessageMetadata | null
}

function rowToMessage(row: MessageRow): Message {
  return {
    messageId: row.id,
    sessionId: row.session_id,
    role: row.role as Message['role'],
    content: row.content,
    createdAt: row.created_at.toISOString(),
    ...(row.metadata !== null ? { metadata: row.metadata } : {}),
  }
}

export class PostgresMessageRepository implements IMessageRepository {
  constructor(private readonly sql: Sql) {}

  async save(params: SaveMessageParams): Promise<Message> {
    const [row] = await this.sql<[MessageRow]>`
      INSERT INTO messages (id, session_id, role, content, created_at, metadata)
      VALUES (
        ${params.messageId},
        ${params.sessionId},
        ${params.role},
        ${params.content},
        ${new Date(params.createdAt)},
        ${params.metadata ? this.sql.json(params.metadata) : null}
      )
      RETURNING id, session_id, role, content, created_at, metadata
    `
    return rowToMessage(row)
  }

  async findBySessionId(sessionId: string, options?: FindMessagesOptions): Promise<Message[]> {
    const limit = options?.limit

    const rows =
      limit !== undefined
        ? await this.sql<MessageRow[]>`
          SELECT id, session_id, role, content, created_at, metadata
          FROM messages
          WHERE session_id = ${sessionId}
          ORDER BY created_at ASC
          LIMIT ${limit}
        `
        : await this.sql<MessageRow[]>`
          SELECT id, session_id, role, content, created_at, metadata
          FROM messages
          WHERE session_id = ${sessionId}
          ORDER BY created_at ASC
        `

    return rows.map(rowToMessage)
  }

  async deleteBySessionId(sessionId: string): Promise<number> {
    const result = await this.sql`
      DELETE FROM messages WHERE session_id = ${sessionId}
    `
    return result.count
  }
}
```

Rules:

- `save` uses the caller-supplied `messageId` — UUIDs for messages are generated by the
  application layer, not the DB. This matches the `SaveMessageParams` contract.
- `findBySessionId` orders by `created_at ASC` — the conversation history must be in
  chronological order.
- `deleteBySessionId` returns `result.count` — the number of deleted rows (postgres.js exposes
  this as a numeric property on the result object).
- The two-branch implementation of `findBySessionId` (with and without limit) is required because
  postgres.js does not support conditional clauses within a single tagged template without unsafe
  interpolation. Two typed queries is the correct pattern.
- File ≤ 300 lines; each method ≤ 50 lines.

---

### 3. Write Integration Tests — Session Repository

**File:** `apps/core/src/infrastructure/db/repositories/postgres-session.repository.integration.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { DB_AVAILABLE, createTestSql, truncateAllTables } from '../test-helpers.js'
import { PostgresScenarioRepository } from './postgres-scenario.repository.js'
import { PostgresSessionRepository } from './postgres-session.repository.js'
import type { Sql } from 'postgres'

describe.skipIf(!DB_AVAILABLE)('PostgresSessionRepository', () => {
  let sql: Sql
  let scenarioRepo: PostgresScenarioRepository
  let sessionRepo: PostgresSessionRepository
  let scenarioId: string

  beforeAll(async () => {
    sql = await createTestSql()
    scenarioRepo = new PostgresScenarioRepository(sql)
    sessionRepo = new PostgresSessionRepository(sql)
    const scenario = await scenarioRepo.create({ name: 'Harness', slug: 'session-harness' })
    scenarioId = scenario.scenarioId
  })

  afterEach(async () => {
    await sql`TRUNCATE sessions CASCADE`
  })

  afterAll(async () => {
    await truncateAllTables(sql)
    await sql.end()
  })

  it('creates a session and returns it with generated id and timestamps', async () => {
    const session = await sessionRepo.create({ userId: 'user-1', scenarioId })

    expect(session.sessionId).toBeTypeOf('string')
    expect(session.userId).toBe('user-1')
    expect(session.scenarioId).toBe(scenarioId)
    expect(session.status).toBe('active')
    expect(session.startedAt).toBeTypeOf('string')
    expect(session.lastActivityAt).toBeTypeOf('string')
    expect(session.endedAt).toBeUndefined()
  })

  it('findById returns the session by its id', async () => {
    const created = await sessionRepo.create({ userId: 'user-2', scenarioId })
    const found = await sessionRepo.findById(created.sessionId)

    expect(found).not.toBeNull()
    expect(found!.sessionId).toBe(created.sessionId)
  })

  it('findById returns null for a non-existent id', async () => {
    const result = await sessionRepo.findById('00000000-0000-0000-0000-000000000000')
    expect(result).toBeNull()
  })

  it('update changes status and returns the updated session', async () => {
    const created = await sessionRepo.create({ userId: 'user-3', scenarioId })
    const updated = await sessionRepo.update(created.sessionId, { status: 'ended' })

    expect(updated.status).toBe('ended')
    expect(updated.sessionId).toBe(created.sessionId)
  })

  it('update sets endedAt when provided', async () => {
    const created = await sessionRepo.create({ userId: 'user-4', scenarioId })
    const endedAt = new Date().toISOString()
    const updated = await sessionRepo.update(created.sessionId, { status: 'ended', endedAt })

    expect(updated.endedAt).toBeTypeOf('string')
  })

  it('delete removes the session', async () => {
    const created = await sessionRepo.create({ userId: 'user-5', scenarioId })
    await sessionRepo.delete(created.sessionId)
    const found = await sessionRepo.findById(created.sessionId)

    expect(found).toBeNull()
  })
})
```

---

### 4. Write Integration Tests — Message Repository

**File:** `apps/core/src/infrastructure/db/repositories/postgres-message.repository.integration.test.ts`

```typescript
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { DB_AVAILABLE, createTestSql, truncateAllTables } from '../test-helpers.js'
import { PostgresScenarioRepository } from './postgres-scenario.repository.js'
import { PostgresSessionRepository } from './postgres-session.repository.js'
import { PostgresMessageRepository } from './postgres-message.repository.js'
import type { Sql } from 'postgres'

describe.skipIf(!DB_AVAILABLE)('PostgresMessageRepository', () => {
  let sql: Sql
  let messageRepo: PostgresMessageRepository
  let sessionId: string

  beforeAll(async () => {
    sql = await createTestSql()
    const scenarioRepo = new PostgresScenarioRepository(sql)
    const sessionRepo = new PostgresSessionRepository(sql)
    messageRepo = new PostgresMessageRepository(sql)

    const scenario = await scenarioRepo.create({ name: 'Harness', slug: 'message-harness' })
    const session = await sessionRepo.create({ userId: 'user-1', scenarioId: scenario.scenarioId })
    sessionId = session.sessionId
  })

  afterEach(async () => {
    await sql`TRUNCATE messages`
  })

  afterAll(async () => {
    await truncateAllTables(sql)
    await sql.end()
  })

  it('saves a message and returns it', async () => {
    const saved = await messageRepo.save({
      messageId: '11111111-1111-1111-1111-111111111111',
      sessionId,
      role: 'user',
      content: 'Hello!',
      createdAt: new Date().toISOString(),
    })

    expect(saved.messageId).toBe('11111111-1111-1111-1111-111111111111')
    expect(saved.sessionId).toBe(sessionId)
    expect(saved.role).toBe('user')
    expect(saved.content).toBe('Hello!')
    expect(saved.metadata).toBeUndefined()
  })

  it('saves a message with metadata', async () => {
    const saved = await messageRepo.save({
      messageId: '22222222-2222-2222-2222-222222222222',
      sessionId,
      role: 'assistant',
      content: 'Hi there!',
      createdAt: new Date().toISOString(),
      metadata: { model: 'gpt-4o', latencyMs: 300 },
    })

    expect(saved.metadata).toEqual({ model: 'gpt-4o', latencyMs: 300 })
  })

  it('findBySessionId returns messages in chronological order', async () => {
    const t1 = new Date(Date.now() - 2000).toISOString()
    const t2 = new Date(Date.now() - 1000).toISOString()
    const t3 = new Date().toISOString()

    await messageRepo.save({
      messageId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      sessionId,
      role: 'user',
      content: 'First',
      createdAt: t1,
    })
    await messageRepo.save({
      messageId: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      sessionId,
      role: 'assistant',
      content: 'Second',
      createdAt: t2,
    })
    await messageRepo.save({
      messageId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      sessionId,
      role: 'user',
      content: 'Third',
      createdAt: t3,
    })

    const messages = await messageRepo.findBySessionId(sessionId)
    expect(messages).toHaveLength(3)
    expect(messages[0]!.content).toBe('First')
    expect(messages[2]!.content).toBe('Third')
  })

  it('findBySessionId respects the limit option', async () => {
    const t1 = new Date(Date.now() - 2000).toISOString()
    const t2 = new Date(Date.now() - 1000).toISOString()
    const t3 = new Date().toISOString()

    await messageRepo.save({
      messageId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
      sessionId,
      role: 'user',
      content: 'A',
      createdAt: t1,
    })
    await messageRepo.save({
      messageId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
      sessionId,
      role: 'assistant',
      content: 'B',
      createdAt: t2,
    })
    await messageRepo.save({
      messageId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
      sessionId,
      role: 'user',
      content: 'C',
      createdAt: t3,
    })

    const limited = await messageRepo.findBySessionId(sessionId, { limit: 2 })
    expect(limited).toHaveLength(2)
  })

  it('findBySessionId returns empty array when session has no messages', async () => {
    const result = await messageRepo.findBySessionId('00000000-0000-0000-0000-000000000000')
    expect(result).toEqual([])
  })

  it('deleteBySessionId removes all messages and returns the count', async () => {
    await messageRepo.save({
      messageId: '11111112-1111-1111-1111-111111111111',
      sessionId,
      role: 'user',
      content: 'A',
      createdAt: new Date().toISOString(),
    })
    await messageRepo.save({
      messageId: '11111113-1111-1111-1111-111111111111',
      sessionId,
      role: 'assistant',
      content: 'B',
      createdAt: new Date().toISOString(),
    })

    const count = await messageRepo.deleteBySessionId(sessionId)
    expect(count).toBe(2)

    const remaining = await messageRepo.findBySessionId(sessionId)
    expect(remaining).toHaveLength(0)
  })
})
```

---

## Running the Tests

```bash
# Unit tests — must remain fully green
pnpm test

# Integration tests — requires a running Postgres (docker compose up -d)
cd apps/core
DATABASE_URL=postgres://postgres:postgres@localhost:5432/gami_core pnpm test:integration
```

---

## Acceptance Criteria

- [ ] `PostgresSessionRepository` implements `ISessionRepository`; compiles in strict mode.
- [ ] `PostgresMessageRepository` implements `IMessageRepository`; compiles in strict mode.
- [ ] `update` applies only the fields present in `UpdateSessionParams`; un-touched columns are
      preserved via `COALESCE`.
- [ ] `update` throws if the session does not exist.
- [ ] `deleteBySessionId` returns the number of deleted rows as a `number`.
- [ ] `findBySessionId` returns messages in `created_at ASC` order.
- [ ] `findBySessionId` with `limit` returns at most `limit` rows.
- [ ] `metadata` is `undefined` (not `null`) on messages that have none.
- [ ] `endedAt` is `undefined` (not `null`) on sessions that have none.
- [ ] All four integration test files pass against a real Postgres instance.
- [ ] All 146 existing unit tests continue to pass.
- [ ] No `any`, no implicit types.
- [ ] No source file exceeds 300 lines; no function exceeds 50 lines.
