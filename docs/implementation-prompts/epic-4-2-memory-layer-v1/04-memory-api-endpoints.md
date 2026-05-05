# Prompt 04 — Memory API Endpoints

## Context

This prompt delivers the three memory-related API endpoints defined in `API_CONTRACT.md`:

1. `GET /v1/users/{userId}/memory-facts` — list all persistent facts for a user
2. `DELETE /v1/users/{userId}/memory-facts/{factId}` — delete one user fact
3. `GET /v1/admin/sessions/{sessionId}/memory` — admin endpoint: session working memory summary + fact count

Endpoints 1 and 2 live in the existing `users` route file. Endpoint 3 is a new admin route file.

## Scope

**In scope:**

- `ListUserMemoryFactsUseCase` + route in `users.ts`
- `DeleteUserMemoryFactUseCase` + route in `users.ts`
- `GetSessionMemoryUseCase` + new admin route file `admin-memory.ts`
- Route tests (inject) for all three endpoints
- Server wiring for all new routes

**Out of scope:**

- Fact extraction (Prompt 02)
- Stack-e2e tests (Prompt 05)

---

## Relevant Docs

- `docs/API_CONTRACT.md` §14 — `GET /v1/users/{userId}/memory-facts`
- `docs/API_CONTRACT.md` §15 — `DELETE /v1/users/{userId}/memory-facts/{factId}`
- `docs/API_CONTRACT.md` §A5 — `GET /v1/admin/sessions/{sessionId}/memory`
- `docs/API_CONTRACT.md` "Session Memory Summary" Core Type — response shape for §A5
- `apps/core/src/api/routes/users.ts` — existing route file; follow its structure exactly
- `apps/core/src/api/routes/admin-metrics.ts` — pattern for admin route file with session check

---

## Mandatory Pre-Implementation Check

1. Read `docs/API_CONTRACT.md` §A5 fully. The response is:

   ```ts
   type AdminSessionMemoryResponse = {
     session: SessionMemorySummary
   }
   ```

   And `SessionMemorySummary` is already in `@gami/shared`. Confirm export.

2. Read `apps/core/src/api/routes/users.ts` fully — understand how `UsersRouteOptions` is typed,
   how `IUserRepository` is injected, and how `authenticateApiKey` is applied.

3. Read `apps/core/src/api/routes/admin-metrics.ts` — see how admin routes check session
   existence and return 404.

4. Confirm `@gami/shared` exports `SessionMemorySummary` (it does — in `lifecycle-types.ts`).

---

## Implementation Guidance

### Step 1 — `ListUserMemoryFactsUseCase`

Create `apps/core/src/application/use-cases/list-user-memory-facts/list-user-memory-facts.use-case.ts`.

```ts
// input: { userId: string }
// output: { facts: UserFact[] }
// delegates to: IUserMemoryFactRepository.findByUserId
// no error conditions — unknown user returns empty array
```

Also create the types file `list-user-memory-facts.types.ts`.

### Step 2 — `DeleteUserMemoryFactUseCase`

Create `apps/core/src/application/use-cases/delete-user-memory-fact/`.

```ts
// input: { userId: string, factId: string }
// output: { factId: string, deleted: true }
// logic:
//   1. findById(factId) — if null, throw DomainError('NOT_FOUND', ...)
//   2. verify fact.userId === input.userId — if not, throw DomainError('NOT_FOUND', ...) (no info leakage)
//   3. deleteById(factId)
//   4. return { factId, deleted: true }
```

The `NOT_FOUND` response for cross-user access is intentional — no information leakage about
whether the fact exists for a different user.

### Step 3 — Add Routes to `users.ts`

Extend `UsersRouteOptions` to add:

```ts
userMemoryFactRepository?: IUserMemoryFactRepository
```

Add fallback to `new InMemoryUserMemoryFactRepository()` in the plugin body.

#### `GET /:userId/memory-facts`

Authentication: `preHandler: authenticateApiKey(options.config.apiKeySecret)`

Handler:

1. Instantiate `ListUserMemoryFactsUseCase`
2. Call execute
3. Return `ok({ facts: output.facts.map(toFactDto) })` with status 200

`toFactDto` maps `UserFact` → the API DTO shape from §14:

```ts
{ id, userId, category, key, value, confidence: fact.confidence ?? null, updatedAt }
```

(Note: `createdAt` is not in the §14 response shape — check the contract; if it is absent, omit it.)

Error mapping:

- 401 → UNAUTHORIZED (handled by preHandler)
- 500 → INTERNAL_ERROR

#### `DELETE /:userId/memory-facts/:factId`

Authentication: same preHandler.

Handler:

1. Instantiate `DeleteUserMemoryFactUseCase`
2. Call execute
3. Return `ok({ factId, deleted: true })` with status 200
4. Catch `DomainError`:
   - `NOT_FOUND` → 404
   - others → 500

### Step 4 — Create `admin-memory.ts`

Create `apps/core/src/api/routes/admin-memory.ts`.

Register `GET /sessions/:sessionId/memory` (relative path, will be mounted under `/v1/admin`).

Authentication: same preHandler pattern as other admin routes.

Handler:

1. Instantiate `GetSessionMemoryUseCase`
2. Check session existence — throw / return 404 if not found
3. Build `SessionMemorySummary`:
   - `sessionId`
   - `summary: session.memorySummary ?? ''`
   - `shortTerm: { exchangeCount: 2 }` — Phase A constant (last 2 exchanges are never persisted, assembled at runtime)
   - `longTermFactCount: <count of facts for session.userId>` — requires fetching from `IUserMemoryFactRepository.findByUserId` and returning `.length`
   - `updatedAt: session.lastActivityAt`
4. Return `ok({ session: memorySummary })`

**Dependencies:** `ISessionRepository`, `IUserMemoryFactRepository`.

#### `GetSessionMemoryUseCase`

Create `apps/core/src/application/use-cases/get-session-memory/`.

```ts
// input: { sessionId: string }
// output: { memorySummary: SessionMemorySummary }
// dependencies: ISessionRepository, IUserMemoryFactRepository
```

Logic: load session → if null throw NOT_FOUND → fetch facts for `session.userId` → assemble summary.

### Step 5 — Register `adminMemoryRoute` in `server.ts`

Follow the pattern for `adminMetricsRoute`:

```ts
app.register(adminMemoryRoute, {
  prefix: '/v1/admin',
  config,
  sessionRepository: resolvedAdapters.sessionRepository ?? new InMemorySessionRepository(),
  userMemoryFactRepository:
    resolvedAdapters.userMemoryFactRepository ?? new InMemoryUserMemoryFactRepository(),
})
```

Also add `userMemoryFactRepository?: IUserMemoryFactRepository` to `ServerAdapters`.

### Step 6 — Route Tests

#### `users-memory-facts.test.ts`

| Test                                    | Expected                                                |
| --------------------------------------- | ------------------------------------------------------- |
| GET with no API key                     | 401 UNAUTHORIZED                                        |
| GET with wrong API key                  | 401 UNAUTHORIZED                                        |
| GET for unknown user (no facts)         | 200, `{ data: { facts: [] }, error: null }`             |
| GET for user with seeded facts          | 200, facts array matches                                |
| DELETE with no API key                  | 401 UNAUTHORIZED                                        |
| DELETE unknown factId                   | 404 NOT_FOUND                                           |
| DELETE fact belonging to different user | 404 NOT_FOUND                                           |
| DELETE valid factId                     | 200, `{ data: { factId, deleted: true }, error: null }` |

#### `admin-memory.test.ts`

| Test                                      | Expected                       |
| ----------------------------------------- | ------------------------------ |
| No API key                                | 401 UNAUTHORIZED               |
| Wrong API key                             | 401 UNAUTHORIZED               |
| Unknown sessionId                         | 404 NOT_FOUND                  |
| Known session, no memory summary          | 200, `session.summary === ''`  |
| Known session with memorySummary          | 200, `session.summary` matches |
| `longTermFactCount` reflects seeded facts | 200, count is correct          |

---

## Constraints

- `DELETE` cross-user access returns 404, not 403 (no info leakage)
- `shortTerm.exchangeCount` is always `2` in Phase A — it is a constant, not computed
- `longTermFactCount` is `undefined` when `userMemoryFactRepository` is not injected — follow
  the `SessionMemorySummary` type definition (field is optional)
- `userMemoryFactRepository` is optional in all route options — fall back to in-memory

---

## Deliverables

- `apps/core/src/application/use-cases/list-user-memory-facts/`
- `apps/core/src/application/use-cases/delete-user-memory-fact/`
- `apps/core/src/application/use-cases/get-session-memory/`
- Updated `apps/core/src/api/routes/users.ts`
- New `apps/core/src/api/routes/admin-memory.ts`
- Updated `apps/core/src/api/server.ts`
- Route tests for all three endpoints

---

## Mandatory Final Step — Documentation Update

Update `docs/API_CONTRACT.md`:

- Confirm §14 (`GET /v1/users/{userId}/memory-facts`) matches implementation (field names, response shape)
- Confirm §15 (`DELETE /v1/users/{userId}/memory-facts/{factId}`) matches
- Confirm §A5 (`GET /v1/admin/sessions/{sessionId}/memory`) matches

If any field diverged during implementation, update the contract.

---

## Acceptance Criteria

- [ ] `GET /v1/users/{userId}/memory-facts` returns correct shape
- [ ] `DELETE /v1/users/{userId}/memory-facts/{factId}` returns 404 for cross-user access
- [ ] `GET /v1/admin/sessions/{sessionId}/memory` returns `SessionMemorySummary` with correct fields
- [ ] All three endpoints are API-key protected
- [ ] Route tests pass
- [ ] `pnpm typecheck` and `pnpm test` pass with zero errors
