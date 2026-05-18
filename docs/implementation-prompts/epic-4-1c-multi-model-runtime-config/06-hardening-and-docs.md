# 06 — Hardening, Backward Compatibility & Doc Sync

## Context

Prompts 01–05 delivered the full EPIC implementation. This final prompt closes open risk areas:
validation edge cases, backward compatibility assertions, integration verification, and complete
documentation sync. The goal is a production-ready, fully documented delivery.

---

## Scope

**In scope:**

- Validation hardening for `PUT /v1/admin/model-config` and avatar override endpoints
- Backward compatibility test: existing sessions without model config continue working
- Integration test: `PUT` → restart server → `GET` returns updated config
- Ensure `LlmAdapterRegistry` fails fast with a clear error when a configured role override
  points to a provider with no credentials
- Final doc sync: `DATA_MODEL.md`, `API_CONTRACT.md`, `ARCHITECTURE.md`, `PROJECT_STATUS.md`
- EPIC 4.1c marked complete in `PROJECT_STATUS.md`

**Out of scope:**

- New features or architectural changes
- Console UI changes (already covered in prompt 05)

---

## Relevant Docs

All docs touched in prompts 01–05:

- `docs/DATA_MODEL.md`
- `docs/API_CONTRACT.md`
- `docs/ARCHITECTURE.md`
- `docs/PROJECT_STATUS.md`

---

## Implementation Guidance

### Validation Hardening

#### `PUT /v1/admin/model-config` — additional edge cases

Verify (add test coverage if not already present):

- Body with extra unknown top-level fields → `400 VALIDATION_ERROR` (strict schema)
- `globalDefault.model` as whitespace-only string → `400 VALIDATION_ERROR`
- `roleOverrides` as an array instead of object → `400 VALIDATION_ERROR`
- `roleOverrides.avatar` with `provider` set to `null` (JSON null) → `400 VALIDATION_ERROR`
  (must be a valid provider string or the field must be absent)
- Very long model string (> 200 chars) → `400 VALIDATION_ERROR` with clear message

#### Avatar `llmOverride` validation

- `llmOverride.provider` as empty string → `400 VALIDATION_ERROR`
- `llmOverride.model` as whitespace-only → `400 VALIDATION_ERROR`

### LlmAdapterRegistry — Missing Credentials

When `ModelResolutionService` resolves to a provider that has no API key configured
(e.g., `anthropic` selected but `ANTHROPIC_API_KEY` is absent), the registry must throw an
`LlmError` with a clear message:
`"Provider 'anthropic' is configured for role 'avatar' but no API key is available."`

This surfaces misconfiguration immediately at runtime rather than producing a cryptic auth
error from the provider.

### Backward Compatibility

Add a focused integration test (or extend an existing one) that asserts:

1. Server starts with no `model_config` row in the database
2. `SendMessageUseCase` completes a turn successfully (using the env-based fallback)
3. No error is thrown during model resolution

This protects against a regression where an empty `model_config` table breaks existing sessions.

### Documentation Sync

Go through each doc and verify it reflects the implemented state:

#### `docs/DATA_MODEL.md`

Confirm:

- `model_config` table is documented under the Entity Overview table
- `model_config` section describes: single-row constraint, `config` JSONB shape,
  `updated_at` field
- Avatar entity section notes `config.llmOverride` as a documented sub-key

#### `docs/API_CONTRACT.md`

Confirm:

- `GET /v1/admin/model-config` is documented
- `PUT /v1/admin/model-config` is documented with request shape and validation rules
- `AvatarSummary` includes `llmOverride` field documentation
- Create avatar and update avatar requests document `llmOverride`
- Admin session inspect endpoint documents `effectiveModels` field

#### `docs/ARCHITECTURE.md`

Confirm:

- LLM infrastructure section references `LlmAdapterRegistry`
- Role-based model resolution is described (one paragraph is sufficient)
- The three runtime roles (`avatar`, `gameMaster`, `memory`) are named

#### `docs/PROJECT_STATUS.md`

Add a complete EPIC 4.1c section following the exact format of other completed EPICs:

```markdown
## EPIC 4.1c — Multi-Model Runtime Configuration

Status: ✅ Complete
Completed on: [date]

### Includes

- `ModelConfig` domain type, `ModelRole`, `ProviderName` canonical types
- `ModelResolutionService` — three-level deterministic resolution
- `model_config` single-row persistence table
- `GET /v1/admin/model-config` and `PUT /v1/admin/model-config` admin endpoints
- Per-avatar `llmOverride` in `avatar.config` JSONB
- `AvatarSummary.llmOverride` in shared DTO
- `LlmAdapterRegistry` — per-provider adapter map
- Role-based LLM adapter selection in `SendMessageUseCase`, `RunGameMasterUseCase`,
  memory compaction use cases
- `effectiveProvider` + `effectiveModel` in observability trace metadata
- `effectiveModels` in admin session inspect response
- Console model config editor (global default + role overrides)
- Console avatar form `llmOverride` fields
- Runtime inspector `effectiveModels` display

### Key Decisions

- Avatar overrides stored in `avatar.config.llmOverride` JSONB — no new DB column
- `model_config` uses single-row constraint (CHECK id = 1)
- Resolution falls back to env `LLM_PROVIDER` when no DB row exists
- No automatic model routing — configuration-driven only
```

---

## Constraints

- No new features in this prompt — hardening and documentation only
- Do not refactor code unrelated to EPIC 4.1c
- Documentation updates must reflect actual implemented behavior, not aspirational state

---

## Deliverables

- Updated validation in `PUT /v1/admin/model-config` handler for edge cases
- Updated validation in avatar handler for `llmOverride` edge cases
- `LlmAdapterRegistry` missing-credentials error path + test
- Backward compatibility test for null `model_config` table
- `docs/DATA_MODEL.md` — fully updated
- `docs/API_CONTRACT.md` — fully updated
- `docs/ARCHITECTURE.md` — LLM section updated
- `docs/PROJECT_STATUS.md` — EPIC 4.1c section added and marked complete

---

## Mandatory Pre-Implementation Check

Before coding:

1. Run `pnpm lint`, `pnpm typecheck`, `pnpm test` to establish a clean baseline.
2. Read each doc section that should be updated and note what is missing vs implemented.
3. Check the `model_config` table exists in `init.sql` and the migration ran on the test DB.

---

## Mandatory Final Step — Documentation Update

This prompt IS the documentation update. Verify every doc listed above is updated before
marking the EPIC complete.

---

## Acceptance Criteria

- [ ] Whitespace-only model string rejected with `400 VALIDATION_ERROR`
- [ ] Extra fields in `PUT /v1/admin/model-config` body rejected
- [ ] `LlmAdapterRegistry` emits clear error for missing credentials
- [ ] Backward compatibility test passes with empty `model_config` table
- [ ] `docs/DATA_MODEL.md` documents `model_config` table and `avatar.config.llmOverride`
- [ ] `docs/API_CONTRACT.md` documents both model-config endpoints and avatar `llmOverride`
- [ ] `docs/ARCHITECTURE.md` references `LlmAdapterRegistry` and role-based resolution
- [ ] `docs/PROJECT_STATUS.md` includes EPIC 4.1c complete section
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` pass with no regressions
