# Establish Canonical Vector Retrieval Contracts

## Context

EPIC 5.1d changes ranking and diagnostics across an existing public and internal retrieval model.
Today `RetrievedKnowledgeItem`, `RetrievalQueryVariant`, `TypedRetrievalResult`, shared retrieval
DTOs, recorded runtime references, and local console GM-impact shapes partially repeat the same
fields. Adding vector distance, profile, latency, counts, and failure details directly to each copy
would increase contract drift.

This behavior-neutral slice establishes canonical ownership before vector search work begins. EPIC
5.1c must already provide canonical embedding profile and batch-result contracts; reuse them.

## Scope

Implement now:

- audit retrieval query, result, trace, failure, recorded-event, admin DTO, and console/client shapes;
- choose and document one internal owner for vector candidate and retrieval trace contracts;
- choose shared DTO ownership for fields intentionally exposed by the admin/runtime APIs;
- define one score convention: pgvector cosine distance is the repository truth and normalized
  cosine similarity is `1 - distance` for service/API ranking and display;
- define finite, provider-neutral retrieval outcome/failure codes that distinguish query embedding
  failure, incompatible profile/dimension, and vector-search failure;
- define bounded diagnostic fields needed by later slices, including query source/index, profile,
  timings, candidate/selected/excluded counts, visibility mode, and distance/similarity;
- migrate duplicate types to aliases/imports without changing retrieval behavior.

Out of scope:

- embedding calls, SQL vector search, schema migrations, or ranking changes;
- new endpoints or UI features;
- changing Context Engine selection or prompt rendering.

## Relevant Docs

- `docs/VISION.md`
- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/DATA_MODEL.md`
- `docs/API_CONTRACT.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`
- EPIC 5.1c implementation prompts and implemented contracts

## Implementation Guidance

- Start with `apps/core/src/domain/knowledge/knowledge.types.ts`,
  `packages/shared/src/knowledge-contract-types.ts`,
  `packages/shared/src/runtime-inspector-types.ts`, and
  `apps/console/src/components/gm-impact-trace.ts`.
- Inspect `knowledge-retrieval.presenter.ts`, `runtime-inspector-event-context.ts`, session context
  types, and every inline `trace.perType` fixture before selecting owners.
- Keep raw vectors internal to the embedding/repository call. They must not become fields on public
  DTOs, persisted events, logs, or errors.
- Prefer one canonical `RetrievalQueryVariant`/source union and mapped public DTOs over repeated
  inline unions. Do not make Domain import transport DTOs.
- Keep distance semantics explicit: lower cosine distance is better; higher normalized similarity
  is better. Define clamping/rounding only at the presenter boundary, not in SQL ranking.
- Preserve existing optionality unless the new contract requires a deliberate versioned change.
- Add type/mapper tests that detect drift between internal results, admin responses, and recorded
  runtime references.

## Constraints

- Respect `API -> Application -> Domain -> Infrastructure`.
- KISS, YAGNI, DRY; this is not a generalized search framework.
- Preserve backward compatibility for current response fields where practical.
- No provider-specific types outside Infrastructure.
- No raw embeddings, prompts, secrets, or unbounded chunk content in diagnostics.
- Do not alter production ranking in this slice.

## Deliverables

- Canonical internal query, vector-candidate, retrieval-result, trace, and failure contracts.
- Canonical shared/public diagnostic DTO ownership and explicit internal-to-public mappers.
- Documented cosine distance and normalized similarity semantics.
- Removed retrieval-contract duplication that would block adding EPIC 5.1d fields.
- Focused contract and mapper tests with unchanged lexical behavior.

## Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts: knowledge chunk/source, query variant, retrieved item,
   typed result/trace, embedding profile, admin DTO, runtime event, and context inspection DTO.
2. Search for duplicated type definitions, repeated inline response shapes, local console/client
   copies, inconsistent optionality/nullability, and field-name drift.
3. Identify the canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one before feature work proceeds.

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md` — always required;
- `docs/ARCHITECTURE.md` for contract ownership and layer boundaries;
- `docs/API_CONTRACT.md` if public diagnostic ownership or shape changes;
- `docs/DATA_MODEL.md` if persisted event/profile semantics are clarified;
- `docs/TEST_STRATEGY.md` and `docs/TEST_COVERAGE_PLAN.md` if contract-test ownership changes;
- `docs/EPICS.md` only with truthful progress.

If a document needs no change, explicitly record that it was reviewed and remains accurate. Code,
tests, and docs move together.

## Acceptance Criteria

- [ ] One canonical source union and query variant contract is reused across internal consumers.
- [ ] Vector candidate, result, trace, and controlled failure semantics are explicit.
- [ ] Distance means lower-is-better and similarity means higher-is-better everywhere.
- [ ] Public/recorded DTOs expose only deliberate safe fields and no vectors.
- [ ] Console/client local copies are removed or derived from shared contracts.
- [ ] Existing retrieval behavior and API compatibility remain intact.
- [ ] Contract/mapper tests and documentation checks pass.
