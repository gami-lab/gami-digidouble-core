# Rename Static Memory And Migrate Knowledge Contracts

## Context

The current static `KnowledgeType = 'memory' | 'world' | 'media'` makes scenario documents look like
runtime user memory. This slice establishes `avatar_knowledge` as an unambiguous static type and
migrates only data that the preceding audit classified safely.

## Scope

Implement now:

- change canonical static knowledge types and typed sections to `avatar_knowledge | world | media`;
- update Domain, Application, shared API DTOs, API schemas/validation, presenters, repositories,
  persistence constraints, admin/console clients, seeds, fixtures, and diagnostics;
- decide and document whether the public API needs a temporary input-only `memory` alias;
- if retained, normalize the alias once at the API boundary to `avatar_knowledge`, never persist or
  emit it, instrument its deprecated use, and define its removal condition;
- execute a safe migration for positively classified legacy rows and quarantine/reject ambiguous rows;
- reject reserved user/session/conversation scope keys in new or updated source/chunk metadata.

Out of scope:

- automatically creating conversational-memory records from legacy documents;
- changing retrieval ranking or introducing user-memory vector search;
- adding new knowledge categories beyond the three requested;
- changing the conversation-memory lifecycle.

## Relevant Docs

- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/DATA_MODEL.md`
- `docs/API_CONTRACT.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/RAG_SYSTEM_IMPLEMENTATION.md`
- `docs/AVATAR_RAG_SETUP_GUIDE.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/PROJECT_STATUS.md`
- `packages/shared/src/knowledge-contract-types.ts`
- `apps/core/src/domain/knowledge/knowledge.types.ts`
- `apps/core/src/api/routes/knowledge.ts`
- `apps/core/src/api/routes/knowledge-upload.request.ts`
- `apps/core/src/application/ports/IKnowledgeSourceRepository.ts`
- `apps/core/src/infrastructure/db/repositories/postgres-knowledge-source.repository.ts`
- `apps/core/src/infrastructure/db/schema-alignment.ts`

## Implementation Guidance

- Prefer `avatar_knowledge` exactly. Rename object keys such as `typedSections.memory`, retrieval
  trace `perType.memory`, and recorded DTO sections rather than retaining ambiguous output mirrors.
- Keep migration compatibility narrow. Canonical `KnowledgeType` must not include `memory` merely to
  simplify parsing. If an input alias is necessary, define a separate deprecated request-input type
  or normalization schema and return only canonical values.
- Validate metadata at every external source-create/update/upload boundary. Reject reserved keys
  `userId`, `sessionId`, and `conversationId` (including the repository's actual supported metadata
  nesting policy) with the standard validation error envelope.
- Update database checks/indexes using the repository's migration/schema-alignment convention.
  Migrate only audit-approved source rows and their derived projections. Leave ambiguous rows
  unavailable for retrieval with a clear report/action, rather than guessing.
- Preserve source ownership by `scenarioId` and Avatar visibility policy. `avatar_knowledge` means
  static source material relevant to an Avatar, not user-private content.
- Update all exhaustive switches, record keys, formatters, event readers, and UI labels. Avoid
  string replacement in true conversational-memory code.
- Add route contract tests for create/upload/list/retrieval validation and output normalization.
  Existing endpoints do not require new stack-e2e files, but their existing stack tests must be updated.

## Constraints

- Respect the four-layer architecture and canonical contract owners from prompt `00`.
- KISS, YAGNI, DRY.
- No compatibility alias outside the external input boundary.
- No silent migration of ambiguous or user-scoped material.
- No `any`, untyped JSON casts, or provider-specific knowledge contracts.

## Deliverables

- canonical `avatar_knowledge | world | media` contracts and projections;
- API validation/normalization and deprecation behavior, if compatibility is justified;
- database constraint/data migration with explicit ambiguous-row handling;
- reserved metadata-key enforcement;
- updated clients, seeds, fixtures, diagnostics, and focused migration/contract tests.

## Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts: `KnowledgeType`, source/chunk DTOs, typed retrieval, traces,
   context DTOs, events, request schemas, persistence rows, and client view models.
2. Search for duplicated unions, inline typed-section records, local response shapes, inconsistent
   optionality/nullability, and string-key assumptions.
3. Confirm canonical internal and shared owners from prompt `00`.
4. Reuse existing shared types and explicit mappers.
5. Create a canonical owner before adding any compatibility input type if one is missing.

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md` — always required;
- `docs/DATA_MODEL.md` with canonical values, constraints, and migration state;
- `docs/API_CONTRACT.md` with accepted input, canonical output, validation, and alias deprecation;
- `docs/RAG_SYSTEM_IMPLEMENTATION.md` and `docs/AVATAR_RAG_SETUP_GUIDE.md` with unambiguous examples;
- `docs/MEMORY_SYSTEM_SPEC.md` to reserve “memory” for conversation lifecycle state;
- `docs/EPICS.md` only when progress is accurate.

If a listed document needs no text change, record that it was reviewed and remains accurate. Code,
tests, and docs move together.

## Acceptance Criteria

- [ ] Canonical static knowledge accepts/emits only `avatar_knowledge`, `world`, and `media`.
- [ ] Any legacy alias is input-only, immediately normalized, observable, and documented for removal.
- [ ] Persistence cannot store `knowledge_type = 'memory'` after migration.
- [ ] New/updated static source metadata cannot carry user/session/conversation scope keys.
- [ ] Safe legacy rows migrate deterministically; ambiguous rows remain blocked and reported.
- [ ] API, Domain, repositories, clients, traces, seeds, and tests use the same canonical terms.
- [ ] Existing knowledge route stack-e2e coverage passes with the new contract.
- [ ] Documentation is updated before the slice is complete.
