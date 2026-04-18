# 02 — Avatar Creation Endpoint

## Context

An `Avatar` is a first-class persistence entity owned by a `Scenario` (see `DATA_MODEL.md` §3).

EPIC 2.1 built the Avatar runtime — `IAvatarRepository.findById()`, `InMemoryAvatarRepository`,
and `AvatarConfig` used by `SendMessageUseCase`. But no API endpoint exists to create an Avatar.

Without an avatar creation endpoint, two things are blocked:

1. The `messages.stack-e2e.test.ts` happy path (requires an avatar with a known `avatarId`)
2. Any real operator workflow (an operator cannot configure an Avatar without direct DB access)

This prompt bridges that gap by extending the repository port and adding the creation endpoint.

This prompt depends on Prompt 01 (`IScenarioRepository` + `InMemoryScenarioRepository`) being
complete, because `CreateAvatarUseCase` validates that the referenced `scenarioId` exists.

---

## Scope

**In scope:**

- `IAvatarRepository` extended with `create(params): Promise<AvatarConfig>`
- `InMemoryAvatarRepository` updated with `create()` implementation
- `CreateAvatarUseCase` — validates input, checks scenario exists, generates ID, persists
- `POST /v1/scenarios/:scenarioId/avatars` route added to the `scenariosRoute` plugin
- `API_CONTRACT.md` updated with the new avatar endpoint definition
- `avatars.stack-e2e.test.ts` covering auth, validation, 404 (unknown scenario), and 200 happy path

**Out of scope:**

- `GET /v1/scenarios/:scenarioId/avatars` (list avatars) — deferred
- `PUT /v1/scenarios/:scenarioId/avatars/:avatarId` (update avatar) — deferred
- Slug uniqueness enforcement within a scenario — deferred
- Avatar status lifecycle transitions — deferred
- PostgreSQL repository — in-memory only for Sprint 2
- Any runtime changes to `SendMessageUseCase` — it will use `findById`, not `create`

---

## Relevant Docs

- `docs/DATA_MODEL.md` §3 — Avatar entity fields
- `docs/API_CONTRACT.md` — §8 area (Scenario API); no avatar endpoint exists yet, must be added
- `apps/core/src/domain/avatar/avatar.types.ts` — `Avatar` and `AvatarConfig` types
- `apps/core/src/application/ports/IAvatarRepository.ts` — current port (read-only)
- `apps/core/src/infrastructure/db/in-memory-avatar.repository.ts` — current implementation
- `apps/core/src/api/routes/scenarios.ts` — Fastify plugin to extend (from Prompt 01)
- `docs/TEST_STRATEGY.md` — stack-e2e test pattern and file naming

---

## Implementation Guidance

### 1. Extend IAvatarRepository

Add `create(params: CreateAvatarParams): Promise<AvatarConfig>` to `IAvatarRepository`.

`CreateAvatarParams` fields:

- `scenarioId: string` — required
- `name: string` — required
- `slug: string` — required
- `personaPrompt: string` — required
- `tone?: string`
- `description?: string`
- `adjustments?: string[]`
- `config?: Record<string, unknown>`
- `status?: AvatarStatus` — defaults to `'active'`

Return type is `AvatarConfig` (the runtime shape), not `Avatar` (the persistence shape).

Note: `AvatarConfig` uses `avatarId` (not `id`). The implementation must map correctly.

### 2. Update InMemoryAvatarRepository

Add `create(params: CreateAvatarParams): Promise<AvatarConfig>` to the class.

- Generate ID: `avatar_${crypto.randomUUID()}`
- Build the `AvatarConfig` object from the params (mapping `avatarId`, all fields)
- Store in the `Map` under `avatarId`
- Return the created `AvatarConfig`

### 3. CreateAvatarUseCase

Create `application/use-cases/create-avatar/create-avatar.types.ts` and
`application/use-cases/create-avatar/create-avatar.use-case.ts`.

Constructor takes `IScenarioRepository` and `IAvatarRepository`.

Input DTO:

```
scenarioId: string      — from path param (validated in route)
name: string            — required, non-empty
slug: string            — required, non-empty, pattern ^[a-z0-9-]+$
personaPrompt: string   — required, non-empty
tone?: string
description?: string
adjustments?: string[]
config?: Record<string, unknown>
status?: AvatarStatus
```

Validation order:

1. Blank `name`, `slug`, or `personaPrompt` → `DomainError('VALIDATION_ERROR', '...')`
2. Invalid `slug` pattern → `DomainError('VALIDATION_ERROR', '...')`
3. `IScenarioRepository.findById(scenarioId)` → if `null` → `DomainError('NOT_FOUND', 'Scenario not found')`
4. Call `IAvatarRepository.create(...)` → return `AvatarConfig`

Output DTO: `{ avatar: AvatarConfig }` (or equivalent flat shape matching the route response).

### 4. Update scenariosRoute Plugin

In `api/routes/scenarios.ts`, add a second route: `POST /:scenarioId/avatars`.

Route handler:

- `authenticateApiKey` pre-handler (same hook)
- Fastify body schema: `name` (string, minLength 1), `slug` (string, pattern), `personaPrompt`
  (string, minLength 1), optional `tone`, `description`, `adjustments` (array of strings),
  `config` (object), `status` (enum)
- `scenarioId` comes from `params.scenarioId` (path parameter)
- Wire `CreateAvatarUseCase`
- Error mapping:
  - `DomainError` code `NOT_FOUND` → `404`
  - `DomainError` code `VALIDATION_ERROR` → `400`
  - Unknown error → `500`
- Success → `201` with `ApiResponse<CreateAvatarResponse>`

`CreateAvatarResponse` shape:

```
{
  avatar: {
    avatarId: string
    scenarioId: string
    name: string
    slug: string
    status: AvatarStatus
    personaPrompt: string
    tone?: string
    description?: string
    adjustments?: string[]
    createdAt: string  // Note: AvatarConfig doesn't carry timestamps — add to response using updatedAt from create call or set at route level using same timestamp used for creation
    updatedAt: string
  }
}
```

Note: `AvatarConfig` is the runtime shape and lacks `createdAt`/`updatedAt`. Either:

- Add timestamps to `CreateAvatarParams` and carry them through, OR
- Generate timestamps in the use case and include them in a richer output DTO

Prefer the richer output DTO approach to keep `AvatarConfig` minimal (it's a runtime shape, not
a persistence envelope).

### 5. Server and Route Wiring

`scenariosRoute` already receives `scenarioRepository` from `ServerAdapters`. Now it also needs
`avatarRepository` from `ServerAdapters`.

Update `scenariosRoute`'s options type to accept both `IScenarioRepository` and `IAvatarRepository`.
Both are already in `ServerAdapters`.

### 6. API_CONTRACT.md Update

Add the avatar creation endpoint to `docs/API_CONTRACT.md` in the Scenario API section,
between §9 (Get Scenario) and §10 (Update Scenario) — renumber as needed, or append as §9.5 /
"Create Avatar for Scenario".

Endpoint definition:

```text
POST /v1/scenarios/{scenarioId}/avatars
```

Request body: `name`, `slug`, `personaPrompt` (required); `tone`, `description`, `adjustments`,
`config`, `status` (optional).

Response: `ApiResponse<{ avatar: AvatarSummary }>` where `AvatarSummary` includes all avatar
fields including timestamps.

Error mapping: `401`, `400` (validation), `404` (scenario not found), `500`.

### 7. avatars.stack-e2e.test.ts

Create `api/routes/avatars.stack-e2e.test.ts`.

This test can include a **full 201 happy-path test** because:

- It creates a scenario first via `POST /v1/scenarios` (itself no pre-seeded data)
- Then creates an avatar against that scenario ID

Test sections:

- **Auth** — no key → 401, wrong key → 401 (use `scenario_unknown` as scenarioId, any body)
- **Validation** — missing `name` → 400, missing `personaPrompt` → 400, invalid `slug` → 400
- **Resource lookup** — valid body against unknown `scenarioId` → 404
- **Success** — create scenario, then create avatar → 201, assert `data.avatar.avatarId` starts
  with `avatar_`, assert `data.avatar.scenarioId` matches the created scenario ID

The `APP_URL` and `API_KEY` setup follows the same pattern as `exchange.stack-e2e.test.ts`.

---

## Constraints

- `IAvatarRepository.create` must be typed — no `any` usage
- `CreateAvatarUseCase` must not import `InMemoryAvatarRepository` or `InMemoryScenarioRepository`
- `AvatarConfig` stays minimal (runtime shape) — do not add persistence timestamps to it
- Route assigns `scenarioId` from path param, not from request body — never trust body for scoping
- Stack-e2e tests are real HTTP requests — `fetch()` only, no `app.inject()`

---

## Deliverables

- `application/ports/IAvatarRepository.ts` updated (add `create` + `CreateAvatarParams`)
- `infrastructure/db/in-memory-avatar.repository.ts` updated (implement `create`)
- `application/use-cases/create-avatar/create-avatar.types.ts`
- `application/use-cases/create-avatar/create-avatar.use-case.ts`
- `api/routes/scenarios.ts` updated (add `POST /:scenarioId/avatars` route)
- `api/routes/avatars.stack-e2e.test.ts`
- `docs/API_CONTRACT.md` updated with avatar creation endpoint

---

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/API_CONTRACT.md` — add/verify the `POST /v1/scenarios/:scenarioId/avatars` endpoint
  contract is accurate (request, response, error mapping)
- `docs/DATA_MODEL.md` §3 — confirm Avatar fields match; note `AvatarConfig` vs `Avatar`
  distinction if not already documented
- `docs/PROJECT_STATUS.md` — note that `IAvatarRepository` now has `create`, and that the
  avatar creation endpoint is implemented

If no doc changes are needed, explicitly verify docs are still accurate.

---

## Acceptance Criteria

- [ ] `IAvatarRepository` has `create(params: CreateAvatarParams): Promise<AvatarConfig>`
- [ ] `InMemoryAvatarRepository.create()` generates `avatar_${uuid}`, stores, and returns the avatar
- [ ] `CreateAvatarUseCase` validates name, slug, personaPrompt, checks scenario exists
- [ ] `CreateAvatarUseCase` throws `DomainError('NOT_FOUND', ...)` when scenario is missing
- [ ] `POST /v1/scenarios/:scenarioId/avatars` returns `201` on success
- [ ] `POST /v1/scenarios/:scenarioId/avatars` returns `401` without valid API key
- [ ] `POST /v1/scenarios/:scenarioId/avatars` returns `400` on validation errors
- [ ] `POST /v1/scenarios/:scenarioId/avatars` returns `404` when scenarioId is unknown
- [ ] `avatars.stack-e2e.test.ts` covers auth, validation, 404, and 201 happy path
- [ ] `docs/API_CONTRACT.md` includes the avatar endpoint definition
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` all pass
