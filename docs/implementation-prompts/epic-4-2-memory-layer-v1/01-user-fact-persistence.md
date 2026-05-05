# Prompt 01 — User Fact Persistence

## Context

User facts are structured, cross-session memory about a user (e.g. their role, language
preference, recurring constraints). They are extracted from conversations and persist indefinitely
— they survive session resets and inform every future avatar turn for that user.

The `UserFact` domain type already exists in `domain/memory/memory.types.ts`. This prompt
delivers the persistence layer: a new DB table, the repository port, and both implementations.

## Scope

**In scope:**

- `user_memory_facts` DB table — new canonical schema addition in `infra/postgres/init.sql`
- `IUserMemoryFactRepository` application port
- `InMemoryUserMemoryFactRepository` (for tests)
- `PostgresUserMemoryFactRepository` (for production)
- Unit tests for both implementations

**Out of scope:**

- Fact extraction logic (Prompt 02)
- API endpoints (Prompt 04)
- Wiring into server/route (Prompt 04)

---

## Relevant Docs

- `docs/DATA_MODEL.md` §10 — `UserMemoryFact` field list and semantics
- `docs/API_CONTRACT.md` §14 — `ListUserMemoryFactsResponse` (source of truth for field names)
- `apps/core/src/domain/memory/memory.types.ts` — `UserFact` (verify it matches before adding)
- `apps/core/src/application/ports/IUserRepository.ts` — pattern to follow for a simple user-scoped port
- `apps/core/src/infrastructure/db/repositories/postgres-user-repository.ts` — follow this Postgres repository pattern exactly (sql tagged template literal, row mapping, no ORM)

---

## Mandatory Pre-Implementation Check

Before writing any code:

1. Read `docs/API_CONTRACT.md` §14 — the response shape uses `id`, `userId`, `category`, `key`,
   `value`, `confidence`, `updatedAt`. Confirm `UserFact` in `memory.types.ts` uses these same
   field names (or update the domain type to match).
2. Check `infra/postgres/init.sql` — confirm `user_memory_facts` table does **not** yet exist
   (it should not be there — only `users`, `sessions`, etc. are present).
3. Search for any existing `IUserMemoryFactRepository` or `user_memory_fact` references —
   confirm none exist before creating new files.

---

## Implementation Guidance

### Step 1 — Update `UserFact` domain type if needed

Verify `apps/core/src/domain/memory/memory.types.ts` has:

```ts
export interface UserFact {
  id: string // opaque string, e.g. 'umf_...'
  userId: string
  category: string // e.g. 'preference', 'constraint', 'goal'
  key: string // e.g. 'language', 'role', 'topic_interest'
  value: string
  confidence?: number | null
  createdAt: string
  updatedAt: string
}
```

If the existing type is missing `id`, `category`, `createdAt`, or `confidence`, update it.
Do **not** rename existing fields that are already used elsewhere — check all usages first.

### Step 2 — Add `user_memory_facts` to `infra/postgres/init.sql`

Append a new table block after the `users` table:

```sql
-- ── User Memory Facts ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_memory_facts (
  id          TEXT        PRIMARY KEY DEFAULT 'umf_' || gen_random_uuid()::TEXT,
  user_id     TEXT        NOT NULL,
  category    TEXT        NOT NULL,
  key         TEXT        NOT NULL,
  value       TEXT        NOT NULL,
  confidence  REAL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_memory_facts_user_id ON user_memory_facts(user_id);
```

No foreign key to `users` — user facts may exist before the user record does (resilient
cross-session model). Consistency is maintained at application layer.

**Also add** this canonical schema note to `DATA_MODEL.md` §10 `UserMemoryFact`:

- Implementation Status: table `user_memory_facts`, primary key `TEXT` with `umf_` prefix

### Step 3 — Define `IUserMemoryFactRepository`

Create `apps/core/src/application/ports/IUserMemoryFactRepository.ts`:

```ts
import type { UserFact } from '../../domain/memory/memory.types.js'

export interface IUserMemoryFactRepository {
  /** Find all facts for a user, ordered by updatedAt DESC. */
  findByUserId(userId: string): Promise<UserFact[]>

  /** Upsert a fact: if a row with same (userId, category, key) exists, update it. Otherwise insert. */
  upsert(fact: Omit<UserFact, 'id' | 'createdAt' | 'updatedAt'>): Promise<UserFact>

  /** Delete one fact by ID. Returns true if a row was deleted, false if not found. */
  deleteById(factId: string): Promise<boolean>

  /** Check if a fact belongs to a given user. Used before delete to prevent cross-user deletion. */
  findById(factId: string): Promise<UserFact | null>
}
```

### Step 4 — Implement `InMemoryUserMemoryFactRepository`

Create `apps/core/src/infrastructure/db/in-memory-user-memory-fact.repository.ts`.

Use a `Map<string, UserFact>` keyed by `id`. Implement all four methods.

For `upsert`: find an existing entry with matching `(userId, category, key)` and update it, or
generate a new `id` (`umf_` + random UUID) and insert.

### Step 5 — Implement `PostgresUserMemoryFactRepository`

Create `apps/core/src/infrastructure/db/repositories/postgres-user-memory-fact.repository.ts`.

Follow the exact pattern from `postgres-user-repository.ts` (sql tagged template literal from
`postgres` package, row typing, explicit `rowToUserFact` mapping function).

`upsert` should use `INSERT ... ON CONFLICT (user_id, category, key) DO UPDATE SET value = ...,
confidence = ..., updated_at = NOW()`.

Add `UNIQUE (user_id, category, key)` to the table DDL if not already there (add it to
`init.sql` as a constraint on the `user_memory_facts` table).

### Step 6 — Unit Tests

Create unit tests for `InMemoryUserMemoryFactRepository`:

| Test                                                                    | Expected                                          |
| ----------------------------------------------------------------------- | ------------------------------------------------- |
| `findByUserId` returns empty array for unknown user                     | `[]`                                              |
| `upsert` inserts a new fact                                             | fact returned with `id`, `createdAt`, `updatedAt` |
| `upsert` with same `(userId, category, key)` updates value              | second upsert returns updated value               |
| `findByUserId` returns all facts for user, ordered newest first         |                                                   |
| `deleteById` returns true for existing fact                             | fact removed                                      |
| `deleteById` returns false for unknown id                               |                                                   |
| `findById` returns null for unknown id                                  |                                                   |
| `findById` returns fact for known id                                    |                                                   |
| cross-user isolation: `findByUserId(userA)` does not return userB facts |                                                   |

---

## Constraints

- No ORM — raw SQL in Postgres repo
- No cascade delete from `users` — facts outlive user records by design
- `id` prefix `umf_` — consistent with `evt_` prefix convention
- TypeScript strict: no `any`, upsert return type must be `UserFact` not `void`

---

## Deliverables

- Updated `UserFact` in `domain/memory/memory.types.ts` (if fields were missing)
- `user_memory_facts` table + unique constraint + index in `infra/postgres/init.sql`
- `apps/core/src/application/ports/IUserMemoryFactRepository.ts`
- `apps/core/src/infrastructure/db/in-memory-user-memory-fact.repository.ts`
- `apps/core/src/infrastructure/db/repositories/postgres-user-memory-fact.repository.ts`
- Unit tests for in-memory implementation

---

## Mandatory Final Step — Documentation Update

Update `docs/DATA_MODEL.md` §10 to add:

```
### Implementation Status (EPIC 4.2)
- **Table:** `user_memory_facts`
- **Repository:** `PostgresUserMemoryFactRepository`
- **Status:** Fully implemented. `id` uses `umf_` prefix. `(user_id, category, key)` is unique.
```

---

## Acceptance Criteria

- [ ] `user_memory_facts` table exists in `infra/postgres/init.sql` with correct columns and unique constraint
- [ ] `IUserMemoryFactRepository` port is defined and imported correctly
- [ ] Both repository implementations pass unit tests
- [ ] `pnpm typecheck` and `pnpm test` pass with zero errors
