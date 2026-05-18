# 04 — Runtime Wiring & Observability

## Context

Prompts 01–03 established types, persistence, admin API, and avatar overrides. The
`ModelResolutionService` exists but nothing calls it yet — all runtime roles still use
the single shared `llmAdapter` created at startup.

This prompt wires the resolution service into the three runtime paths and updates observability
metadata so every LLM call records its effective provider and model.

---

## Scope

**In scope:**

- `LlmAdapterRegistry` — map from `ProviderName` → `ILlmAdapter` (one adapter per configured
  provider)
- Inject `ModelResolutionService` + `IModelConfigRepository` into `SendMessageUseCase`
- Inject `ModelResolutionService` + `IModelConfigRepository` into `RunGameMasterUseCase`
- Inject `ModelResolutionService` + `IModelConfigRepository` into memory compaction use case(s)
- Each use case resolves its (provider, model) at call time and picks the correct adapter
- Observability trace metadata includes `effectiveProvider` and `effectiveModel`
- Backward compatibility: if config table is empty, resolution falls back to
  `DEFAULT_MODEL_CONFIG` (which maps to the existing `LLM_PROVIDER` env behavior when
  configured correctly at the global default level)
- Unit tests for use-case model resolution paths

**Out of scope:**

- Console UI (prompt 05)
- Admin CRUD for model config (already in prompt 02)
- Stack-e2e for avatar override flows (already in prompt 03)

---

## Relevant Docs

- `docs/ARCHITECTURE.md` — infrastructure adapters behind ports; use cases in application layer
- `docs/GAME_MASTER_CONTRACT.md` — GM async non-blocking constraint; must not add latency
- `docs/PRINCIPLES.md` — KISS; avoid unnecessary abstractions
- `apps/core/src/index.ts` — current wiring of `llmAdapter` into use cases
- `apps/core/src/infrastructure/llm/index.ts` — `createLlmAdapter`, `LlmConfig`
- `apps/core/src/application/ports/ILlmAdapter.ts` — `LlmRequest.model` field (already
  supports per-request model override)
- `apps/core/src/application/use-cases/run-game-master/` — GM use case
- `apps/core/src/domain/model-config/model-resolution.service.ts` (from prompt 01)
- `apps/core/src/application/ports/IModelConfigRepository.ts` (from prompt 02)

---

## Implementation Guidance

### LlmAdapterRegistry

Create `apps/core/src/infrastructure/llm/llm-adapter-registry.ts`:

```ts
interface LlmAdapterRegistry {
  get(provider: ProviderName): ILlmAdapter
}
```

Implementation: build one adapter per provider that has credentials available at startup.
Wrap each with `ObservedLlmAdapter`. If a provider is requested but has no credentials, throw a
clear `LlmError` rather than returning a broken adapter.

Build the registry in `index.ts` alongside the existing `createLlmAdapter` call.

**Important:** retain the existing single `llmAdapter` for the `LlmProbe` health check to
avoid breaking dependency monitoring.

### Model Resolution in Use Cases

Each use case that calls an LLM must:

1. Call `modelConfigRepository.get()` — use `DEFAULT_MODEL_CONFIG` if `null`
2. Call `modelResolutionService.resolve(role, config, avatarOverride?)` to get
   `{ provider, model }`
3. Retrieve `registry.get(provider)` to get the correct adapter
4. Pass `model` as `LlmRequest.model` to the adapter call

Do not call `modelConfigRepository.get()` on every request if you can load the config once
during the use-case call. **Do not cache it across requests** in Phase A — the config must be
re-read on each call so admin updates take effect without restart.

### Use Cases to Update

**`SendMessageUseCase`** — role: `'avatar'`

- Resolve using the active avatar's `llmOverride` from its `AvatarConfig`
- Pass `{ provider, model }` to the avatar LLM call

**`RunGameMasterUseCase`** — role: `'gameMaster'`

- No avatar override applies (GM is not an avatar)
- Resolve using `gameMaster` role override or global default

**Memory compaction use cases** — role: `'memory'`

- Identify the use case(s) responsible for working memory refresh and episodic memory
  generation (search for `compaction`, `working memory`, `episodic`)
- Both should resolve with `memory` role

### Observability Metadata

In `LlmRequest.trace.metadata`, add:

```ts
{
  effectiveProvider: string
  effectiveModel: string
}
```

These fields must be present in every LLM call going through the observed adapter.
The existing `ObservedLlmAdapter` already forwards `metadata` to the observability trace —
no changes needed there.

Also emit a log-level `debug` event per resolved call (not per turn) containing
`{ role, effectiveProvider, effectiveModel }`. This aids operational debugging without
polluting production logs.

### Backward Compatibility

The `DEFAULT_MODEL_CONFIG` global default has `provider: 'null'` and `model: ''`.
The server startup must override the default's `globalDefault` with the value from
`config.llmProvider` if no DB row exists, so existing deployments with `LLM_PROVIDER=openai`
continue to work without a manual `PUT /v1/admin/model-config` call.

Specifically: when building the initial fallback in `index.ts`, construct a runtime default:

```ts
const runtimeDefault = {
  ...DEFAULT_MODEL_CONFIG,
  globalDefault: { provider: config.llmProvider, model: '' },
}
```

Where `model: ''` means "use the adapter's own built-in default model". Each adapter already
has a hardcoded `DEFAULT_MODEL` constant — empty string in `LlmRequest.model` should be
treated as "use adapter default" (check current behavior in adapters).

### Unit Tests

- `SendMessageUseCase` uses `avatar` role and reads avatar override
- `RunGameMasterUseCase` uses `gameMaster` role and ignores avatar override
- Memory compaction uses `memory` role
- When config repository returns `null`, resolution uses the env-based fallback
- Observability metadata includes `effectiveProvider` and `effectiveModel`

---

## Constraints

- GM must remain non-blocking — model config resolution adds a single async DB read, which is
  acceptable; it must not block the Avatar's response path
- Do not create a new `ILlmAdapterRegistry` port/interface unless the registry needs to be
  swapped in tests — passing a plain map object is sufficient
- Do not re-read config on every inner loop of a streaming call (if streaming is implemented)
- The `LlmProbe` in `infrastructure/health/` must not break — keep providing it a single adapter

---

## Deliverables

- `apps/core/src/infrastructure/llm/llm-adapter-registry.ts`
- `apps/core/src/index.ts` — updated wiring (registry, resolution service injection)
- `apps/core/src/application/use-cases/send-message/send-message.use-case.ts` — role resolution
- `apps/core/src/application/use-cases/run-game-master/run-game-master.use-case.ts` — role resolution
- Memory compaction use case(s) — role resolution
- Updated observability trace metadata in each use case
- Unit tests covering resolution paths for each use case

---

## Mandatory Pre-Implementation Check

Before coding:

1. Search the codebase for all locations that receive `llmAdapter` as a constructor argument —
   this is the complete set of use cases that need updating.
2. Find the memory compaction use case(s): search for `compaction`, `working_memory`,
   `episodic`, and `memory refresh` in `application/use-cases/`.
3. Read `ObservedLlmAdapter` to confirm that `trace.metadata` fields reach the observability
   backend.
4. Confirm that `LlmRequest.model` is already honored by each adapter (it is — check
   `request.model ?? this.defaultModel` pattern in each adapter).

---

## Mandatory Final Step — Documentation Update

After implementation, update:

- `docs/PROJECT_STATUS.md` — mark prompt 04 complete under EPIC 4.1c
- `docs/ARCHITECTURE.md` — add a note to the LLM infrastructure section describing the
  `LlmAdapterRegistry` and role-based model resolution flow

---

## Acceptance Criteria

- [ ] `LlmAdapterRegistry` builds one adapter per configured provider
- [ ] `SendMessageUseCase` resolves with `avatar` role + avatar's `llmOverride`
- [ ] `RunGameMasterUseCase` resolves with `gameMaster` role
- [ ] Memory compaction use case(s) resolve with `memory` role
- [ ] Each LLM call carries `effectiveProvider` and `effectiveModel` in trace metadata
- [ ] When config table is empty, falls back to `LLM_PROVIDER` env var behavior
- [ ] `LlmProbe` health check still works
- [ ] Unit tests cover resolution for each role and the null-config fallback
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` pass
