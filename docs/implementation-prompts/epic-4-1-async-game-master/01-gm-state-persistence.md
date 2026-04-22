# 01 — GM State Persistence

## Context

The Game Master maintains a small state object per session: current avatar, progression description, topics covered, and interaction count. This state must survive server restarts — it is the GM's memory between turns. Without persistence, every GM run starts blind.

Additionally, the `Session` entity needs an `active_avatar_id` column so the GM can track and switch the default-speaking avatar.

This prompt delivers the DB schema, the port interface, and both the Postgres and in-memory implementations.

## Scope

**In scope:**

- `active_avatar_id` column on `sessions` table (nullable FK → avatars)
- `active_avatar_id?: string` field on `Session` type in `domain/conversation/session.types.ts`
- `UPDATE active_avatar_id` support added to `PostgresSessionRepository.update()`
- `gm_states` table: `session_id` (PK), `current_avatar_id`, `progression`, `topics_covered`, `interaction_count`, `updated_at`
- `IGmStateRepository` port in `application/ports/`
- `InMemoryGmStateRepository` in `infrastructure/db/`
- `PostgresGmStateRepository` in `infrastructure/db/repositories/`
- Update `infra/postgres/init.sql` with both schema additions
- Update `test-helpers.ts` `truncateAllTables` to include `gm_states`

**Out of scope:**

- Trigger evaluation (prompt 02)
- Use case (prompt 03)
- Event log (prompt 04)

## Relevant Docs

- `docs/GAME_MASTER_CONTRACT.md` — section 6 (State Model)
- `docs/DATA_MODEL.md` — session entity, `gm_states` does not yet exist (you are adding it)
- `apps/core/src/domain/game-master/game-master.types.ts` — existing `GameMasterState` type
- `apps/core/src/infrastructure/db/` — existing Postgres repository pattern to follow

## Implementation Guidance

### DB schema additions — `infra/postgres/init.sql`

Add to the sessions table definition:

```sql
active_avatar_id TEXT REFERENCES avatars(id) ON DELETE SET NULL,
```

Add new table:

```sql
CREATE TABLE IF NOT EXISTS gm_states (
  session_id    TEXT PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  current_avatar_id TEXT,
  progression   TEXT NOT NULL DEFAULT '',
  topics_covered TEXT[] NOT NULL DEFAULT '{}',
  interaction_count INT NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### `Session` type update

Add `activeAvatarId?: string` to the `Session` interface in `domain/conversation/session.types.ts`.

Update `PostgresSessionRepository` row mapping and `update()` to support setting `activeAvatarId`.

### `IGmStateRepository`

`apps/core/src/application/ports/IGmStateRepository.ts`

```ts
export interface IGmStateRepository {
  /** Load the GM state for a session. Returns null if not yet initialised. */
  findBySessionId(sessionId: string): Promise<GameMasterState | null>
  /** Persist (upsert) the GM state for a session. */
  save(sessionId: string, state: GameMasterState): Promise<void>
}
```

The `GameMasterState` type is already defined in `domain/game-master/game-master.types.ts` — import it.

### `InMemoryGmStateRepository`

`apps/core/src/infrastructure/db/in-memory-gm-state.repository.ts`

Simple `Map<string, GameMasterState>` — follow the same pattern as `in-memory-session.repository.ts`.

### `PostgresGmStateRepository`

`apps/core/src/infrastructure/db/repositories/postgres-gm-state.repository.ts`

- `findBySessionId`: `SELECT * FROM gm_states WHERE session_id = $1`
- `save`: `INSERT INTO gm_states ... ON CONFLICT (session_id) DO UPDATE SET ...` — a true upsert

Map DB row fields (`current_avatar_id`, `topics_covered`, `interaction_count`, `progression`) to `GameMasterState`.

### `ServerAdapters` extension

Add `gmStateRepository: IGmStateRepository` to the `ServerAdapters` type so it can be injected. Default to `InMemoryGmStateRepository` in `createServer()` when not provided.

Wire `PostgresGmStateRepository` in `apps/core/src/index.ts`.

### `truncateAllTables`

Add `gm_states` to the `TRUNCATE` statement in `apps/core/src/infrastructure/db/test-helpers.ts`.

## Constraints

- `gm_states.session_id` is both PK and FK — one state row per session, cascades on session delete
- `Session.activeAvatarId` is nullable — not all sessions are GM-managed
- Do not change `GameMasterState` type structure — it already matches what is needed
- Follow existing Postgres repository naming and file conventions exactly

## Deliverables

- `infra/postgres/init.sql` updated (sessions + gm_states tables)
- `apps/core/src/domain/conversation/session.types.ts` — `activeAvatarId?` added
- `apps/core/src/application/ports/IGmStateRepository.ts`
- `apps/core/src/infrastructure/db/in-memory-gm-state.repository.ts`
- `apps/core/src/infrastructure/db/repositories/postgres-gm-state.repository.ts`
- `apps/core/src/infrastructure/db/index.ts` — export both new repos
- `apps/core/src/api/server.ts` — `ServerAdapters` extended, default wired
- `apps/core/src/index.ts` — Postgres impl wired for production
- `apps/core/src/infrastructure/db/test-helpers.ts` — `gm_states` in truncate list

## Mandatory Final Step — Documentation Update

After implementation:

- `docs/DATA_MODEL.md` — add `gm_states` table spec (fields, notes, implementation status)
- `docs/DATA_MODEL.md` — update Session entity to note `active_avatar_id` column
- `docs/PROJECT_STATUS.md` — note that GM state persistence is implemented

## Acceptance Criteria

- [ ] `gm_states` table created in `init.sql`
- [ ] `sessions.active_avatar_id` column added to `init.sql`
- [ ] `Session` type carries `activeAvatarId?: string`
- [ ] `IGmStateRepository` port exists with `findBySessionId` and `save`
- [ ] `InMemoryGmStateRepository` and `PostgresGmStateRepository` both implement the port
- [ ] `truncateAllTables` includes `gm_states`
- [ ] Docker volume wiped and restarted with new schema (or CI init.sql applied)
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` pass
