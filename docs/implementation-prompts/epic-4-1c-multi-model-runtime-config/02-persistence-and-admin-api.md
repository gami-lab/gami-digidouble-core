# 02 — Persistence Layer & Admin API

## Context

Prompt 01 delivered the `ModelConfig` domain type and `ModelResolutionService`. Now we need
to persist the configuration so it survives restarts, and expose admin endpoints so operators
can read and update it without redeployment.

---

## Scope

**In scope:**

- DB migration: `model_config` table (single-row store, JSONB payload)
- `IModelConfigRepository` port
- `PostgresModelConfigRepository` adapter
- `GET /v1/admin/model-config` — returns current effective config
- `PUT /v1/admin/model-config` — replaces global default + role overrides
- Input validation: known provider names, non-empty model strings
- stack-e2e tests for both endpoints

**Out of scope:**

- Per-avatar overrides (prompt 03)
- Wiring into runtime use cases (prompt 04)
- Console UI (prompt 05)

---

## Relevant Docs

- `docs/DATA_MODEL.md` — entity model conventions; follow the same JSONB + `updated_at` pattern
- `docs/API_CONTRACT.md` — `ApiResponse<T>`, `ErrorCode`, admin endpoint conventions
- `docs/ARCHITECTURE.md` — Infrastructure adapters live in `infrastructure/db/`; ports in
  `application/ports/`
- `docs/TEST_STRATEGY.md` — integration tests for repositories; stack-e2e for API
- `apps/core/src/domain/model-config/model-config.types.ts` (from prompt 01)
- `infra/postgres/init.sql` — examine for migration conventions
- `apps/core/src/api/routes/exchange.stack-e2e.test.ts` — stack-e2e pattern to follow

---

## Implementation Guidance

### DB Migration

Table: `model_config`

```sql
CREATE TABLE IF NOT EXISTS model_config (
  id            INTEGER PRIMARY KEY DEFAULT 1
                  CHECK (id = 1),  -- enforces single-row
  config        JSONB NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

The `CHECK (id = 1)` constraint enforces that only one configuration row ever exists.
Use `INSERT ... ON CONFLICT (id) DO UPDATE` (upsert) for writes.

Add the migration to `infra/postgres/init.sql` following existing conventions.

### Port — `IModelConfigRepository`

```
interface IModelConfigRepository {
  get(): Promise<ModelConfig | null>
  upsert(config: ModelConfig): Promise<ModelConfig>
}
```

- `get()` returns `null` if no row exists (callers fall back to `DEFAULT_MODEL_CONFIG`)
- `upsert()` performs a single-row replace and returns the saved record

Place in `apps/core/src/application/ports/IModelConfigRepository.ts`.

### Adapter — `PostgresModelConfigRepository`

Store the config payload as JSONB. Map between DB row and `ModelConfig` domain type explicitly —
do not serialize/deserialize via `any`.

### Admin DTO Contracts

```ts
type ModelConfigResponse = {
  globalDefault: { provider: string; model: string }
  roleOverrides: {
    avatar?: { provider?: string; model?: string }
    gameMaster?: { provider?: string; model?: string }
    memory?: { provider?: string; model?: string }
  }
  updatedAt: string
}
```

Export `ModelConfigResponse` from `packages/shared/src/` alongside the other admin DTOs.
This prevents console duplication of the shape.

### `GET /v1/admin/model-config`

```
GET /v1/admin/model-config
→ ApiResponse<{ modelConfig: ModelConfigResponse }>
```

- Auth: `x-api-key` required (standard admin auth, same as all other admin endpoints)
- If no DB row exists, return `DEFAULT_MODEL_CONFIG` mapped to the DTO
- Never return `404` — always returns current effective config

### `PUT /v1/admin/model-config`

```
PUT /v1/admin/model-config
Body: {
  globalDefault: { provider: string; model: string }
  roleOverrides?: {
    avatar?: { provider?: string; model?: string }
    gameMaster?: { provider?: string; model?: string }
    memory?: { provider?: string; model?: string }
  }
}
→ ApiResponse<{ modelConfig: ModelConfigResponse }>
```

**Validation rules:**

- `globalDefault.provider` must be one of the known `ProviderName` values
- `globalDefault.model` must be a non-empty string
- Any role override `provider`, if provided, must be a known `ProviderName`
- Any role override `model`, if provided, must be a non-empty string
- Unknown fields are rejected (strict schema validation at the API boundary)

Return `VALIDATION_ERROR` with descriptive details on violation.

### Application Use Case

Introduce `GetModelConfigUseCase` and `UpdateModelConfigUseCase` in `application/use-cases/`.
Keep them thin — they delegate to the repository and run validation.

### Server Wiring

- Wire `PostgresModelConfigRepository` into `ServerAdapters` (in `index.ts`)
- Inject the repository into the new use cases
- Register routes under `/v1/admin/model-config`

### stack-e2e Tests

File: `apps/core/src/api/routes/admin-model-config.stack-e2e.test.ts`

Cover:

- `GET` with no API key → `401`
- `GET` with wrong API key → `401`
- `GET` with valid key → `200`, response shape matches `ModelConfigResponse`
- `PUT` with no API key → `401`
- `PUT` with invalid provider → `400 VALIDATION_ERROR`
- `PUT` with empty model string → `400 VALIDATION_ERROR`
- `PUT` with valid body → `200`, response matches updated config
- Second `GET` after `PUT` → returns updated config

---

## Constraints

- No business logic in route handlers; logic lives in use cases
- `ProviderName` validation must use the canonical type from `domain/model-config/model-config.types.ts` — do not hardcode a parallel list in the route handler
- `ModelConfigResponse` shared DTO must be exported from `packages/shared/` — not defined inline
- The single-row constraint must be DB-enforced, not only application-enforced

---

## Deliverables

- `infra/postgres/init.sql` — `model_config` table migration
- `apps/core/src/application/ports/IModelConfigRepository.ts`
- `apps/core/src/infrastructure/db/postgres-model-config.repository.ts`
- `apps/core/src/application/use-cases/get-model-config/get-model-config.use-case.ts`
- `apps/core/src/application/use-cases/update-model-config/update-model-config.use-case.ts`
- `apps/core/src/api/routes/admin-model-config.ts` (GET + PUT handlers)
- `packages/shared/src/` — `ModelConfigResponse` DTO exported
- `apps/core/src/api/routes/admin-model-config.stack-e2e.test.ts`

---

## Mandatory Pre-Implementation Check

Before coding:

1. Check `infra/postgres/init.sql` for migration conventions and table naming patterns.
2. Check `packages/shared/src/` for existing admin DTO exports — add to the same barrel, do not
   create a new file unless the barrel already exists.
3. Search for any existing `model_config` table definition or admin route matching this name.
4. Confirm `IModelConfigRepository` does not already exist in `application/ports/`.

---

## Mandatory Final Step — Documentation Update

After implementation, update:

- `docs/DATA_MODEL.md` — add `model_config` table to the Entity Overview table and add a
  section describing its fields and single-row constraint
- `docs/API_CONTRACT.md` — add `GET /v1/admin/model-config` and `PUT /v1/admin/model-config`
  under an Admin / Model Configuration section
- `docs/PROJECT_STATUS.md` — mark prompt 02 complete under EPIC 4.1c

---

## Acceptance Criteria

- [ ] `model_config` table exists in `init.sql` with single-row constraint
- [ ] `IModelConfigRepository` port defined with `get()` and `upsert()` methods
- [ ] `PostgresModelConfigRepository` handles upsert and null return for empty table
- [ ] `GET /v1/admin/model-config` returns `DEFAULT_MODEL_CONFIG` when table is empty
- [ ] `PUT /v1/admin/model-config` validates provider names and rejects unknown values
- [ ] `ModelConfigResponse` exported from `packages/shared/src/`
- [ ] stack-e2e tests cover auth, validation, happy path
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` pass
