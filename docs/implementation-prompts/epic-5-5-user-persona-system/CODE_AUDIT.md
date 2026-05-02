# CODE_AUDIT.md — EPIC 5.5: User Persona System

**Audited:** 2026-05-02  
**Final Grade: A**

---

## 1. Scope

Files audited:

| File                                                                                           | Role                                                                             |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `apps/core/src/domain/user/user.types.ts`                                                      | Domain types: `UserPersona`, `User`                                              |
| `apps/core/src/domain/user/index.ts`                                                           | Barrel re-export                                                                 |
| `apps/core/src/application/ports/IUserRepository.ts`                                           | Port: `findById`, `upsert`                                                       |
| `apps/core/src/infrastructure/db/in-memory-user.repository.ts`                                 | In-memory stub                                                                   |
| `apps/core/src/infrastructure/db/in-memory-user.repository.test.ts`                            | Unit tests (3 cases)                                                             |
| `apps/core/src/infrastructure/db/repositories/postgres-user.repository.ts`                     | Postgres adapter                                                                 |
| `apps/core/src/infrastructure/db/repositories/postgres-user.repository.integration.test.ts`    | Integration tests (6 cases)                                                      |
| `apps/core/src/application/use-cases/upsert-user-persona/upsert-user-persona.use-case.ts`      | Upsert use case                                                                  |
| `apps/core/src/application/use-cases/upsert-user-persona/upsert-user-persona.use-case.test.ts` | Unit tests (3 cases)                                                             |
| `apps/core/src/application/use-cases/get-user-persona/get-user-persona.use-case.ts`            | Get use case                                                                     |
| `apps/core/src/application/use-cases/get-user-persona/get-user-persona.use-case.test.ts`       | Unit tests (3 cases)                                                             |
| `apps/core/src/api/routes/users.ts`                                                            | Fastify routes: `PUT /v1/users/:userId/persona`, `GET /v1/users/:userId/persona` |
| `apps/core/src/api/routes/users.test.ts`                                                       | Route integration tests                                                          |
| `apps/core/src/api/routes/users.stack-e2e.test.ts`                                             | Stack-E2E tests (auth + roundtrip)                                               |
| `apps/core/src/domain/avatar/persona-prompt.service.ts`                                        | Extended with `userPersona?` opt                                                 |
| `apps/core/src/domain/avatar/persona-prompt.service.test.ts`                                   | Unit tests (18 total, 5 new userPersona cases)                                   |
| `apps/core/src/application/use-cases/send-message/send-message.use-case.ts`                    | Loads and injects persona                                                        |
| `apps/core/src/application/use-cases/send-message/send-message.use-case.test.ts`               | Persona injection tests (4 new cases)                                            |
| `apps/core/src/application/use-cases/run-game-master/run-game-master.types.ts`                 | `RunGameMasterInput.userPersona?`                                                |
| `apps/core/src/application/use-cases/run-game-master/run-game-master.use-case.test.ts`         | GM persona passthrough tests (2 new cases)                                       |
| `apps/core/src/domain/game-master/game-master.types.ts`                                        | `GameMasterInput.context.userPersona?`                                           |
| `apps/core/src/api/server.ts`                                                                  | Wires `userRepository` into `usersRoute` and `SendMessageUseCase`                |
| `infra/postgres/init.sql`                                                                      | `users` table with `persona JSONB`                                               |
| `docs/API_CONTRACT.md` (§13b)                                                                  | User Persona endpoint contract                                                   |
| `docs/GAME_MASTER_CONTRACT.md`                                                                 | `context.userPersona` documented                                                 |
| `docs/DATA_MODEL.md`                                                                           | Users table section                                                              |
| `docs/PROJECT_STATUS.md`                                                                       | EPIC 5.5 marked complete                                                         |

---

## 2. Build Health

| Gate             | Result                              |
| ---------------- | ----------------------------------- |
| `pnpm lint`      | ✅ 0 errors                         |
| `pnpm typecheck` | ✅ 0 errors                         |
| `pnpm test`      | ✅ 343 tests, 61 files — all passed |

---

## 3. DoD Checklist

| Requirement                                     | Status                                                                                                       |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `users` table in `infra/postgres/init.sql`      | ✅ `CREATE TABLE IF NOT EXISTS users` with `persona JSONB`                                                   |
| `IUserRepository` port                          | ✅ `findById` + `upsert`                                                                                     |
| `InMemoryUserRepository`                        | ✅ Map-based, preserves `createdAt` on update                                                                |
| `PostgresUserRepository`                        | ✅ `ON CONFLICT (id) DO UPDATE` pattern                                                                      |
| `UpsertUserPersonaUseCase` with tests           | ✅ 3 tests                                                                                                   |
| `GetUserPersonaUseCase` with tests              | ✅ 3 tests — returns `null` for unknown users (no 404)                                                       |
| `PUT /v1/users/:userId/persona` — auth enforced | ✅ `authenticateApiKey` preHandler                                                                           |
| `GET /v1/users/:userId/persona` — auth enforced | ✅ `authenticateApiKey` preHandler                                                                           |
| Stack-E2E: auth + not-found + roundtrip         | ✅ All covered                                                                                               |
| `assemblePersonaPrompt` accepts `userPersona?`  | ✅ Injects role sentence when `role` is non-empty                                                            |
| `persona-prompt.service.test.ts` updated        | ✅ 5 new cases (with role, empty persona, empty role, whitespace role, tonePreference only, ordering)        |
| `SendMessageUseCase` loads persona + injects    | ✅ Graceful fallback — no repo → undefined; repo throws → swallowed                                          |
| `send-message` tests for persona injection      | ✅ 4 cases: inject role, no repo, repo throws, user without persona                                          |
| `RunGameMasterInput.userPersona?` typed         | ✅ Passed through from `SendMessageUseCase`                                                                  |
| `GameMasterInput.context.userPersona?` typed    | ✅ In `game-master.types.ts`                                                                                 |
| GM persona passthrough tests                    | ✅ 2 cases: passes through, absent when not provided                                                         |
| `PostgresUserRepository` integration tests      | ✅ 6 cases: create, update+preserve, empty persona, roundtrip all fields, null for missing, interactionHints |
| `docs/API_CONTRACT.md` updated                  | ✅ §13b fully documented                                                                                     |
| `docs/GAME_MASTER_CONTRACT.md` updated          | ✅ `context.userPersona` documented with semantics                                                           |
| `docs/DATA_MODEL.md` updated                    | ✅ Users table section added                                                                                 |
| `docs/PROJECT_STATUS.md` updated                | ✅ EPIC 5.5 marked complete (May 2, 2026)                                                                    |
| `pnpm lint / typecheck / test` pass             | ✅ All clean                                                                                                 |

---

## 4. Issues

### I1 — Manual body validation instead of Fastify JSON schema (LOW)

**File:** `apps/core/src/api/routes/users.ts`, lines 30–110  
**Severity:** Low  
**Type:** Consistency deviation

`users.ts` rejects unknown persona fields via a hand-rolled `validatePersonaBody()` function
using an `allowedPersonaKeys` Set, rather than via a Fastify JSON schema with
`additionalProperties: false` (the pattern used by all other routes in this codebase).

```ts
// Current approach (users.ts)
const allowedPersonaKeys = new Set(['role', 'tonePreference', 'interactionHints'])

function validatePersonaBody(body: unknown): string | null {
  // ... manual key enumeration + type checks
}
```

```ts
// Standard codebase pattern (e.g. scenarios.ts, avatars.ts)
body: {
  type: 'object',
  additionalProperties: false,
  properties: { ... },
}
```

The manual approach is functionally correct and is covered by tests (unknown field → 400,
correct type enforcement for `interactionHints` array). The deviation is motivated by the
open-ended nature of `UserPersona` — adding new optional fields in the future only requires
updating one Set and one conditional, rather than coordinating schema and runtime type. This
is a defensible design choice given the persona type's intended extensibility.

**No action required.** A comment in the source explaining the rationale would help future
readers but is not blocking.

---

### I2 — Redundant userId validation in use case (LOW)

**File:** `apps/core/src/application/use-cases/upsert-user-persona/upsert-user-persona.use-case.ts`  
**Severity:** Low  
**Type:** Redundant logic

`UpsertUserPersonaUseCase.execute()` validates `userId.trim().length > 0`. The Fastify route
schema (`userParamsSchema`) already enforces `minLength: 1` and a non-whitespace pattern, so
this validation can never fail when called through the API. If ever called directly (e.g. from
a future background job), the guard is a useful safety net. Harmless but adds noise.

**No action required.**

---

### I3 — Non-standard whitespace pattern in userId param schema (INFO)

**File:** `apps/core/src/api/routes/users.ts`, line ~12  
**Severity:** Info  
**Type:** Minor style inconsistency

`userParamsSchema` uses `pattern: '.*\\S.*'` in addition to `minLength: 1`, while all other
routes use only `minLength: 1`. The pattern correctly prevents whitespace-only userIds
(e.g. `"   "`), and the corresponding test (`returns 400 for whitespace userId`) verifies the
behavior. Other routes do not face this concern because their identifiers are UUIDs. The
extra pattern is purposeful, not a mistake.

**No action required.**

---

## 5. Architecture Assessment

The implementation respects the 4-layer boundary throughout:

- `domain/user/` holds types only — no business logic, no imports from other layers
- `application/ports/IUserRepository` is the only cross-layer contract
- Both use cases (`upsert`, `get`) depend on the port interface, not the concrete repositories
- `SendMessageUseCase` takes `IUserRepository?` as a constructor parameter — the optional
  wiring pattern keeps the dependency injectable and testable without the persona feature
- `server.ts` defaults to `InMemoryUserRepository` when no adapter is provided — correct
  defensive wiring for tests and local dev
- `PostgresUserRepository` lives in `infrastructure/db/repositories/` — consistent with
  all other Postgres adapters

No architecture drift detected.

---

## 6. Summary

EPIC 5.5 delivers a complete user persona system: storage, API, and context injection into
the avatar prompt and GM input. All quality gates pass. Test coverage spans unit, integration,
and stack-E2E tiers. All downstream consumers (`SendMessageUseCase`, `RunGameMasterUseCase`,
`assemblePersonaPrompt`) handle the missing-persona case gracefully. Documentation is fully
updated across API_CONTRACT, GAME_MASTER_CONTRACT, DATA_MODEL, and PROJECT_STATUS.

The three noted issues are all low/informational — no blocking defects, no architecture
drift, no test coverage gaps for critical behavior paths.

**Grade: A**
