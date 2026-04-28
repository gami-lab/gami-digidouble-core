# 01 — Update Scenario Endpoint

## Context

`DELETE /v1/scenarios/{scenarioId}` and `GET /v1/scenarios` already exist. Operators cannot yet edit a scenario's name, status, or config after creation. This prompt adds `PATCH /v1/scenarios/{scenarioId}` as a partial update endpoint — the missing write operation for the scenario admin lifecycle.

This is a self-contained vertical slice: repository port → in-memory and Postgres implementations → use case → route handler → stack-e2e test.

## Scope

**In scope:**

- `IScenarioRepository.update()` port method
- `InMemoryScenarioRepository.update()` implementation
- `PostgresScenarioRepository.update()` implementation
- `UpdateScenarioUseCase` in `application/use-cases/update-scenario/`
- `PATCH /v1/scenarios/{scenarioId}` route handler in `api/routes/scenarios.ts`
- Unit tests for use case and in-memory repository
- `scenarios.stack-e2e.test.ts` — auth, validation, and not-found coverage for the PATCH endpoint

**Out of scope:**

- Console UI (prompt 04)
- Updating avatars (prompt 02)
- Bulk update or cascade effects

## Relevant Docs

- `docs/API_CONTRACT.md` — existing `PUT /v1/scenarios/{scenarioId}` shape (rename to PATCH, partial update semantics)
- `docs/ARCHITECTURE.md` — 4-layer module structure
- `docs/DATA_MODEL.md` — scenarios table schema (`name`, `status`, `config`, `updated_at`)
- `docs/TEST_STRATEGY.md` — unit test patterns for use cases
- `apps/core/src/application/ports/IScenarioRepository.ts` — current interface
- `apps/core/src/application/use-cases/delete-scenario/` — reference pattern for a simple scenario use case
- `apps/core/src/infrastructure/db/repositories/postgres-scenario.repository.ts` — Postgres repository to extend
- `apps/core/src/api/routes/scenarios.ts` — existing route file to extend
- `apps/core/src/api/routes/scenarios.stack-e2e.test.ts` — existing stack-e2e to extend

## Implementation Guidance

### Repository Port

Extend `IScenarioRepository`:

```ts
update(scenarioId: string, updates: UpdateScenarioParams): Promise<Scenario>
```

Where:

```ts
export type UpdateScenarioParams = {
  name?: string
  status?: Scenario['status']
  config?: Record<string, unknown>
}
```

Semantics: only fields present in `updates` are written. `updatedAt` is always refreshed.

### In-Memory Implementation

`InMemoryScenarioRepository.update()`:

- Find scenario by ID — throw `DomainError('NOT_FOUND', ...)` if missing
- Merge supplied fields onto the stored record
- Set `updatedAt` to `new Date().toISOString()`
- Return updated record

### Postgres Implementation

`PostgresScenarioRepository.update()`:

- Build a dynamic `UPDATE scenarios SET ... WHERE scenario_id = $n RETURNING *` using only the fields present in `updates`
- Always include `updated_at = NOW()`
- Return `null` row → throw `DomainError('NOT_FOUND', ...)`
- Map row to `Scenario` using the existing row mapper

### Use Case

`UpdateScenarioUseCase` in `application/use-cases/update-scenario/`:

Files:

- `update-scenario.types.ts` — `UpdateScenarioInput` / `UpdateScenarioOutput`
- `update-scenario.use-case.ts` — calls `repository.update()`, wraps in output DTO

Input:

```ts
type UpdateScenarioInput = {
  scenarioId: string
  name?: string
  status?: 'draft' | 'active' | 'archived'
  config?: Record<string, unknown>
}
```

Output:

```ts
type UpdateScenarioOutput = {
  scenario: Scenario
}
```

Validation: at least one updatable field must be present in the input (throw `DomainError('INVALID_INPUT', ...)` otherwise).

### Route Handler

Extend `scenarios.ts` with:

```
PATCH /v1/scenarios/:scenarioId
```

- Fastify body schema: all fields optional (`name`, `status`, `config`), `additionalProperties: false`
- Call `UpdateScenarioUseCase.execute()`
- Map `NOT_FOUND` → `404`, `INVALID_INPUT` → `400`, everything else → `500`
- Response shape: `{ scenario: ScenarioSummary & { config } }`

### Stack-E2E Tests

Add to `scenarios.stack-e2e.test.ts` (or create it if not yet present):

- `PATCH /v1/scenarios/:id` with no API key → `401 UNAUTHORIZED`
- `PATCH /v1/scenarios/:id` with wrong API key → `401 UNAUTHORIZED`
- `PATCH /v1/scenarios/nonexistent` → `404 NOT_FOUND`
- `PATCH /v1/scenarios/:id` with empty body `{}` → `400 VALIDATION_ERROR` (no updatable fields)
- Happy-path test (update `name` → response reflects new name): seed a scenario first, then patch it

## Constraints

- TypeScript strict mode — no `any`, all parameters typed
- `UPDATE` query must only set columns that are present in `updates` — do not overwrite fields to `NULL` for absent keys
- Partial update must never clear `config` if config is not passed
- No new dependencies
- Keep `scenarios.ts` route handler lean — instantiate the new use case alongside existing ones

## Deliverables

1. `IScenarioRepository` updated with `update()` method
2. `InMemoryScenarioRepository.update()` implemented + unit tested
3. `UpdateScenarioUseCase` implemented + unit tested (happy path, not found, no-op/empty input)
4. `PATCH /v1/scenarios/{scenarioId}` route handler wired in `scenarios.ts`
5. `scenarios.stack-e2e.test.ts` updated with PATCH coverage (auth, validation, not-found, happy path)

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/API_CONTRACT.md` — replace `PUT /v1/scenarios/{scenarioId}` with `PATCH` semantics (partial update); confirm request/response shapes match implementation
- `docs/PROJECT_STATUS.md` — add note that `PATCH /v1/scenarios/{scenarioId}` is implemented
- Verify `docs/DATA_MODEL.md` `updated_at` trigger behavior aligns with implementation

## Acceptance Criteria

- [ ] `IScenarioRepository` interface defines `update(scenarioId, updates): Promise<Scenario>`
- [ ] `InMemoryScenarioRepository` implements `update()` with merge semantics
- [ ] `PostgresScenarioRepository` implements `update()` with dynamic SQL (only present fields)
- [ ] `UpdateScenarioUseCase` handles happy path, not-found, and empty-input cases
- [ ] `PATCH /v1/scenarios/:scenarioId` returns `200` with updated scenario
- [ ] `PATCH` with unknown ID returns `404`
- [ ] `PATCH` with empty body returns `400`
- [ ] Stack-e2e covers auth enforcement, schema validation, not-found, and happy path
- [ ] `pnpm lint && pnpm typecheck && pnpm test` pass cleanly
- [ ] `docs/API_CONTRACT.md` reflects PATCH semantics
