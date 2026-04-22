# 04 — Event Log and Observability

## Context

Every GM run must emit a structured diagnostic event to the `event_log` table. This is the foundation of admin inspection: operators can query events to understand why the GM triggered or skipped, what state changed, and how long it took.

The `EventLog` entity is already defined in `docs/DATA_MODEL.md`. This prompt creates the DB table, the port interface, and the Postgres implementation — then wires emission into the two `// TODO(EPIC-4.1-events)` points left by prompt 03.

## Scope

**In scope:**

- `event_log` DB table in `infra/postgres/init.sql`
- `IEventLogRepository` port in `application/ports/`
- `InMemoryEventLogRepository` in `infrastructure/db/`
- `PostgresEventLogRepository` in `infrastructure/db/repositories/`
- `GameMasterEvent` type (from `GAME_MASTER_CONTRACT.md` section 14) — add to `domain/game-master/game-master.types.ts`
- Replace the two `// TODO(EPIC-4.1-events)` comments in `RunGameMasterUseCase` with real emission calls
- Update `test-helpers.ts` truncate list
- Wire `PostgresEventLogRepository` in `apps/core/src/index.ts`

**Out of scope:**

- Any admin API endpoint to read events (EPIC 3.2)
- Filtering, pagination, or search over events
- Non-GM event types (those will be added by later EPICs as needed)

## Relevant Docs

- `docs/DATA_MODEL.md` — entity 11 (EventLog), full field list
- `docs/GAME_MASTER_CONTRACT.md` — section 14 (Diagnostic Trace), `GameMasterEvent` type
- `apps/core/src/infrastructure/db/repositories/postgres-message.repository.ts` — pattern for insert-only repositories

## Implementation Guidance

### DB table — `infra/postgres/init.sql`

```sql
CREATE TABLE IF NOT EXISTS event_log (
  id             TEXT PRIMARY KEY DEFAULT 'evt_' || gen_random_uuid()::TEXT,
  session_id     TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  type           TEXT NOT NULL,
  severity       TEXT NOT NULL DEFAULT 'info',
  correlation_id TEXT,
  request_id     TEXT,
  payload        JSONB NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_event_log_session_id ON event_log(session_id);
CREATE INDEX IF NOT EXISTS idx_event_log_type ON event_log(type);
```

The `payload` stores the structured `GameMasterEvent.payload` object. Do not try to type-map every JSONB field — use `unknown` on read, typed on write.

### `IEventLogRepository` port

`apps/core/src/application/ports/IEventLogRepository.ts`

```ts
export interface IEventLogRepository {
  append(event: StoredEvent): Promise<void>
}

export type StoredEvent = {
  sessionId?: string
  type: string
  severity: 'info' | 'warning' | 'error'
  correlationId?: string
  requestId?: string
  payload: Record<string, unknown>
}
```

Keep `StoredEvent` generic — it is not specific to GM events. The GM code constructs a `GameMasterEvent` and converts it to `StoredEvent` before calling `append()`.

### `InMemoryEventLogRepository`

Simple append-only array. Add a `getAll(): StoredEvent[]` method for test introspection (not part of the interface — only on the concrete class).

### `PostgresEventLogRepository`

Single `INSERT INTO event_log (id, session_id, type, severity, correlation_id, request_id, payload, created_at) VALUES (...)` with generated `evt_` prefixed UUID. Never update, never delete.

### `GameMasterEvent` type

Add to `domain/game-master/game-master.types.ts` — copy the type from `GAME_MASTER_CONTRACT.md` section 14 exactly. This is the canonical shape.

### Emission in `RunGameMasterUseCase`

Replace the two TODO comments:

**`gm_skipped` emission** (no-trigger path):

```ts
await this.eventLogRepository.append({
  sessionId: input.sessionId,
  type: 'gm_skipped',
  severity: 'info',
  correlationId: input.correlationId,
  payload: {
    triggerReason: null,
    turnIndex: input.turnIndex,
    interactionCount: updatedState.interactionCount,
    stateBefore: { ... },
    latencyMs: Date.now() - start,
  },
})
```

**`gm_triggered` emission** (after successful GM run):

```ts
await this.eventLogRepository.append({
  sessionId: input.sessionId,
  type: 'gm_triggered',
  severity: 'info',
  correlationId: input.correlationId,
  payload: {
    triggerReason,
    turnIndex: input.turnIndex,
    interactionCount: updatedState.interactionCount,
    stateBefore: { ... },
    decision: {
      avatarId: output.avatarId,
      conversationMode: output.conversationMode,
      notesInjected: Boolean(output.context?.notes),
      directiveCount: output.recommendedChoices?.length ?? 0,
    },
    stateAfter: { ... },
    latencyMs: Date.now() - start,
    inputTokens: llmResponse.inputTokens,
    outputTokens: llmResponse.outputTokens,
  },
})
```

**Security rule from the contract:** never include prompt content or raw user message text in the event payload.

Wrap the `eventLogRepository.append()` call in try/catch — event emission failures must not abort the GM run.

### `ServerAdapters` extension

Add `eventLogRepository: IEventLogRepository` to `ServerAdapters`. Default to `InMemoryEventLogRepository` in `createServer()`. Wire `PostgresEventLogRepository` in `index.ts`.

### `truncateAllTables`

Add `event_log` to the `TRUNCATE` statement.

## Constraints

- Event emission failures must never propagate — catch and log to stderr
- `payload` is stored as JSONB — serialize carefully; no undefined values
- The `event_log` table is append-only in Phase A — no update or delete operations
- `StoredEvent` must remain generic — do not couple the port to `GameMasterEvent` specifically

## Deliverables

- `infra/postgres/init.sql` — `event_log` table + indexes added
- `apps/core/src/domain/game-master/game-master.types.ts` — `GameMasterEvent` type added
- `apps/core/src/application/ports/IEventLogRepository.ts`
- `apps/core/src/infrastructure/db/in-memory-event-log.repository.ts`
- `apps/core/src/infrastructure/db/repositories/postgres-event-log.repository.ts`
- `apps/core/src/infrastructure/db/index.ts` — exports added
- `apps/core/src/application/use-cases/run-game-master/run-game-master.use-case.ts` — emission wired
- `apps/core/src/api/server.ts` — `eventLogRepository` added to `ServerAdapters`
- `apps/core/src/index.ts` — `PostgresEventLogRepository` wired
- `apps/core/src/infrastructure/db/test-helpers.ts` — `event_log` in truncate list

## Mandatory Final Step — Documentation Update

After implementation:

- `docs/DATA_MODEL.md` — update entity 11 (EventLog) with Implementation Status (table created, repository implemented)
- `docs/PROJECT_STATUS.md` — note that event log infrastructure is available

## Acceptance Criteria

- [ ] `event_log` table exists in `init.sql` with correct schema and indexes
- [ ] `IEventLogRepository` port has `append(event: StoredEvent): Promise<void>`
- [ ] Both in-memory and Postgres implementations exist and are exported
- [ ] `gm_skipped` event is emitted on every no-trigger GM run
- [ ] `gm_triggered` event is emitted after every GM LLM run
- [ ] No event payload contains raw user message text or prompt content
- [ ] Event emission errors are caught — GM run continues even if emit fails
- [ ] `event_log` in `truncateAllTables`
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` pass
