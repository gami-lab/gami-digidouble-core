# 01 — Model Config Domain & Resolution Service

## Context

Currently, a single `LLM_PROVIDER` environment variable determines which provider is used for
**all** runtime roles: Avatar speaking, Game Master orchestration, and Memory compaction.
`createLlmAdapter` creates one adapter instance wired to everything.

This prompt introduces the domain-layer foundation for role-based model selection:
canonical types, a resolution service, and unit tests — with no infrastructure changes yet.

---

## Scope

**In scope:**

- `ModelConfig` domain type (global default + per-role overrides)
- `ModelRole` union type (`'avatar' | 'gameMaster' | 'memory'`)
- `ModelResolutionService` — pure resolution logic, no I/O
- Avatar model override representation (read from `avatar.config.llmOverride`)
- Unit tests for all resolution paths

**Out of scope:**

- Persistence (prompt 02)
- API endpoints (prompt 02)
- Runtime wiring into use cases (prompt 04)
- Console UI (prompt 05)

---

## Relevant Docs

- `docs/ARCHITECTURE.md` — 4-layer boundary rules; domain code has no infrastructure imports
- `docs/PRINCIPLES.md` — KISS, no speculative abstractions
- `docs/DATA_MODEL.md` — `Avatar.config` JSONB shape (existing)
- `docs/TECH_STACK.md` — TypeScript strict mode, no `any`
- `apps/core/src/config.ts` — current `llmProvider` env var (global fallback)
- `apps/core/src/infrastructure/llm/index.ts` — existing provider set: `openai | anthropic | mistral | xai | null`

---

## Implementation Guidance

### Types — `apps/core/src/domain/model-config/model-config.types.ts`

```
ModelRole = 'avatar' | 'gameMaster' | 'memory'

ProviderName = 'openai' | 'anthropic' | 'mistral' | 'xai' | 'null'

ModelOverride = {
  provider?: ProviderName   // if absent, inherits from lower-precedence level
  model?: string            // if absent, inherits from lower-precedence level
}

RoleOverrides = Partial<Record<ModelRole, ModelOverride>>

ModelConfig = {
  globalDefault: { provider: ProviderName; model: string }
  roleOverrides: RoleOverrides
  updatedAt: string
}
```

Keep `ProviderName` as a string union — it is the single canonical source of valid provider names
for the whole codebase. No other constant list should exist elsewhere.

### Avatar Override Representation

Avatar overrides live in `avatar.config.llmOverride` (JSONB). The shape to read:

```
AvatarLlmOverride = { provider?: ProviderName; model?: string }
```

The resolution service must accept an optional `AvatarLlmOverride | undefined` argument.
Do not import the `Avatar` entity from domain/model-config — pass only the override value.

### Resolution Service — `apps/core/src/domain/model-config/model-resolution.service.ts`

```
resolve(
  role: ModelRole,
  config: ModelConfig,
  avatarOverride?: AvatarLlmOverride,
): { provider: ProviderName; model: string }
```

Resolution order (highest to lowest precedence):

1. `avatarOverride.provider` / `avatarOverride.model` (only relevant for `role === 'avatar'`)
2. `config.roleOverrides[role]?.provider` / `...model`
3. `config.globalDefault.provider` / `config.globalDefault.model`

Each field (`provider` and `model`) resolves independently. It is valid for an avatar override
to specify only `model` while inheriting `provider` from the role or global level.

### Default Config

Provide a `DEFAULT_MODEL_CONFIG` constant that mirrors the current env-based setup:

```
DEFAULT_MODEL_CONFIG = {
  globalDefault: { provider: 'null', model: '' },
  roleOverrides: {},
  updatedAt: new Date(0).toISOString(),
}
```

This constant is used as the fallback when no row exists in the DB.

### Unit Tests

Cover all resolution branches:

- all three roles with no overrides → returns global default
- role override for `gameMaster` → GM uses role override, avatar uses global default
- avatar override with provider only → avatar provider overrides, model falls back to role/global
- avatar override with model only → avatar model overrides, provider falls back
- avatar override for non-avatar role → override is ignored (resolution is role-specific)
- `null` provider and empty model string in global default → still resolves without error

---

## Constraints

- No infrastructure imports inside `domain/model-config/`
- No `any` types
- `ProviderName` must be a TypeScript string union, not a plain `string`
- Resolution must be a pure function — no async, no I/O, no side effects
- Do not modify existing files in this prompt

---

## Deliverables

- `apps/core/src/domain/model-config/model-config.types.ts`
- `apps/core/src/domain/model-config/model-resolution.service.ts`
- `apps/core/src/domain/model-config/model-resolution.service.test.ts`
- `apps/core/src/domain/model-config/index.ts` (barrel export)

---

## Mandatory Pre-Implementation Check

Before coding:

1. Search for any existing `provider`, `model`, or `llmProvider` string literals used as types
   elsewhere in the codebase (config.ts, llm/index.ts, adapters).
2. Confirm no existing `ProviderName` or `ModelRole` type definition exists.
3. Confirm `avatar.config` is the correct field for avatar-level overrides (see `DATA_MODEL.md`
   and `avatar.types.ts`).
4. Do not create a canonical `ProviderName` list inside infrastructure — it must live in domain.

---

## Mandatory Final Step — Documentation Update

After implementation, verify:

- `docs/PROJECT_STATUS.md` — mark prompt 01 complete under EPIC 4.1c section (create if absent)
- No other doc changes required for this prompt (domain-only, no API or schema changes)

---

## Acceptance Criteria

- [ ] `ModelConfig`, `ModelRole`, `ProviderName`, `ModelOverride`, `RoleOverrides` types defined
- [ ] `AvatarLlmOverride` type defined
- [ ] `DEFAULT_MODEL_CONFIG` constant defined
- [ ] `ModelResolutionService.resolve()` implements the three-level resolution order
- [ ] All resolution branches covered by unit tests
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` pass with no regressions
