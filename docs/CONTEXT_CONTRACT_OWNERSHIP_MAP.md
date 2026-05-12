# CONTEXT_CONTRACT_OWNERSHIP_MAP.md

## Purpose

Define canonical ownership for Context Engine contracts (EPIC 5.2) to prevent drift across `apps/core`, `apps/console`, and `packages/shared`.

Last updated: May 12, 2026

---

## Canonical Owners

### Internal Context Engine Contracts (domain/internal)

- Owner: `apps/core/src/domain/context/session-context.types.ts`
- Contracts:
  - `ContextScenarioSnapshot`
  - `AvatarContextSnapshot`
  - `GmContextSnapshot`
  - `SessionContextSnapshot`
- Used by:
  - `GetSessionContextUseCase`
  - GM/context-adjacent use cases that need scenario context fragments

### API / Shared DTO Contracts (public/admin)

- Owner: `packages/shared/src/runtime-inspector-types.ts`
- Contracts:
  - `SessionContextScenarioSnapshot`
  - `SessionContextAvatarSnapshot`
  - `SessionContextGmSnapshot`
  - `AdminSessionContextResponse`
- Used by:
  - Core API routes
  - Console API client and runtime inspector UI

### API / Shared Conversation DTO Contracts (public/session)

- Owner: `packages/shared/src/conversation-contract-types.ts`
- Contracts:
  - `Message`
  - `MessageMetadata`
  - `AvatarMessageMetadata`
  - `SendMessageResponse`
  - `GetHistoryResponse`
  - `AvailableAvatarSummary`
  - `GetAvailableAvatarsResponse`
  - `SwitchAvatarResponse`
- Used by:
  - Core conversation/session routes and use-case output typing
  - Console session/message API client wrappers

### Boundary Mapping

- Owner: `apps/core/src/api/routes/mappers/session-context.mapper.ts`
- Contract mapping:
  - `SessionContextSnapshot` -> `AdminSessionContextResponse`
- Rule:
  - Route handlers return shared DTOs via explicit mappers.
  - Application/domain use cases return internal contracts.

---

## Inventory Notes For EPIC 5.2 Inputs

- Runtime context input/output:
  - Internal: `domain/context/session-context.types.ts`
  - API-facing: `packages/shared/src/runtime-inspector-types.ts`
- Avatar context snapshot:
  - Internal: `AvatarContextSnapshot`
  - API-facing: `SessionContextAvatarSnapshot`
- GM context snapshot:
  - Internal: `GmContextSnapshot`
  - API-facing: `SessionContextGmSnapshot`
- Token budget and trimming metadata:
  - No standalone shared DTO currently exposed in Phase A.
  - Existing bounded-selection observability remains in memory-layer contracts (`packages/shared/src/lifecycle-types.ts` -> `SessionMemoryLayers.observability`).
- Context observability payloads:
  - Current API-facing observability is memory-centric and remains owned by shared lifecycle DTOs.

---

## Anti-Duplication Rules

- Do not define API-facing context DTOs in `apps/core`.
- Do not return shared DTO types directly from domain/internal modules.
- If a new context contract is internal-only, define it in `domain/context`.
- If a new context contract crosses app boundaries, define it in `packages/shared` and map at API boundaries.
- If a new session/conversation HTTP contract crosses app boundaries, define it in `packages/shared/src/conversation-contract-types.ts`.
