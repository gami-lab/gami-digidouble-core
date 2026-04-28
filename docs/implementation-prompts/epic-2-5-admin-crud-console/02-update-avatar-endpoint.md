# 02 — Update Avatar Endpoint

## Context

Avatars are the core creative asset in any scenario. Today they can be created and deleted but not edited. Operators currently must delete and recreate an avatar to change its `personaPrompt`, `tone`, or `status`. This is a significant workflow blocker when iterating on AI behavior during testing. This prompt adds `PATCH /v1/avatars/{avatarId}` as a partial update endpoint.

This is a self-contained vertical slice: repository port → in-memory and Postgres implementations → use case → route handler → stack-e2e test.

## Scope

**In scope:**

- `IAvatarRepository.update()` port method
- `InMemoryAvatarRepository.update()` implementation
- `PostgresAvatarRepository.update()` implementation
- `UpdateAvatarUseCase` in `application/use-cases/update-avatar/`
- `PATCH /v1/avatars/{avatarId}` route handler in `api/routes/avatars.ts`
- Unit tests for use case and in-memory repository
- `avatars.stack-e2e.test.ts` — extend with PATCH coverage (auth, validation, not-found, happy path)

**Out of scope:**

- Console UI (prompt 04)
- Updating scenarios (prompt 01)
- Changing `scenarioId` (avatar migration between scenarios)

## Relevant Docs

- `docs/API_CONTRACT.md` — `AvatarSummary` shape, existing avatar endpoints
- `docs/ARCHITECTURE.md` — 4-layer module structure
- `docs/DATA_MODEL.md` — avatars table schema
- `apps/core/src/application/ports/IAvatarRepository.ts` — current interface
- `apps/core/src/application/use-cases/delete-avatar/` — reference pattern for a simple avatar use case
- `apps/core/src/infrastructure/db/repositories/postgres-avatar.repository.ts` — Postgres repository to extend
- `apps/core/src/api/routes/avatars.ts` — existing route file (only has DELETE today)
- `apps/core/src/api/routes/avatars.stack-e2e.test.ts` — existing stack-e2e to extend

## Implementation Guidance

### Repository Port

Extend `IAvatarRepository`:

```ts
update(avatarId: string, updates: UpdateAvatarParams): Promise<AvatarConfig>
```

Where:

```ts
export type UpdateAvatarParams = {
  name?: string
  personaPrompt?: string
  tone?: string
  description?: string
  adjustments?: string[]
  config?: Record<string, unknown>
  status?: AvatarConfig['status']
}
```

Semantics: only fields present in `updates` are written. `updatedAt` is always refreshed. `scenarioId` is immutable and must never be accepted in the update params.

### In-Memory Implementation

`InMemoryAvatarRepository.update()`:

- Find avatar by ID — throw `DomainError('NOT_FOUND', ...)` if missing
- Merge supplied fields onto the stored record
- Set `updatedAt` to `new Date().toISOString()`
- Return updated record

### Postgres Implementation

`PostgresAvatarRepository.update()`:

- Dynamic `UPDATE avatars SET ... WHERE avatar_id = $n RETURNING *`
- Only include columns whose keys are present in `updates`
- Always include `updated_at = NOW()`
- `NULL` row result → throw `DomainError('NOT_FOUND', ...)`
- Map row to `AvatarConfig` using the existing row mapper

Fields to columns:

- `name` → `name`
- `personaPrompt` → `persona_prompt`
- `tone` → `tone`
- `description` → `description`
- `adjustments` → `adjustments` (JSONB array)
- `config` → `config` (JSONB)
- `status` → `status`

### Use Case

`UpdateAvatarUseCase` in `application/use-cases/update-avatar/`:

Files:

- `update-avatar.types.ts` — `UpdateAvatarInput` / `UpdateAvatarOutput`
- `update-avatar.use-case.ts`

Input:

```ts
type UpdateAvatarInput = {
  avatarId: string
  name?: string
  personaPrompt?: string
  tone?: string
  description?: string
  adjustments?: string[]
  config?: Record<string, unknown>
  status?: 'draft' | 'active' | 'archived'
}
```

Output:

```ts
type UpdateAvatarOutput = {
  avatar: AvatarConfig
}
```

Validation: at least one updatable field must be present (throw `DomainError('INVALID_INPUT', ...)` otherwise).

### Route Handler

Extend `avatars.ts` with:

```
PATCH /v1/avatars/:avatarId
```

- Fastify body schema: all fields optional (`name`, `personaPrompt`, `tone`, `description`, `adjustments`, `config`, `status`), `additionalProperties: false`
- Call `UpdateAvatarUseCase.execute()`
- Map `NOT_FOUND` → `404`, `INVALID_INPUT` → `400`, everything else → `500`
- Response shape: `{ avatar: AvatarSummary }`
- Note: `avatars.ts` currently only imports `DeleteAvatarUseCase` and only has the `avatarRepository` + `sessionRepository` injected. Extend `AvatarsRouteOptions` to optionally inject the repositories needed (they are the same — `avatarRepository` is sufficient for update)

### Stack-E2E Tests

Extend `avatars.stack-e2e.test.ts`:

- `PATCH /v1/avatars/:id` with no API key → `401`
- `PATCH /v1/avatars/:id` with wrong API key → `401`
- `PATCH /v1/avatars/nonexistent` → `404`
- `PATCH /v1/avatars/:id` with empty body `{}` → `400 VALIDATION_ERROR`
- Happy-path: create a scenario + avatar via API, PATCH `personaPrompt`, assert response reflects new value and `updatedAt` is refreshed

## Constraints

- `scenarioId` must not be accepted as an update field — the route body schema must exclude it
- Dynamic Postgres UPDATE must only touch columns present in the update object — no silent NULL writes
- TypeScript strict — no `any`
- Keep `avatars.ts` clean — the new use case follows the same injection pattern as `DeleteAvatarUseCase`

## Deliverables

1. `IAvatarRepository` updated with `update()` method and `UpdateAvatarParams` type
2. `InMemoryAvatarRepository.update()` implemented + unit tested
3. `UpdateAvatarUseCase` implemented + unit tested (happy path, not found, empty input)
4. `PATCH /v1/avatars/{avatarId}` route handler wired in `avatars.ts`
5. `avatars.stack-e2e.test.ts` extended with PATCH coverage

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/API_CONTRACT.md` — add `PATCH /v1/avatars/{avatarId}` section with request/response shapes and error mapping
- `docs/PROJECT_STATUS.md` — note that `PATCH /v1/avatars/{avatarId}` is implemented
- Verify `docs/DATA_MODEL.md` avatars table columns match what the update query touches

## Acceptance Criteria

- [ ] `IAvatarRepository` interface defines `update(avatarId, updates): Promise<AvatarConfig>`
- [ ] `InMemoryAvatarRepository` implements `update()` with merge semantics
- [ ] `PostgresAvatarRepository` implements `update()` with dynamic SQL (only present fields)
- [ ] `UpdateAvatarUseCase` handles happy path, not-found, and empty-input
- [ ] `PATCH /v1/avatars/:avatarId` returns `200` with updated avatar
- [ ] `PATCH` with unknown ID returns `404`
- [ ] `PATCH` with empty body returns `400`
- [ ] Stack-e2e covers auth enforcement, validation, not-found, and happy path
- [ ] `pnpm lint && pnpm typecheck && pnpm test` pass cleanly
- [ ] `docs/API_CONTRACT.md` documents the new endpoint
