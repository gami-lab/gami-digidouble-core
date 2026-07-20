# CONTEXT_CONTRACT_OWNERSHIP_MAP.md

## Purpose

Define canonical ownership for Context Engine contracts (EPIC 5.2) to prevent drift across `apps/core`, `apps/console`, and `packages/shared`.

Last updated: July 20, 2026

---

## Canonical Owners

### Internal Context Engine Contracts (domain/internal)

- Owner: `apps/core/src/domain/context/session-context.types.ts`
- Contracts:
  - `ContextScenarioSnapshot`
  - `ContextAvailableAvatarSnapshot`
  - `AvatarContextSnapshot`
  - `GmContextSnapshot`
  - `SessionContextSnapshot`
- Used by:
  - `GetSessionContextUseCase`
  - GM/context-adjacent use cases that need scenario context fragments

### API / Shared DTO Contracts (public/admin)

- Owner: `packages/shared/src/runtime-inspector-types.ts`
- Contracts:
  - `SessionContextRecentMessage`
  - `SessionContextAvailableAvatar`
  - `SessionContextAvatarWorkingMemory`
  - `SessionContextGmMemory`
  - `SessionContextScenarioSnapshot`
  - `SessionContextAvatarSnapshot`
  - `SessionContextGmSnapshot`
  - `RecordedAvatarContextSnapshot`
  - `RecordedGmContextSnapshot`
  - `AdminSessionContextResponse`
- Used by:
  - Core API routes
  - Console API client and runtime inspector UI

### Internal Avatar Prompt Contracts (domain/runtime)

- Owner: `apps/core/src/domain/avatar/persona-prompt.types.ts`
- Contracts:
  - `AvatarAwarenessItem`
  - `AvatarPromptOptions`
  - `AvatarPromptIdentitySource`
- Used by:
  - `assemblePersonaPrompt`
  - avatar-awareness assembly
  - later EPIC 8.2 prompt-order refactors

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
  - Retrieval sections: `knowledge.typedSections.memory|world|media` are canonical and additive (merged `retrievedItems` remains for compatibility)
- GM context snapshot:
  - Internal: `GmContextSnapshot`
  - API-facing: `SessionContextGmSnapshot`
- Event-recorded runtime context snapshots:
  - API-facing: `RecordedAvatarContextSnapshot`
  - API-facing: `RecordedGmContextSnapshot`
  - Rule: recorded snapshots reuse the same non-sensitive fragment owners as session-context DTOs and swap only the knowledge payload to provenance-only references
- Token budget and trimming metadata:
  - No standalone shared DTO currently exposed in Phase A.
  - Existing bounded-selection observability remains in memory-layer contracts (`packages/shared/src/lifecycle-types.ts` -> `SessionMemoryLayers.observability`).
- Context observability payloads:
  - Current API-facing observability is memory-centric and remains owned by shared lifecycle DTOs.
- Avatar identity compatibility boundary:
  - Internal owner: `apps/core/src/domain/avatar/persona-prompt.service.ts#resolveAvatarPromptIdentitySource`
  - Rule: prepared `computedTraits` are the preferred runtime identity input; when traits are absent internally (`undefined`) or unprepared over HTTP (`computedTraits: null`), runtime prompt assembly must fall back to the authored `personaPrompt`

---

## Anti-Duplication Rules

- Do not define API-facing context DTOs in `apps/core`.
- Do not return shared DTO types directly from domain/internal modules.
- If a new context contract is internal-only, define it in `domain/context`.
- If a new context contract crosses app boundaries, define it in `packages/shared` and map at API boundaries.
- If a new session/conversation HTTP contract crosses app boundaries, define it in `packages/shared/src/conversation-contract-types.ts`.
