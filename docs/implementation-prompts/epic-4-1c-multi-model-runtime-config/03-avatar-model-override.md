# 03 — Per-Avatar Model Override

## Context

Prompts 01–02 built the global + role-level model configuration. This prompt adds the third
level of the resolution hierarchy: **per-avatar overrides**.

Avatars already have a `config: JSONB` field. The override lives there as
`config.llmOverride: { provider?, model? }`, keeping the schema backward compatible with no
migration required.

The existing `PATCH /v1/avatars/{avatarId}` endpoint already handles `config` updates.
This prompt adds explicit `llmOverride` support to the avatar API contract and
`AvatarSummary` DTO so the console and runtime inspector can read/write it without
parsing raw `config` JSONB.

---

## Scope

**In scope:**

- `AvatarLlmOverride` type exposed in `packages/shared/src/`
- `AvatarSummary.llmOverride` field (additive, optional)
- `CreateAvatarRequest` and `UpdateAvatarRequest` accept `llmOverride` field
- Validation: known provider, non-empty model when provided
- `PostgresAvatarRepository` reads/writes `llmOverride` via `config.llmOverride`
- stack-e2e test coverage for the avatar override flow

**Out of scope:**

- Wiring the override into the actual LLM call (prompt 04)
- Console UI for editing the override (prompt 05)
- Global or role-level config (already covered in prompts 01–02)

---

## Relevant Docs

- `docs/DATA_MODEL.md` — Avatar entity, `config` JSONB field
- `docs/API_CONTRACT.md` — `AvatarSummary`, `PATCH /v1/avatars/{avatarId}`
- `docs/ARCHITECTURE.md` — API boundary validation rules
- `apps/core/src/domain/avatar/avatar.types.ts` — `Avatar`, `AvatarConfig` types
- `apps/core/src/domain/model-config/model-config.types.ts` — `AvatarLlmOverride` (from 01)
- `packages/shared/src/` — existing `AvatarSummary` shared DTO

---

## Implementation Guidance

### Shared DTO Update

In `packages/shared/src/`, add `llmOverride` to `AvatarSummary`:

```ts
type AvatarSummary = {
  // ...existing fields...
  llmOverride?: { provider?: string; model?: string }
}
```

This is an additive change — existing consumers receive `undefined` for avatars without an
override and need no changes.

Also update `CreateAvatarRequest` and the avatar update request type (check the actual names in
`packages/shared/src/`) to accept the optional `llmOverride` field.

### Domain Types

In `avatar.types.ts`, add `llmOverride?: AvatarLlmOverride` to `AvatarConfig`.
Import `AvatarLlmOverride` from the model-config domain types.

### Persistence

`PostgresAvatarRepository`:

- On **read**: extract `config.llmOverride` from the JSONB column and surface it as
  `AvatarConfig.llmOverride`. If absent or malformed, treat as `undefined`.
- On **write** (create/update): merge `llmOverride` into the `config` JSONB column.

Do not introduce a dedicated DB column for `llmOverride` — JSONB is sufficient and avoids a
migration.

### API Handler Updates

`PATCH /v1/avatars/{avatarId}`:

- Accept `llmOverride?: { provider?: string; model?: string }` in the request body.
- Validate: if `provider` is provided, it must be a known `ProviderName`. If `model` is
  provided, it must be a non-empty string.
- Passing `llmOverride: null` or `llmOverride: {}` must clear the override (remove
  `config.llmOverride` from stored JSONB).

`POST /v1/scenarios/{scenarioId}/avatars` (create):

- Accept the same optional `llmOverride` field with the same validation.

`GET /v1/scenarios/{scenarioId}/avatars` and `GET /v1/avatars/{avatarId}`:

- Include `llmOverride` in the response when set.

### Validation

Use the canonical `ProviderName` union from `domain/model-config/model-config.types.ts` for
validation. Do not duplicate the valid provider list.

### stack-e2e Tests

Add to the existing avatar stack-e2e test file (or create
`apps/core/src/api/routes/avatars.stack-e2e.test.ts` if it does not exist):

- `PATCH` with valid `llmOverride.provider` → `200`, response includes `llmOverride`
- `PATCH` with unknown `llmOverride.provider` → `400 VALIDATION_ERROR`
- `PATCH` with empty string `llmOverride.model` → `400 VALIDATION_ERROR`
- `PATCH` with `llmOverride: null` → `200`, override cleared in response
- `GET` after `PATCH` with override → `llmOverride` present in response

---

## Constraints

- No new DB columns or migrations — `config` JSONB is sufficient
- `AvatarLlmOverride` type must be the same type defined in prompt 01's domain module; do not
  redefine it in the shared package
- The `llmOverride` field in `AvatarSummary` is optional — do not make it required (backward
  compatibility)
- Provider validation in the avatar handler must reuse `ProviderName` from domain, not a local
  list

---

## Deliverables

- `packages/shared/src/` — updated `AvatarSummary` with `llmOverride` field
- `apps/core/src/domain/avatar/avatar.types.ts` — `llmOverride` added to `AvatarConfig`
- `apps/core/src/infrastructure/db/postgres-avatar.repository.ts` — read/write `llmOverride`
- `apps/core/src/api/routes/avatars.ts` — validation + handling for `llmOverride`
- `apps/core/src/api/routes/avatars.stack-e2e.test.ts` — override CRUD coverage

---

## Mandatory Pre-Implementation Check

Before coding:

1. Read `packages/shared/src/` to find the exact file and export name for `AvatarSummary`.
2. Read `apps/core/src/domain/avatar/avatar.types.ts` to confirm `AvatarConfig.config` is typed
   as `Record<string, unknown>`.
3. Search for existing `llmOverride` or `llm_override` references to confirm none exist yet.
4. Check `apps/core/src/infrastructure/db/postgres-avatar.repository.ts` to understand how
   `config` JSONB is currently read and written.

---

## Mandatory Final Step — Documentation Update

After implementation, update:

- `docs/API_CONTRACT.md` — add `llmOverride` to `AvatarSummary` DTO, update `PATCH` and
  `POST` avatar request shapes
- `docs/DATA_MODEL.md` — note `config.llmOverride` as a documented JSONB sub-key for Avatar
- `docs/PROJECT_STATUS.md` — mark prompt 03 complete under EPIC 4.1c

---

## Acceptance Criteria

- [ ] `AvatarSummary.llmOverride` field exists in shared package (additive, optional)
- [ ] `AvatarConfig.llmOverride` field exists in domain types
- [ ] `PATCH /v1/avatars/{avatarId}` accepts and persists `llmOverride`
- [ ] Unknown provider in `llmOverride` returns `400 VALIDATION_ERROR`
- [ ] `llmOverride: null` clears the override
- [ ] `GET` responses include `llmOverride` when set
- [ ] stack-e2e tests cover set, invalid, clear flows
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` pass
