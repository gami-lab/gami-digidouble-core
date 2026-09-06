# Enforce Shared RAG Scope And Independent Lifecycles

## Context

Static retrieval currently accepts `userId`, `sessionId`, and `conversationId`, applies special
scope filtering and scoring to static `memory` chunks, and therefore can produce different scenario
knowledge for different users. After the terminology migration, retrieval must be shared by scenario
while conversational memory continues through its existing repositories and async lifecycle.

## Scope

Implement now:

- remove user, session, and conversation fields from static retrieval inputs, public request DTOs,
  query plumbing, metadata matching, score boosts, traces, and diagnostics;
- constrain static candidates to scenario, canonical knowledge type, ready/current ingestion corpus,
  Avatar visibility, and explicit GM visibility bypass;
- preserve existing working-memory refresh, conversation closure/episodic creation, new-conversation
  hydration, long-term fact extraction, bounded selection, and async scheduling;
- harden reset/deletion/reindex/maintenance boundaries so each subsystem mutates only its owner;
- add focused repository/application tests for lifecycle separation and failure paths.

Out of scope:

- replacing lexical/vector ranking work owned by other EPICs;
- querying, embedding, or indexing user memories/transcripts;
- changing memory compaction prompts or cadence;
- changing the Avatar-first, asynchronous GM/memory execution model.

## Relevant Docs

- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
- `docs/API_CONTRACT.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/RAG_SYSTEM_IMPLEMENTATION.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/PROJECT_STATUS.md`
- `apps/core/src/application/services/knowledge/typed-retrieval.service.ts`
- `apps/core/src/application/services/knowledge/typed-retrieval-query-builder.ts`
- `apps/core/src/application/ports/IKnowledgeSourceRepository.ts`
- `apps/core/src/application/ports/IKnowledgeChunkRepository.ts`
- `apps/core/src/application/services/memory-maintenance.service.ts`
- `apps/core/src/application/services/memory-selection.service.ts`
- `apps/core/src/application/use-cases/shared/hydrate-conversation-memory.ts`
- session reset, conversation close, user delete, scenario delete, ingestion, and reindex use cases

## Implementation Guidance

- Delete `sessionId`, `userId`, and `conversationId` from `TypedRetrievalInput` and
  `QueryKnowledgeRetrievalRequest`; update all callers rather than accepting ignored parameters.
- Remove special `isInMemoryScope`, reserved-key metadata matching, and scope-based score boosts.
  Retrieval relevance may still use conversational text as a query, but that does not make stored
  candidates user-owned.
- Keep `activeAvatarId` solely for source/chunk visibility and `bypassVisibilityFilter` solely for
  the explicit GM policy. Ensure bypass does not bypass scenario, type, readiness/current-generation,
  or corpus validity filters.
- Verify ingestion copies only allowed static source metadata/visibility into chunks. It must never
  read from or write to memory repositories.
- Verify memory maintenance reads messages and memory repositories only. Retrieved items may inform
  a response, but prompt injection alone must not make them candidate facts. Keep fact extraction
  sourced from compacted conversational memory outputs.
- Add deletion/reset contract tests:
  - clear/reset removes the documented conversation/session memory and messages but not knowledge;
  - user deletion cannot cascade into scenario knowledge;
  - scenario deletion removes its sources/chunks according to the existing ownership transaction;
  - closing a conversation creates one episodic memory and zero knowledge sources/chunks;
  - static reindex does not alter any memory row;
  - memory maintenance does not alter chunks, embeddings, source status, or corpus generation.
- Preserve non-blocking scheduling and observable errors for GM and memory maintenance.

## Constraints

- Respect API -> Application -> Domain -> Infrastructure.
- KISS, YAGNI, DRY.
- No RAG dependency in conversational-memory policies/services.
- No transcript or user-fact vectorization.
- No weakening scenario foreign-key/cascade ownership to make tests pass.

## Deliverables

- static retrieval contracts without user/session/conversation scope;
- removal of scope filtering/boost behavior and obsolete trace fields;
- hardened independent mutation/deletion boundaries;
- tests for shared candidate consistency, GM bypass limits, and lifecycle non-interference;
- unchanged, verified async conversational-memory behavior.

## Mandatory Pre-Implementation Check

Before coding:

1. Identify touched contracts: retrieval input/request, query variants, traces, repositories,
   session/user/scenario deletion, memory maintenance, ingestion, and reindex operations.
2. Search for duplicate retrieval request shapes and hidden metadata-scope logic in tests, clients,
   presenters, and event payload readers.
3. Confirm canonical owner of each retrieval and lifecycle contract.
4. Reuse existing shared contracts and repository ports.
5. If a lifecycle operation lacks a canonical application owner, establish one before wiring deletes.

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md` — always required;
- `docs/ARCHITECTURE.md` with distinct RAG and conversational-memory flows;
- `docs/DATA_MODEL.md` with ownership/cascade invariants;
- `docs/API_CONTRACT.md` with the reduced retrieval request;
- `docs/MEMORY_SYSTEM_SPEC.md` and `docs/RAG_SYSTEM_IMPLEMENTATION.md` with non-interference rules;
- `docs/TEST_STRATEGY.md` and `docs/TEST_COVERAGE_PLAN.md` with lifecycle boundary coverage.

If no additional documentation changes are needed, explicitly verify accuracy. Code, tests, and docs
move together.

## Acceptance Criteria

- [ ] Static retrieval has no user/session/conversation scope input or scoring behavior.
- [ ] Two users in the same scenario and Avatar visibility context receive the same static candidates.
- [ ] GM bypass affects Avatar visibility only and keeps all other static corpus filters.
- [ ] Conversational-memory maintenance has no knowledge repository or embedding dependency.
- [ ] Conversation close creates episodic memory and no RAG data.
- [ ] Clear/reset, user deletion, scenario deletion, reindex, and maintenance obey documented ownership.
- [ ] Avatar-first response and async GM/memory behavior remain unchanged.
- [ ] Documentation is updated before the slice is complete.
