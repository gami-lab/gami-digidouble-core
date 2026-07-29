# CONTEXT_CONTRACT_OWNERSHIP_MAP.md

## Purpose

Define canonical ownership for Context Engine contracts (EPIC 5.2) to prevent drift across `apps/core`, `apps/console`, and `packages/shared`.

Last updated: July 29, 2026

---

## Canonical Owners

### Evaluation-Consumed HTTP Contracts

- `ApiResponse` -> `packages/shared/src/api-response.ts`
- `AvatarSummary`, `ScenarioSummary`, `SessionSummary`, and `ConversationSummary` ->
  `packages/shared/src/entity-types.ts`
- `Message`, `MessageMetadata`, `AvatarMessageMetadata`, and `SendMessageResponse` ->
  `packages/shared/src/conversation-contract-types.ts`
- Model catalog and server model-selection contracts -> `packages/shared/src/model-catalog.ts`
- Raw exchange response -> `packages/shared/src/raw-exchange-contract-types.ts`
- Evaluation-only definitions and reports -> `tools/conversation-evaluation/src/contracts.ts`

The evaluator imports these shared HTTP contracts rather than redeclaring entity, message, or
model-selection shapes. Its report types remain local to the tool.

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

### API / Shared LLM Exchange Contracts

- Owner: `packages/shared/src/raw-exchange-contract-types.ts`
- Contract:
  - `RawExchangeResponse`
- Owner: `packages/shared/src/llm-contract-types.ts`
- Contract:
  - `LlmResponseMetrics`
- Used by:
  - Core `/v1/exchange` route response mapping and route tests
  - External tools such as `tools/conversation-evaluation`
- Rule:
  - The raw exchange wire shape remains additive and preserves the existing response fields.
  - Cost is not part of the current raw exchange guarantee.

### Evaluation Tool Contracts

- Owner: `tools/conversation-evaluation/src/contracts.ts`
- Contracts:
  - `TestDefinition`
  - `QuestionResult`
  - `JudgeResult`
  - `RunReport`
- Rule:
  - These are tool-owned report and execution types, not Core domain or HTTP DTOs.
  - The tool imports shared HTTP DTOs at its client boundary and normalizes absent cost to `null`.

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
  - Internal grouping owner: `AvatarContextSnapshot.sections`
  - Canonical section order: Director Notes -> Response Rules -> Conversation State -> User Persona -> World Context -> Retrieved Context -> Avatar Traits
  - Retrieval sections: `knowledge.typedSections.memory|world|media` are canonical and additive (merged `retrievedItems` remains for compatibility)
- GM context snapshot:
  - Internal: `GmContextSnapshot`
  - API-facing: `SessionContextGmSnapshot`
  - Internal grouping owner: `GmContextSnapshot.sections`
  - Rule: GM projection remains separate from Avatar projection; unrestricted retrieval stays internal and is only down-mapped to existing recorded/shared DTOs at the application boundary
- Event-recorded runtime context snapshots:
  - API-facing: `RecordedAvatarContextSnapshot`
  - API-facing: `RecordedGmContextSnapshot`
  - Rule: recorded snapshots reuse the same non-sensitive fragment owners as session-context DTOs and swap only the knowledge payload to provenance-only references
- Token budget and trimming metadata:
  - Internal owner: `apps/core/src/domain/context/context-engine.types.ts` (`ContextEngineTrace`)
  - Internal precedence owner: `apps/core/src/domain/context/context-engine.policy.ts`
  - Rule: section precedence and segment trimming stay internal unless an existing shared runtime-inspector contract explicitly exposes them
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
