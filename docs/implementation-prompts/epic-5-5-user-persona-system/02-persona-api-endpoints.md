# 02 — Persona API Endpoints

## Context

The persistence layer (prompt 01) gave us a `User` entity and `IUserRepository`. This prompt
exposes two API endpoints so clients can set and read a user's persona. It also introduces the
two application use cases that implement the operations.

## Scope

**In scope:**

- `UpsertUserPersonaUseCase` — creates or replaces the user persona; returns the updated `User`
- `GetUserPersonaUseCase` — retrieves the user by ID; returns `UserPersona | null`
- Fastify route file `api/routes/users.ts`:
  - `PUT /v1/users/:userId/persona` — auth enforced; idempotent upsert
  - `GET /v1/users/:userId/persona` — auth enforced; returns persona (or null)
- Route registered in `api/server.ts`
- Stack-E2E test file `api/routes/users.stack-e2e.test.ts`
- Integration test file `api/routes/users.test.ts` using in-memory stubs

**Out of scope:**

- Injecting persona into prompt assembly (prompt 03)
- Any user creation beyond upsert via persona endpoint
- User deletion endpoints (Phase B+)

## Relevant Docs

- `docs/API_CONTRACT.md` — `UserPersona` type shape; auth pattern; `ApiResponse<T>` envelope
- `docs/ARCHITECTURE.md` — route → use case → port dependency flow
- `docs/TEST_STRATEGY.md` — integration test pattern (in-memory stubs + `createServer`)

## Implementation Guidance

### Use cases

#### `UpsertUserPersonaUseCase`

Location: `application/use-cases/upsert-user-persona/upsert-user-persona.use-case.ts`

```ts
type UpsertUserPersonaInput = {
  userId: string
  persona: UserPersona
}

type UpsertUserPersonaOutput = {
  user: User
}
```

Calls `IUserRepository.upsert(userId, persona)`. Returns the full updated `User`. No validation
beyond checking `userId` is non-empty (boundary validation happens at the route layer via Fastify
schema).

#### `GetUserPersonaUseCase`

Location: `application/use-cases/get-user-persona/get-user-persona.use-case.ts`

```ts
type GetUserPersonaInput = { userId: string }
type GetUserPersonaOutput = { persona: UserPersona | null }
```

Calls `IUserRepository.findById(userId)`. Returns `{ persona: user.persona ?? null }`. If user
not found, returns `{ persona: null }` — not a 404, because a user may simply have no record yet.

### Route (`api/routes/users.ts`)

Pattern: follow `api/routes/admin-metrics.ts` — `FastifyPluginCallback` with `authenticateApiKey`
applied as `addHook('preHandler', ...)` on the route plugin.

```text
PUT  /v1/users/:userId/persona
GET  /v1/users/:userId/persona
```

#### PUT `/v1/users/:userId/persona`

- Request body: `UserPersona` object (all fields optional; allow empty object `{}`)
- Body JSON schema: object with optional properties `role` (string), `tonePreference` (string),
  `interactionHints` (array of strings); `additionalProperties: false`
- Params schema: `userId` string, `minLength: 1`
- On success: `200 ok<{ user: User }>`
- Error mapping: `401` unauthorized, `400` validation error, `500` internal error

#### GET `/v1/users/:userId/persona`

- Params schema: `userId` string, `minLength: 1`
- On success: `200 ok<{ persona: UserPersona | null }>`
- Never returns `404` — returns `{ persona: null }` when user has no record yet
- Error mapping: `401` unauthorized, `500` internal error

#### Route options type

```ts
type UsersRouteOptions = {
  config: Config
  userRepository: IUserRepository
}
```

#### Register in `server.ts`

Add `usersRoute` import and register at `/v1/users` prefix — alongside existing routes.

### Stack-E2E test (`users.stack-e2e.test.ts`)

Cover:

1. `PUT /v1/users/:userId/persona` — 401 without API key
2. `PUT /v1/users/:userId/persona` — 401 with wrong API key
3. `PUT /v1/users/:userId/persona` — 400 with invalid body (e.g. `interactionHints` as string
   instead of array)
4. `GET /v1/users/:userId/persona` — 401 without API key
5. `GET /v1/users/:userId/persona` — returns `{ persona: null }` for unknown userId (no 404)

Happy-path shape test (200 PUT → 200 GET roundtrip): implement this fully — it requires no
seeded data since upsert creates the user. Do not skip it.

### Integration test (`users.test.ts`)

Use in-memory stubs + `createServer` (same pattern as `admin-metrics.test.ts`).

Cover:

1. PUT with valid persona → 200 with user shape
2. PUT twice with same userId → second call replaces persona (idempotent)
3. GET after PUT → returns same persona
4. GET for unknown user → 200 `{ persona: null }`
5. PUT with empty body `{}` → valid; persona stored as empty object

## Constraints

- `authenticateApiKey` must be applied — these endpoints are not public
- No `userId` uniqueness enforcement beyond what the repository provides
- `UserPersona` fields must remain fully optional — never reject a valid but partially filled persona
- The route must NOT create a `User` on GET — only `PUT` triggers creation via upsert
- `ok<T>` and `fail(code, msg)` from `@gami/shared` for all responses

## Deliverables

- `apps/core/src/application/use-cases/upsert-user-persona/upsert-user-persona.use-case.ts`
- `apps/core/src/application/use-cases/upsert-user-persona/upsert-user-persona.use-case.test.ts`
- `apps/core/src/application/use-cases/get-user-persona/get-user-persona.use-case.ts`
- `apps/core/src/application/use-cases/get-user-persona/get-user-persona.use-case.test.ts`
- `apps/core/src/api/routes/users.ts`
- `apps/core/src/api/routes/users.test.ts`
- `apps/core/src/api/routes/users.stack-e2e.test.ts`
- `apps/core/src/api/server.ts` — register `usersRoute`

## Mandatory Pre-Implementation Check

Before coding:

1. Confirm `API_CONTRACT.md` `UserPersona` type — match the field names exactly.
2. Confirm `ok<T>` / `fail()` are the only response helpers — no inline shape creation.
3. Search for any existing `users.ts` route file in `api/routes/` (should not exist).
4. Confirm `authenticateApiKey` is imported from `api/hooks/authenticate.ts` — do not duplicate.

## Mandatory Final Step — Documentation Update

After implementation, `docs/API_CONTRACT.md` must be updated to document both endpoints. Add a
new section (e.g., **U1. User Persona**) with:

- endpoint paths
- auth requirement
- request/response shapes
- error mapping

If no other doc changes are needed at this stage, explicitly confirm `DATA_MODEL.md` and
`ARCHITECTURE.md` are still accurate.

`pnpm lint && pnpm typecheck && pnpm test` must pass before proceeding.

## Acceptance Criteria

- [ ] `PUT /v1/users/:userId/persona` returns 200 with updated user
- [ ] `GET /v1/users/:userId/persona` returns 200 with persona (or null)
- [ ] Both endpoints return 401 without valid API key
- [ ] `PUT` with invalid body returns 400
- [ ] Stack-E2E file exists and covers auth, validation, and happy-path roundtrip
- [ ] `docs/API_CONTRACT.md` has the new endpoint section
- [ ] `pnpm lint && pnpm typecheck && pnpm test` pass
