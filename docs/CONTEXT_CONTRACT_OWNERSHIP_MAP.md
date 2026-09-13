# CONTEXT_CONTRACT_OWNERSHIP_MAP.md

## Purpose

Define canonical ownership for Context Engine contracts (EPIC 5.2) to prevent drift across `apps/core`, `apps/console`, and `packages/shared`.

Last updated: September 13, 2026

EPIC 10.1 Prompts 0 and 1 extend this map to the high-fan-out Avatar, Scenario, Session,
Conversation, Message, Game Master, lifecycle, memory, retrieval, event, admin, console, and web
contracts, including their fresh-database persistence boundary.

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
- Evaluation-only definitions, configuration, and reports -> `tools/conversation-evaluation/src/`

The evaluator imports these shared HTTP contracts rather than redeclaring entity, message, or
model-selection shapes. Its report types remain local to the tool.

### Static Knowledge Contract Ownership

- Canonical HTTP owner: `packages/shared/src/knowledge-contract-types.ts`
- `KnowledgeType` is exactly `avatar_knowledge | world | media`.
  - Source/chunk DTOs, typed retrieval sections, and retrieval trace `perType` keys use the
    canonical `avatar_knowledge` key.
- Canonical internal owner: `apps/core/src/domain/knowledge/knowledge.types.ts`
  - Internal retrieval and source/chunk domain shapes use the same canonical `KnowledgeType`.
- Boundary validation owner: `apps/core/src/api/routes/knowledge.ts` uses the shared canonical
  tuple for schema validation. Reserved metadata-key validation belongs to
  `apps/core/src/domain/knowledge/static-knowledge-validation.ts`.
- Persistence owner: `knowledge_sources` and `knowledge_chunks` in the PostgreSQL schema and
  repositories. The schema and repositories persist only canonical static knowledge types.

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

### Operator Inspection Projections

- Static source DTOs -> `packages/shared/src/knowledge-contract-types.ts`
  (`KnowledgeSourceDto` and canonical knowledge labels). Core's
  knowledge-source presenter is the redaction boundary; admin and console render the shared DTO
  rather than declaring local category/status shapes.
- Layered conversational inspection -> `packages/shared/src/lifecycle-types.ts`
  (`SessionMemoryLayers`) composed with `packages/shared/src/memory-contract-types.ts`. Core's
  `GetSessionMemoryLayersUseCase` maps persistence/repository entities and supplies `userId`; the
  console renders user/session/conversation scope without treating it as static knowledge scope.
- Runtime context and event inspection -> `packages/shared/src/runtime-inspector-types.ts` and
  the existing Core event/context mappers. Static `retrievedContext` keeps source/chunk/type
  provenance; `conversationState` keeps bounded memory layers. Legacy event normalization is
  limited to deserialization and current output uses canonical categories.

- Owner: `apps/core/src/api/routes/mappers/session-context.mapper.ts`
- Contract mapping:
  - `SessionContextSnapshot` -> `AdminSessionContextResponse`
- Rule:
  - Route handlers return shared DTOs via explicit mappers.
  - Application/domain use cases return internal contracts.

---

## EPIC 4.2d Ownership Inventory

This is the ownership baseline for the static-knowledge/conversational-memory separation.
Canonical static terminology is now `avatar_knowledge | world | media`; conversational-memory
contracts retain their `memory` terminology and lifecycle ownership.

### Static knowledge and RAG

| Shape                                                                                                                                                                                                                                                           | Canonical owner                                                                                                                                                                                            | Mapping boundary and consumers                                                                                                                                                                                                                                                                                                                               |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `KnowledgeType` and the exhaustive category list                                                                                                                                                                                                                | `packages/shared/src/knowledge-contract-types.ts` (`KnowledgeType`, `KNOWLEDGE_TYPES`)                                                                                                                     | Domain re-exports the shared value type in `apps/core/src/domain/knowledge/knowledge.types.ts`; API schemas, retrieval iteration, application validation, and admin rendering reuse the shared tuple.                                                                                                                                                        |
| `KnowledgeSource`, `KnowledgeChunk`, `RetrievedKnowledgeItem`, `VectorRetrievalCandidate`, `TypedRetrievalResult`                                                                                                                                               | `apps/core/src/domain/knowledge/knowledge.types.ts`                                                                                                                                                        | Application services and repository ports consume these internal shapes; presenters map them to shared DTOs. Infrastructure database rows are private adapter shapes and never become HTTP contracts.                                                                                                                                                        |
| Source create/list/update/upload and chunk/list/retrieval request/response DTOs                                                                                                                                                                                 | `packages/shared/src/knowledge-contract-types.ts`                                                                                                                                                          | `apps/core/src/api/routes/knowledge.ts` validates requests and maps application results; `apps/admin/src/api/knowledge.ts` and `apps/console/src/api/knowledge.ts` reuse the shared DTOs rather than copying them.                                                                                                                                           |
| Typed retrieval input                                                                                                                                                                                                                                           | `packages/shared/src/knowledge-contract-types.ts` (`QueryKnowledgeRetrievalRequest`) at HTTP; `apps/core/src/application/services/knowledge/typed-retrieval.service.ts` (`TypedRetrievalInput`) internally | `GetTypedRetrievalUseCase` explicitly maps the HTTP request into the internal retrieval input. The internal service owns query embedding, visibility mode, and repository orchestration. The request contains scenario/query/Avatar-visibility inputs only; user, session, and conversation IDs are conversational-memory contracts, never static RAG scope. |
| Typed/recorded knowledge sections and retrieval traces (`TypedKnowledgeRetrievalDto`, `SharedTypedKnowledgeSections`, `RecordedTypedKnowledgeSections`, `SharedAvatarContextKnowledgeInjection`, `RecordedAvatarContextKnowledgeInjection`, and GM equivalents) | Internal: `apps/core/src/domain/context/session-context.types.ts` and `apps/core/src/domain/knowledge/knowledge.types.ts`; shared: `packages/shared/src/knowledge-contract-types.ts`                       | `context-engine.service.ts` assembles internal sections; `runtime-inspector-event-context.ts` maps them to recorded references; `session-context.mapper.ts` maps session snapshots to `runtime-inspector-types.ts`; retrieval presenters own truncation/rounding.                                                                                            |
| Source/chunk persistence fields                                                                                                                                                                                                                                 | `apps/core/src/domain/knowledge/knowledge.types.ts` for entity semantics; PostgreSQL adapter rows in `apps/core/src/infrastructure/db/repositories/postgres-knowledge-{source,chunk}.repository.ts`        | Repository row mappers are the only persistence boundary. `knowledge_sources.knowledge_type`, metadata, source visibility, chunk metadata, and chunk visibility remain scenario/static fields in this slice.                                                                                                                                                 |
| Prompt projection                                                                                                                                                                                                                                               | `apps/core/src/domain/avatar/persona-prompt.service.ts` for Avatar; `apps/core/src/domain/game-master/gm-input-renderer.ts` for GM                                                                         | Context Engine supplies typed retrieved sections. Prompt renderers consume the internal projection and do not read HTTP DTOs or memory repositories.                                                                                                                                                                                                         |
| Runtime diagnostics and recorded event payloads                                                                                                                                                                                                                 | Shared safe DTOs in `packages/shared/src/runtime-inspector-types.ts` and `packages/shared/src/knowledge-contract-types.ts`                                                                                 | Core event reconstruction and context mappers down-map internal content to bounded references; admin/console clients display these shared projections. Retrieval diagnostics contain scenario/corpus/visibility facts, not user/session/conversation scope. Raw vectors are never projected.                                                                 |
| Seeds and fixtures                                                                                                                                                                                                                                              | Seed input contracts in `apps/core/src/seed/murder-party/setup-via-api.seed.ts`; test builders remain colocated with their tests                                                                           | Seeds and fixtures use shared/domain types at their boundary. They are not alternate contract owners.                                                                                                                                                                                                                                                        |

### Conversational memory

| Shape                                                                                                                                                                                                      | Canonical owner                                                                                                                                                                                                       | Mapping boundary and consumers                                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Recent messages and exchanges (`ContextMessage`, `ShortTermMemoryExchange`, `ShortTermMemoryWindow`, and shared `SharedShortTermMemorySnapshot`)                                                           | `apps/core/src/domain/conversation/session.types.ts` for persisted messages; `apps/core/src/domain/memory/memory.types.ts` for memory projections; `packages/shared/src/memory-contract-types.ts` for HTTP projection | `conversation-exchange-window.ts` derives bounded exchanges from message history; context assembly maps them into Avatar/GM internal snapshots. No short-term memory table exists.                 |
| Conversation working memory                                                                                                                                                                                | `apps/core/src/domain/memory/memory.types.ts` (`ConversationWorkingMemory`, snapshots, refresh output)                                                                                                                | `IConversationWorkingMemoryRepository` is the application port; in-memory/PostgreSQL repositories are infrastructure adapters; `memory-maintenance.service.ts` is the sole refresh workflow owner. |
| Episodic `ConversationMemory`                                                                                                                                                                              | `apps/core/src/domain/memory/memory.types.ts`                                                                                                                                                                         | `IConversationMemoryRepository` and its infrastructure adapters own persistence; `memory-selection.service.ts` selects bounded episodes for new conversations and GM input.                        |
| Session/avatar working-memory summaries                                                                                                                                                                    | `apps/core/src/domain/memory/memory.types.ts` (`SessionMemory`, `AvatarSessionMemory`, layered snapshot)                                                                                                              | Session/avatar memory repositories map persistence into `LayeredMemorySnapshot`; shared projections are exposed through `packages/shared/src/memory-contract-types.ts` and lifecycle types.        |
| Durable `UserFact` and fact records                                                                                                                                                                        | `apps/core/src/domain/memory/memory.types.ts` (`UserFact`, `MemoryFactRecord`)                                                                                                                                        | `IUserMemoryFactRepository` and the PostgreSQL/in-memory adapters own persistence; extraction is fed by compacted conversational memory, not static knowledge chunks.                              |
| Shared/admin memory DTOs (`SharedWorkingMemoryCurrent`, `SharedLongTermAvatarMemory`, `SessionMemorySummary`, `SessionMemoryLayers`, `AdminSessionMemoryResponse`, and `AdminSessionMemoryLayersResponse`) | `packages/shared/src/memory-contract-types.ts` plus `packages/shared/src/lifecycle-types.ts`                                                                                                                          | `packages/shared/src/runtime-inspector-types.ts` composes these into admin memory, event, and context DTOs. Core maps internal memory snapshots at use-case/API boundaries.                        |
| Avatar memory prompt projection                                                                                                                                                                            | `apps/core/src/domain/avatar/persona-prompt.service.ts`                                                                                                                                                               | `LayeredMemorySnapshot` is rendered under `Conversation State`; retrieved static knowledge remains a separate `Retrieved Context` projection.                                                      |
| GM memory prompt projection                                                                                                                                                                                | `apps/core/src/domain/game-master/game-master.types.ts` and `gm-input-renderer.ts`                                                                                                                                    | `GameMasterMemoryContext` is selected by application services and rendered separately from GM retrieved knowledge.                                                                                 |
| Memory diagnostics/events and client mirrors                                                                                                                                                               | `packages/shared/src/runtime-inspector-types.ts`                                                                                                                                                                      | `runtime-inspector-event-context.ts` and session-context mappers provide the only internal-to-shared mapping; console/admin components consume shared types or derive view-only local state.       |

### Retrieval and lifecycle boundary

- Static retrieval candidate ownership belongs to the scenario knowledge corpus. The canonical
  filters are scenario, `avatar_knowledge|world|media`, ready source, active profile/generation,
  and Avatar visibility; `gm_unrestricted` bypasses visibility only.
- Static retrieval accepts conversational text as a query but has no user/session/conversation
  input, metadata matching, or scope score boost. Reserved scope keys are rejected recursively on
  source/chunk create, update, ingestion, and reindex writes.
- Session reset owns messages and session/conversational-memory rows; conversation close owns the
  episodic/fact background pipeline; memory maintenance owns working-memory refresh. None owns RAG
  repositories or embeddings.
- Scenario deletion owns scenario knowledge removal through the database foreign-key cascade, and
  static reindex owns corpus generations/chunks only. These boundaries are asserted by focused
  application/repository tests rather than duplicated DTOs.

The final cross-boundary proof for these owners, including two-user consistency/isolation and
close, switch, reset, reindex, and scenario-cascade boundaries, is maintained in
[EPIC_4_2D_REQUIREMENTS_MATRIX.md](EPIC_4_2D_REQUIREMENTS_MATRIX.md).

### Duplication removed before terminology changes

- `KNOWLEDGE_TYPES` is the shared exhaustive tuple; `KnowledgeType` is derived from it instead of
  repeating the union in routes, use cases, retrieval, or admin rendering.
- Admin and console retrieval clients construct requests from the shared retrieval request type;
  neither carries lifecycle scope fields. The Avatar prompt test derives its retrieval item
  category from shared `KnowledgeType`.
- Internal domain and shared DTO section types remain separate deliberately: their item types and
  provenance differ, and explicit mappers are the boundary rather than a copied HTTP shape.

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
  - Retrieval sections: `knowledge.typedSections.avatar_knowledge|world|media` are the canonical
    structured projection; recorded event readers accept only the sectioned shape.
- GM context snapshot:
  - Internal: `GmContextSnapshot`
  - API-facing: `SessionContextGmSnapshot`
  - Internal grouping owner: `GmContextSnapshot.sections`
  - Rule: GM projection remains separate from Avatar projection; `conversationState` contains only conversational memory layers and `retrievedContext` contains only static typed knowledge with provenance. GM uses its explicit unrestricted retrieval result and never silently falls back to the Avatar-filtered result.

### Context projection contract

- `AvatarContextSnapshot.sections.conversationState` and `GmContextSnapshot.sections.conversationState`
  are the canonical internal projections for recent messages/exchanges, working memory, episodic
  memories, and long-term user facts.
- `AvatarContextSnapshot.sections.retrievedContext` and
  `GmContextSnapshot.sections.retrievedContext` are the canonical static projections for exactly
  `avatar_knowledge`, `world`, and `media`. Each item retains source ID, chunk ID, canonical type,
  and retrieval evidence allowed by the internal type.
- `packages/shared/src/runtime-inspector-types.ts` owns the public/admin mirror. Core maps internal
  snapshots explicitly in `session-context.mapper.ts` and recorded event context. Event readers
  accept only the current structured sections shape and emit the canonical separated projection.
- `persona-prompt.service.ts` and `gm-input-renderer.ts` render stable `## Conversation State` and
  `## Retrieved Context` headings. Retrieved documents are not inputs to working-memory refresh or
  user-fact extraction merely because they were rendered.
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
- Avatar identity and prompt boundary:
  - Internal owner: `apps/core/src/domain/avatar/persona-prompt.service.ts`
  - Rule: prompt assembly consumes structured context sections and requires prepared `computedTraits`; authored `personaPrompt` remains authoring data and is not a runtime identity fallback

---

## Anti-Duplication Rules

- Do not define API-facing context DTOs in `apps/core`.
- Do not return shared DTO types directly from domain/internal modules.
- If a new context contract is internal-only, define it in `domain/context`.
- If a new context contract crosses app boundaries, define it in `packages/shared` and map at API boundaries.
- If a new session/conversation HTTP contract crosses app boundaries, define it in `packages/shared/src/conversation-contract-types.ts`.

## EPIC 10.1 Canonical Entity Baseline

The following table is the current contract baseline. Internal entities and public DTOs are
deliberately separate; the mapper is the only place where the two shapes cross.

| Contract                     | Internal owner                                          | Public/projection owner                                                                                | Boundary mapper                                                                          | Consumers                                                |
| ---------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Avatar entity/runtime config | `apps/core/src/domain/avatar/avatar.types.ts`           | `packages/shared/src/entity-types.ts` (`AvatarSummary`, `AvatarComputedTraits`)                        | `application/use-cases/shared/avatar-summary.ts`                                         | Avatar/scenario use cases, API routes, admin, console    |
| Scenario entity              | `apps/core/src/domain/scenario/scenario.types.ts`       | `packages/shared/src/entity-types.ts` (`ScenarioSummary`)                                              | `application/use-cases/shared/scenario-summary.ts`                                       | Scenario use cases, API routes, admin, web, console      |
| Session entity               | `apps/core/src/domain/conversation/session.types.ts`    | `packages/shared/src/entity-types.ts` (`SessionSummary`)                                               | `application/use-cases/shared/entity-summaries.ts`                                       | Session use cases, API routes, admin, web, console       |
| Conversation entity          | `apps/core/src/domain/conversation/session.types.ts`    | `packages/shared/src/entity-types.ts` (`ConversationSummary`)                                          | `application/use-cases/shared/entity-summaries.ts`                                       | Conversation/session use cases, API routes, web, console |
| Message entity               | `apps/core/src/domain/conversation/session.types.ts`    | `packages/shared/src/conversation-contract-types.ts` (`Message`)                                       | `application/use-cases/shared/entity-summaries.ts` and `conversation-message-mappers.ts` | History, message, SSE, web, console                      |
| Lifecycle responses          | Domain entities plus shared lifecycle vocabulary        | `packages/shared/src/lifecycle-types.ts`                                                               | `entity-summaries.ts` for entity projections                                             | End-conversation and transition routes, web, console     |
| Memory layers                | `apps/core/src/domain/memory/memory.types.ts`           | `packages/shared/src/memory-contract-types.ts`, `lifecycle-types.ts`, and `runtime-inspector-types.ts` | Memory use cases and session-context mapper                                              | Avatar/GM context, admin, console                        |
| Knowledge/retrieval          | `apps/core/src/domain/knowledge/knowledge.types.ts`     | `packages/shared/src/knowledge-contract-types.ts`                                                      | Retrieval presenter and trace DTO mapper                                                 | Retrieval, context, admin, console                       |
| GM state/input/output        | `apps/core/src/domain/game-master/game-master.types.ts` | `packages/shared/src/runtime-inspector-types.ts` for safe diagnostics                                  | GM event builders and session-event projection                                           | GM orchestration, runtime inspection, console            |
| Runtime/persisted events     | Core event builders and `IEventLogRepository`           | `packages/shared/src/runtime-types.ts` and `runtime-inspector-types.ts`                                | Event publisher and `ListSessionEventsUseCase`                                           | API, admin, console, web event stream                    |
| Admin/session inspection     | Core inspection use cases                               | `packages/shared/src/runtime-inspector-types.ts`                                                       | Inspection and context mappers                                                           | Admin API, console runtime inspector                     |

### Frozen vocabulary and nullability

- Current static knowledge values are exactly `avatar_knowledge`, `world`, and `media`; `memory` is
  rejected at the API boundary.
- Knowledge visibility is represented by `KnowledgeVisibilityPolicy` (`all`, `avatars`, `none`);
  inferred-policy and sentinel cleanup was completed by Prompt 04.
- `Scenario.language` / `ScenarioSummary.language` is the canonical Scenario language field;
  config/voice fallback removal was completed by Prompt 04.
- Avatar routing uses `availabilityKey`. Prepared identity uses `AvatarComputedTraits`; the
  current nullable public projection remains until the activation/content cleanup in Prompt 04.
- Session memory uses `SessionMemorySummary`, `SessionMemoryLayers`, and the domain memory types.
  The current short-term policy is three complete exchanges.
- `GameMasterOutput` requires `dialogueControl`, `retrievalPlan`, `directorNotes`, and
  `progressionUpdate`; the current parser rejects missing or legacy-shaped output.
- Current event projections use sectioned Avatar/GM context snapshots and shared event payload
  DTOs. Event readers accept only current structured section payloads.

### Prompt 01–04 handoff

Prompt 0 established the contract baseline. Prompt 1 owns the fresh-database bootstrap and removes
runtime schema alignment. The completed clean-slate slices are:

- Prompt 01: complete. Fresh `init.sql` is authoritative, startup alignment is removed, and
  obsolete GM schema columns are absent from the canonical schema.
- Prompt 02: complete. Static knowledge accepts only canonical types, reserved metadata validation
  has a current owner, legacy migration/quarantine tooling is removed, and session working memory
  is read only from layered memory tables without a session mirror.
- Prompt 03: complete. GM state parsing is current-shape-only, event readers accept structured
  sections only, and public/recorded retrieval references use `similarity` as the single ranking
  field.
- Prompt 04: complete. Avatar flat prompt/identity fallbacks, Scenario language fallbacks, `routeKey`,
  visibility inference/sentinel handling, and runtime model-resolution compatibility wiring are removed.
