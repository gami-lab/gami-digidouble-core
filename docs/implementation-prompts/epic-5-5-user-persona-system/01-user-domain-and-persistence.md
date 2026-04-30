# 01 — User Domain and Persistence

## Context

EPIC 5.5 requires a `User` entity that carries an optional persona. Currently, `sessions.user_id`
is a bare `TEXT` column — there is no `users` table and no `IUserRepository` in the codebase.
This prompt creates the full persistence foundation: domain type, port, in-memory stub, DB
schema, and Postgres repository. No API or application use cases yet — those come in the next
prompt.

## Scope

**In scope:**

- `User` domain type and `UserPersona` type in `domain/user/user.types.ts`
- `domain/user/index.ts` barrel export
- `IUserRepository` port in `application/ports/IUserRepository.ts`
- `InMemoryUserRepository` in `infrastructure/db/in-memory-user.repository.ts`
- `users` table added to `infra/postgres/init.sql`
- `PostgresUserRepository` in `infrastructure/db/repositories/postgres-user.repository.ts`
- Wire `IUserRepository` into `ServerAdapters` in `api/server.ts` (optional field, defaults to
  `InMemoryUserRepository` just like other repositories)
- Basic unit test for `InMemoryUserRepository`

**Out of scope:**

- Application use cases (next prompt)
- API endpoints (next prompt)
- Persona injection into prompt assembly (prompt 03)
- Do NOT add a foreign key from `sessions.user_id` to `users.id` — `sessions.user_id` stays as
  `TEXT`. Loose coupling is intentional in Phase A (existing sessions must not break).

## Relevant Docs

- `docs/DATA_MODEL.md` — User entity definition (fields, persona shape, notes)
- `docs/ARCHITECTURE.md` — 4-layer structure; domain types never depend on infrastructure
- `docs/TECH_STACK.md` — postgres.js driver, PostgreSQL

## Implementation Guidance

### Domain type (`domain/user/user.types.ts`)

Define two types:

```ts
export type UserPersona = {
  role?: string
  tonePreference?: string
  interactionHints?: string[]
}

export type User = {
  userId: string
  persona?: UserPersona
  createdAt: string
  updatedAt: string
}
```

`UserPersona` is already documented in `docs/API_CONTRACT.md` under "Core Types". Use the
exact same shape — do not invent a parallel definition. If `@gami/shared` already exports
`UserPersona`, reuse it; otherwise own it in the domain and re-export from shared only if
multiple packages need it in Phase A.

### Port (`application/ports/IUserRepository.ts`)

```ts
export interface IUserRepository {
  findById(userId: string): Promise<User | null>
  upsert(userId: string, persona: UserPersona): Promise<User>
}
```

- `upsert` creates the user if they do not exist, or replaces only the `persona` JSONB if they
  do. Always returns the full updated `User`.
- No `delete` in Phase A — user deletion is deferred.

### In-memory stub

Pattern: follow `in-memory-session.repository.ts`. Store a `Map<string, User>`.

`upsert`: create a new row if `userId` not found; otherwise update `persona` and `updatedAt`.

Unit test file: `in-memory-user.repository.test.ts` — test `findById` (found, not found) and
`upsert` (create then update).

### DB schema

Add to `infra/postgres/init.sql` (after the existing table block, before the seed section if
any):

```sql
-- ── Users ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id         TEXT        PRIMARY KEY,
  persona    JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

`id` is `TEXT` (not UUID) — it mirrors what `sessions.user_id TEXT` already stores. Using the
caller's opaque user ID as PK avoids an extra indirection step in Phase A.

### Postgres repository

Pattern: follow `postgres-session.repository.ts`.

- `findById(userId)`: `SELECT id, persona, created_at, updated_at FROM users WHERE id = $1`
- `upsert(userId, persona)`: use `INSERT ... ON CONFLICT (id) DO UPDATE SET persona = $2, updated_at = NOW() RETURNING *`

Map DB row → `User` domain type using a private `toUser(row)` helper.

### Server wiring (`api/server.ts`)

Add `userRepository?: IUserRepository` to `ServerAdapters`. In `createServer`, default to a
new `InMemoryUserRepository()` when not injected — same pattern as `eventLogRepository` and
`gmStateRepository`.

## Constraints

- TypeScript strict mode — no `any`, all fields explicitly typed
- `User.userId` is the canonical identifier; do not rename it `id` in domain code
- No cascade deletes or FK constraints from sessions in Phase A
- Keep `UserPersona` fields all optional — persona can be empty or partial

## Deliverables

- `apps/core/src/domain/user/user.types.ts`
- `apps/core/src/domain/user/index.ts`
- `apps/core/src/application/ports/IUserRepository.ts`
- `apps/core/src/infrastructure/db/in-memory-user.repository.ts`
- `apps/core/src/infrastructure/db/in-memory-user.repository.test.ts`
- `infra/postgres/init.sql` updated with `users` table
- `apps/core/src/infrastructure/db/repositories/postgres-user.repository.ts`
- `apps/core/src/api/server.ts` — `ServerAdapters.userRepository` added

## Mandatory Pre-Implementation Check

Before coding:

1. Confirm no existing `User` type or `IUserRepository` in the codebase (search `IUserRepository`,
   `domain/user`).
2. Check `API_CONTRACT.md` for the canonical `UserPersona` shape — match it exactly.
3. Check that `@gami/shared` does not already export a `UserPersona` type that would create
   duplication.
4. Confirm `infra/postgres/init.sql` is the canonical schema file (no migration files).

## Mandatory Final Step — Documentation Update

After implementation, verify that `docs/DATA_MODEL.md` User entity section is still accurate.
Do not update the implementation status yet — that is done in prompt 05.

If running `pnpm lint && pnpm typecheck && pnpm test` reveals issues, fix them before
proceeding to the next prompt.

## Acceptance Criteria

- [ ] `User` and `UserPersona` types exist in `domain/user/user.types.ts`
- [ ] `IUserRepository` port has `findById` and `upsert`
- [ ] `InMemoryUserRepository` passes its unit tests
- [ ] `users` table DDL is present in `init.sql`
- [ ] `PostgresUserRepository` compiles with no `any`
- [ ] `ServerAdapters` has `userRepository?`
- [ ] `pnpm lint && pnpm typecheck && pnpm test` all pass
