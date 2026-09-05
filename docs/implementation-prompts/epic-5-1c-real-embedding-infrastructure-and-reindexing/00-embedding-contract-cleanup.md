# Establish Canonical Embedding And Knowledge-Vector Contracts

## Context

The current embedding port returns only `number[][]`, `KnowledgeChunk` carries an optional bare
vector, the hash adapter owns an implicit dimension, and PostgreSQL independently assumes
`VECTOR(16)`. EPIC 5.1c must add profile identity across configuration, ingestion, query
vectorization, reindexing, and persistence without creating copies that drift.

This behavior-neutral foundation establishes canonical owners and removes blocking duplication
before introducing a real provider or changing stored data.

## Scope

Implement now:

- audit all embedding, `KnowledgeSource`, `KnowledgeChunk`, ingestion-job, configuration, and admin
  DTO shapes across Core, shared packages, tests, console, and web;
- define one internal `EmbeddingProfile` contract with `provider`, `model`, and `dimensions`;
- define canonical provider-neutral batch request/result metadata and a finite typed failure model;
- decide and document ownership of persisted vector-profile identity and reindex-operation types;
- update existing embedding fakes and consumers to the canonical contracts without changing the
  production adapter or database schema yet;
- identify the one application boundary that query retrieval will use to embed text in EPIC 5.1d.

Out of scope:

- OpenAI API calls;
- database migrations or active-profile promotion;
- reindex orchestration or new HTTP endpoints;
- nearest-neighbor retrieval.

## Relevant Docs

- `docs/VISION.md`
- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/DATA_MODEL.md`
- `docs/API_CONTRACT.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`

## Implementation Guidance

- Begin at `apps/core/src/application/ports/IEmbeddingAdapter.ts`,
  `apps/core/src/domain/knowledge/knowledge.types.ts`,
  `apps/core/src/application/ports/IKnowledgeChunkRepository.ts`, and shared knowledge contracts.
- Search for bare `number[][]`, `embedding?: number[]`, `HashEmbeddingAdapter`, `VECTOR(16)`, and
  repeated source/job response shapes before changing types.
- Keep `EmbeddingProfile` and embedding result/error types internal unless an operator API actually
  exposes them later. Public wire DTOs belong in `@gami/shared`; application port types belong in
  `apps/core/src/application`; provider response types stay in Infrastructure.
- Prefer a batch result whose vectors are explicitly ordered to match the input array and whose
  metadata describes the effective provider/model/dimension and available usage. Do not expose an
  OpenAI response object or token-field naming as the application contract.
- Model invalid/empty input, provider rejection, rate limiting, malformed response/count mismatch,
  and vector-dimension mismatch distinctly enough for retry policy and diagnostics. Avoid a broad
  error hierarchy if a small discriminated error/code contract is sufficient.
- Retain `HashEmbeddingAdapter` only as an explicitly injected deterministic fake. Rename or move it
  under test support if that is the smallest way to prevent production use.
- Add focused contract tests proving stable ordering, immutable/copy-safe vectors where relevant,
  and deterministic fake metadata.

## Constraints

- Respect `API -> Application -> Domain -> Infrastructure`.
- KISS, YAGNI, DRY; do not design a generic AI-capabilities framework.
- Keep embeddings separate from `ILlmAdapter` and chat model configuration.
- No provider-specific imports or types in Domain or Application code.
- Preserve existing public API shapes in this slice.
- Do not refactor unrelated knowledge or retrieval behavior.

## Deliverables

- Canonical `EmbeddingProfile`, batch result/metadata, and failure contracts.
- Updated provider-neutral embedding port and deterministic test fake.
- Documented canonical ownership for vector profile metadata and reindex state.
- Unit tests for the revised port contract and fake.
- A concise list in code/docs of later call sites that must migrate to profile-aware behavior.

## Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts: `KnowledgeSource`, `KnowledgeChunk`, ingestion jobs,
   embedding configuration, embedding batches, query vectors, and future reindex operations.
2. Search for duplicated type definitions, repeated inline response shapes, local console/client
   copies, inconsistent optionality/nullability, and field-name drift.
3. Identify the canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one before feature work proceeds.

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md` — always required;
- `docs/ARCHITECTURE.md` for the embedding port boundary;
- `docs/DATA_MODEL.md` if internal profile metadata ownership is documented there;
- `docs/API_CONTRACT.md` if any public contract is affected;
- `docs/TEST_STRATEGY.md` and `docs/TEST_COVERAGE_PLAN.md` if test ownership changes;
- `docs/EPICS.md` only to record accurate in-progress/completed scope.

If no additional documentation changes are needed, explicitly verify that each impacted document
is still accurate. Code, tests, and docs move together.

## Acceptance Criteria

- [ ] One canonical profile contract contains provider, model, and dimensions.
- [ ] Batch output ordering and effective metadata are explicit in the port contract.
- [ ] Failure categories are provider-neutral and testable.
- [ ] No OpenAI type leaks outside Infrastructure.
- [ ] Embeddings remain separate from `ILlmAdapter` and chat-role selection.
- [ ] Hash embedding is clearly test-only and requires explicit injection.
- [ ] No new knowledge/profile contract duplication is introduced.
- [ ] Relevant unit tests and documentation checks pass.
