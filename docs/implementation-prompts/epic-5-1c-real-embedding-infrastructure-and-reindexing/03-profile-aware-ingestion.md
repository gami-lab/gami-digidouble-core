# Make Knowledge Ingestion Profile-Aware And Transactional

## Context

`KnowledgeIngestionService` currently embeds chunks through an unversioned adapter, deletes old
chunks, inserts replacements one by one, and attempts application-level restoration on failure.
That flow can diverge from the database dimension and cannot detect a profile change during work.

This slice makes normal ingestion bind to one active profile snapshot and publish a source only
when all of its chunks are complete and compatible.

## Scope

Implement now:

- load one active embedding profile snapshot before content chunking/vectorization;
- use the provider-neutral embedding result and verify its effective profile matches that snapshot;
- persist profile and active corpus-generation metadata with all generated chunks;
- replace a source's chunks in one PostgreSQL transaction instead of delete/restore loops;
- detect a profile/generation change before commit and reject or retry stale work explicitly;
- mark a source retrievable/ready only after all expected vectors validate and commit;
- ensure failed, missing, null, stale, or mismatched vectors leave the source unavailable in the
  active retrieval corpus without damaging its previous valid generation where one exists;
- add a reusable application service for embedding query text against the same active profile,
  returning a profile-tagged vector for EPIC 5.1d without performing retrieval.

Out of scope:

- nearest-neighbor search or relevance scoring;
- all-source reindex orchestration;
- new provider adapters;
- memory, episodic-memory, or user-fact vectorization.

## Relevant Docs

- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
- `docs/API_CONTRACT.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`

## Implementation Guidance

- Refactor only the replacement boundary in
  `apps/core/src/application/services/knowledge/knowledge-ingestion.service.ts`; preserve current
  chunking behavior, content loaders, retry use case, job lifecycle, visibility metadata, and
  event semantics unless profile correctness requires an additive field.
- Capture `{ profile, activeGeneration }` once. Pass that identity through embedding and persistence;
  do not repeatedly read mutable global configuration and assume it stayed unchanged.
- Require exactly one finite vector of the configured dimension per non-empty chunk. Treat missing
  or extra vectors as a failed ingestion, not as optional embeddings.
- Replace the current `deleteBySourceId` plus manual restore sequence with a repository operation
  that deletes/inserts/validates/updates source readiness in one transaction for the target active
  generation. Keep in-memory behavior equivalent for unit tests.
- Use compare-and-set/transactional validation at publication time so an operation started under a
  stale profile cannot become active after promotion. Classify this as retryable where appropriate.
- Preserve the prior source chunks in the previous active generation during a failed new ingestion.
  If the source has no valid active vectors, active retrieval must exclude it.
- Keep query embedding as a small application boundary over the same active-profile resolver and
  adapter. It must validate profile/dimension and return identity with the vector so future retrieval
  can prove compatibility.
- Extend safe ingestion diagnostics with profile ID/provider/model/dimensions, generation,
  vector count, and stale-profile outcome. Never log content or vectors.
- Add deterministic service tests for empty content behavior, exact vector counts, dimension
  mismatch, provider/rate-limit failure, stale profile before commit, transaction rollback, retry,
  and successful readiness.

## Constraints

- Respect `API -> Application -> Domain -> Infrastructure`.
- KISS, YAGNI, DRY; do not rewrite the chunker.
- No direct provider calls from ingestion or query services.
- Do not make embeddings optional for a source declared ready in the active vector corpus.
- Chat model config must not influence ingestion or query embeddings.
- Preserve existing source/job API compatibility unless an additive observable field is required.

## Deliverables

- Profile-snapshot ingestion flow.
- Transactional source chunk replacement and readiness publication.
- Explicit stale-profile and dimension/count failure behavior.
- Profile metadata in safe ingestion events/diagnostics.
- Profile-aware query-vector application service for later retrieval use.
- Unit and repository integration tests for success, rollback, stale configuration, and retries.

## Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts: `KnowledgeSource`, `KnowledgeChunk`, ingestion jobs,
   embedding profile/results/errors, corpus generation, events, and query-vector output.
2. Search for duplicated type definitions, repeated inline response shapes, local console/client
   copies, inconsistent optionality/nullability, and field-name drift.
3. Identify the canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one before feature work proceeds.

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md` — always required;
- `docs/ARCHITECTURE.md` for profile snapshot and transactional publication flow;
- `docs/DATA_MODEL.md` for source readiness and vector/profile invariants;
- `docs/API_CONTRACT.md` if ingestion job/source output gains fields;
- `docs/TEST_STRATEGY.md` and `docs/TEST_COVERAGE_PLAN.md` for transaction/profile tests;
- `docs/EPICS.md` only when progress/status is accurate.

If no additional documentation changes are needed, explicitly verify that every impacted document
is still accurate. Code, tests, and docs move together.

## Acceptance Criteria

- [ ] Ingestion and query embedding resolve the same active profile boundary.
- [ ] One ingestion run uses one immutable profile/generation snapshot.
- [ ] Every ready active chunk has a vector with matching profile and dimension.
- [ ] Stale work cannot publish after the active profile/generation changes.
- [ ] PostgreSQL source replacement is atomic; application-level delete/restore is removed.
- [ ] Failed ingestion preserves the previous valid corpus where possible.
- [ ] Sources without current valid vectors are excluded from vector retrieval eligibility.
- [ ] Tests cover vector failures, transaction rollback, stale profiles, retries, and query embedding.
