# Code Audit — EPIC 5.1e — Retrieval Quality Hardening

## Scope audited

This audit covers the implementation described by
`docs/implementation-prompts/epic-5-1e-retrieval-quality-hardening/README.md` and slices `00`–`07`.
It reviewed the retrieval-quality harness, chunking and overlap, embedding profile/schema changes,
Avatar selection ownership, retrieval diagnostics, lexical fusion, incremental reindexing, tests,
operational paths, and the synchronized project documentation.

The audit was aligned with `docs/README.md`, `VISION.md`, `PRINCIPLES.md`, `ARCHITECTURE.md`,
`TECH_STACK.md`, `DATA_MODEL.md`, `API_CONTRACT.md`, `TEST_STRATEGY.md`, `TEST_COVERAGE_PLAN.md`,
`EPICS.md`, `PROJECT_STATUS.md`, `EMBEDDING_OPERATIONS.md`, `RAG_SYSTEM_IMPLEMENTATION.md`, and
`RAG_SYSTEM_AUDIT.md`.

## Executive Summary

Most of the EPIC is implemented cleanly. The repository has a coherent provider-neutral retrieval
boundary, deterministic chunking, native 1536-dimensional profile wiring, SQL-pushed visibility,
single final Avatar selection ownership, bounded lexical fusion, and strong deterministic unit
coverage. The mandatory lint, typecheck, unit-test, and coverage gates pass.

The EPIC is not fully closed safely because the same-profile incremental reindex optimization is not
reachable through the operator-facing reindex start route: `KnowledgeReindexService.start()` returns
`already_active` whenever the configured profile already matches the active profile. The optimization
is therefore proven only by manually creating an internal operation in a unit test. In addition,
the quality harness and most retrieval/reindex behavior tests use in-memory adapters/repositories;
the real PostgreSQL staged-reindex and fused lexical production path was not completed in the
available supplemental integration run.

## Final Grade

**C — acceptable but with meaningful functional and evidence debt.**

The architecture is a solid foundation and the implementation is broadly maintainable, but the EPIC
claims a production-operable same-profile incremental reindex feature that the public operator flow
cannot currently start. The migration and SQL-backed hybrid retrieval paths also lack a completed
end-to-end evidence trail in this audit environment.

## Build Health

- lint: **PASS** — `pnpm lint`
- typecheck: **PASS** — `pnpm typecheck`
- tests: **PASS** — `pnpm test`; 166 core test files and 1,144 core tests passed, with all workspace packages green
- coverage: **PASS** — `pnpm test:coverage`; 86.67% statements, 83.66% branches, 96.69% functions, 86.67% lines

Supplemental verification: Docker Postgres/Redis/app containers were healthy. `pnpm test:integration-e2e`
did not complete after 2m11s and was interrupted; the host-side integration runner did not finish
against the Docker-only database endpoint. This is recorded as an evidence limitation, not as a
failure of the mandatory build gate.

## Feature Confidence Matrix

| Feature                              | Expected Behavior                                                                                                        | Evidence                                                                                                                 | Confidence (High/Medium/Low) | Notes                                                                                                                                                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Versioned retrieval-quality harness  | Same labelled fixtures produce recall@k/MRR before and after the EPIC                                                    | `apps/core/src/tools/retrieval-quality/`, committed before/after reports, scorer tests                                   | Medium                       | Six fixtures; recall is saturated at 1.0 for all reported cutoffs, and the CLI uses in-memory retrieval rather than PostgreSQL. MRR improves from 0.722222 to 0.916667, with mixed per-fixture rank movement. |
| Hard chunk cap and overlap           | Oversized and blank-line-free sources ingest successfully, remain bounded, preserve indexes, and overlap adjacent chunks | `knowledge-ingestion.service.test.ts`, `knowledge-reindex.service.test.ts`, shared constants and implementation          | High                         | Normal text, oversized paragraphs, hard-cap inputs, and code fences are covered. The code-fence policy is deterministic splitting rather than preserving a valid fence across chunks.                         |
| 1536-dimensional embedding migration | Schema, adapter, profile identity, and staged corpus flow use one compatible vector space                                | `config.ts`, `init.sql`, adapter/repository tests, reindex unit tests, docs                                              | Medium                       | Code and unit contracts align. A completed real Postgres `KnowledgeReindexService` run was not independently verified here.                                                                                   |
| Authoritative Avatar selection       | Context Engine performs final cross-type selection; prompt assembly only formats approved items                          | `context-engine.service.ts`, `persona-prompt.service.ts`, prompt/context tests, static call-site search                  | High                         | Final selection ownership is clear. The consumer test coverage does not fully exercise divergent option values through the complete send-message path.                                                        |
| Retrieval diagnostics cleanup        | No hardcoded visibility-exclusion count is emitted; legacy traces remain parseable; direct chunk write is documented     | `rg` call-site audit, DTO/parser tests, console/API changes, repository comment                                          | High                         | `excludedChunkCount` is no longer emitted. `PostgresKnowledgeChunkRepository.create()` remains on the broad shared interface but is explicitly documented as non-production.                                  |
| Lexical/full-text fusion             | Exact-entity queries can recover lexical-only chunks under the same eligibility rules and expose bounded match type      | Typed retrieval tests, in-memory repository tests, PostgreSQL repository integration tests, GIN schema index             | Medium                       | Fusion behavior is proven deterministically, but the full fused path against PostgreSQL was not completed in the supplemental run.                                                                            |
| Same-profile incremental reindex     | Unchanged chunks reuse active vectors while changed chunks are embedded and the new generation validates                 | Reindex service unit test manually creates a same-profile operation; profile-change test verifies no cross-profile reuse | Low                          | The public `POST /v1/admin/knowledge/reindex` path refuses to create this operation when the active profile already matches.                                                                                  |
| Documentation synchronization        | Source-of-truth docs describe the shipped retrieval behavior accurately                                                  | Reviewed all required docs plus RAG/embedding docs                                                                       | Medium                       | Retrieval behavior is described well, but the same-profile incremental reindex instructions overstate what the operator route can initiate.                                                                   |

## Strengths

- Layering is respected: API routes validate/authenticate and dispatch; application services own
  orchestration; domain owns deterministic selection and prompt contracts; infrastructure owns SQL,
  pgvector, full-text search, and provider details.
- Embedding profile and corpus-generation identity are explicit and validated at both ingestion and
  query boundaries. The schema prevents mixed profile/generation vectors.
- Staged corpus replacement and atomic promotion preserve the active corpus until validation passes.
- Chunking is deterministic, shared by ingestion and reindexing, and tested for oversized input,
  overlap, metadata, header propagation, and contiguous indexes.
- Lexical fusion is centralized in `TypedRetrievalService`; routes, presenters, and UI do not rank.
- Diagnostics are bounded and avoid raw vectors, provider payloads, credentials, and unbounded text.
- Tests assert observable content, ordering, visibility, profile failures, validation outcomes, and
  reindex vector reuse—not only mock interactions.
- The before/after report honestly records saturated recall and mixed rank movement rather than
  claiming universal improvement.

## Findings

### Same-profile incremental reindex is unreachable through the operator workflow

- Severity: High
- Category: Functional completeness / Operations
- Problem: `KnowledgeReindexService.start()` returns `already_active` whenever the configured
  provider/model/dimension profile matches the active corpus. The admin route exposes only this
  `start()` operation; there is no force/rebuild/same-profile option. Consequently, the optimization
  added in `processSource()` cannot be initiated by the documented operator workflow.
- Why it matters: The EPIC specifically promises same-profile reindex reuse for re-running a corpus
  build and for picking up chunking changes. In production, those runs still require an internal
  operation or database intervention, so the cost-saving behavior is not an operable feature.
- Evidence: `knowledge-reindex.service.ts:41-45` short-circuits same-profile starts;
  `admin-knowledge-reindex.ts:74-80` calls that path; the test at
  `knowledge-reindex.service.test.ts:192-230` manually calls `createReindexOperation()` instead of
  exercising the public start path.
- Recommendation: Add an explicit operator-safe same-profile rebuild intent or a separate rebuild
  operation, retain existing duplicate-operation/idempotency guards, and add an API/application
  behavior test that starts it through the documented route and verifies unchanged/changed embed
  counts plus atomic promotion.

### The critical staged-reindex behavior is not proven at the real persistence boundary

- Severity: High
- Category: Test quality / Migration safety
- Problem: The service-level reindex tests use `InMemoryKnowledgeCorpusRepository` and a counting fake
  adapter. PostgreSQL tests cover repository primitives, but there is no completed test that runs the
  `KnowledgeReindexService` against the real corpus repository and asserts old-generation readability
  during staging, profile-change full re-embedding, validation, and promotion together.
- Why it matters: The highest-risk EPIC change is the 16-to-1536 schema/profile transition and staged
  corpus cutover. In-memory behavior cannot prove SQL constraints, generation joins, vector widths,
  transaction boundaries, or rollback safety.
- Evidence: `knowledge-reindex.service.test.ts` constructs the in-memory corpus at its test setup;
  the Postgres repository tests are separate integration tests. The attempted
  `pnpm test:integration-e2e` did not complete in this environment.
- Recommendation: Add a focused Postgres integration test around `KnowledgeReindexService` using a
  small real corpus. Assert active reads remain on the old generation before promotion, failed/stale
  runs preserve it, copied vectors satisfy validation, and a profile change embeds every chunk.

### The quality report does not measure the production PostgreSQL retrieval path

- Severity: Medium
- Category: Measurement / Test quality
- Problem: The live quality CLI uses `InMemoryKnowledgeChunkRepository` and
  `InMemoryKnowledgeCorpusRepository` (`cli.ts:8-10,131-154`) with OpenAI embeddings. It exercises
  `TypedRetrievalService`, but not PostgreSQL full-text tokenization, GIN query behavior, SQL
  visibility/readiness filters, or pgvector ordering.
- Why it matters: The report is evidence for retrieval quality, while the EPIC also changes the
  infrastructure retrieval path. A passing in-memory report can miss SQL-specific ranking, query
  parsing, index, or filter regressions. The six-fixture sample also has recall@3/7/9 = 1.0 before
  and after, so its strongest measured signal is a small-sample MRR movement.
- Evidence: `cli.ts:131-154`; `baseline-comparison.md` records six fixtures, saturated recall, and
  mixed rank movement. The deterministic scorer test proves the scorer invokes the typed service,
  not that the live report uses the Postgres adapter.
- Recommendation: Keep the fast in-memory harness, and add a small opt-in repository-backed run or
  integration fixture that uses the real Postgres repository for exact-entity, visibility, and
  vector/lexical fusion cases. Expand the labelled set before using the result as a release-quality
  claim.

### Incremental reindex savings are not observable to operators

- Severity: Medium
- Category: Observability / Supportability
- Problem: `processSource()` knows which seeds are embedded and which reuse active vectors, but the
  completion event reports only `vectorCount: chunks.length` (`knowledge-reindex.service.ts:237-245`).
  Operators cannot distinguish a full re-embed from a mostly copied-forward run or verify the cost
  optimization without provider-side logs.
- Why it matters: This EPIC introduces behavior whose main operational value is reduced embedding
  calls. Without bounded counts, support and cost investigations cannot confirm whether the feature
  is working or why a reindex was expensive.
- Evidence: `knowledge-reindex.service.ts:188-203` computes `seedsToEmbed`; the emitted source
  completion payload contains total vectors only at lines 237-245. No `embeddedChunkCount` or
  `reusedChunkCount` appears in the event/operation DTOs.
- Recommendation: Emit bounded per-source and aggregate counts such as `embeddedChunkCount` and
  `reusedChunkCount`, plus profile-change/full-rebuild reason where applicable. Keep content, vectors,
  and provider payloads out of the diagnostics.

### Selection ownership is structurally fixed but option behavior is under-tested

- Severity: Medium
- Category: Test quality / Maintainability
- Problem: The redundant prompt-layer selector was removed, and a prompt test proves that more than
  the default number of preselected items are formatted. However, there is no behavior-level test
  through the context/send-message path that combines avatar knowledge and world items with a
  non-default `maxChunks` and `minimumChunksBySource`, then asserts the exact final prompt set.
- Why it matters: The primary regression risk in this slice is option drift between retrieval,
  Context Engine selection, and prompt formatting. A formatting-only test can pass while the caller
  supplies the wrong options or the final selection changes at the application boundary.
- Evidence: `context-engine.service.ts:358-362` is the intended final selector;
  `persona-prompt.service.ts:224-235` formats directly. The prompt test covers preselected count,
  but the selection-option divergence scenario requested by slice `03` is not directly exercised
  end-to-end.
- Recommendation: Add a consumer-facing context assembly test with deliberately divergent limits and
  source minimums. Assert the selected chunk IDs and rendered prompt content, not selector call
  counts or private helpers.

### The chunk write port still carries a production-looking write method

- Severity: Low
- Category: Structural maintainability
- Problem: `IKnowledgeChunkRepository` still requires `create()` even though production writes are
  generation-aware corpus replacements. The Postgres implementation retains a full direct INSERT
  method and relies on a comment to explain that it is fixture-only.
- Why it matters: A future application service can accidentally depend on a write path that bypasses
  corpus-generation orchestration and atomic promotion. The interface therefore continues to encode
  a misleading capability and increases coupling between retrieval fixtures and production adapters.
- Evidence: `IKnowledgeChunkRepository.ts` includes `create()`; the Postgres implementation documents
  the exception at `postgres-knowledge-chunk.repository.ts:103-107`; production replacement writes
  live in `PostgresKnowledgeCorpusRepository`.
- Recommendation: Split read/search/delete from corpus-owned write ports when the next retrieval or
  ingestion change touches these interfaces. Until then, keep the comment and add a compile-time or
  architectural test preventing application production composition from using `create()`.

## Architecture Review

The implementation follows the intended modular monolith boundaries. Provider SDK access remains in
the OpenAI adapter. PostgreSQL vector/full-text SQL remains in the repository. Query embedding,
candidate fusion, and per-type selection remain in application services; final Avatar cross-type
selection remains in the Context Engine; prompt assembly only formats approved context. No controller
or console component owns ranking or orchestration.

The main architectural debt is capability shape rather than layer violation: the shared chunk port
still exposes a direct write method that production does not use, and the same-profile rebuild intent
is absent from the application/API contract. Neither is a vendor leak or a monolith boundary break,
but both weaken explicit ownership under future change.

## Test Review

Strong tests:

- Ingestion proves successful hard-cap handling, oversized paragraph splitting, overlap, header
  preservation, code-fence handling, contiguous indexes, and failure/rollback behavior.
- Typed retrieval proves semantic retrieval, visibility asymmetry, lexical-only exact-entity recovery,
  deduplication, stable ordering, bounded candidate requests, and failure outcomes.
- Reindex unit tests prove changed-only embedding in an internally-created same-profile operation,
  complete copied-forward generations, profile-change full embedding, retries, and old-corpus
  preservation on failure.
- DTO/parser tests prove bounded projections and tolerance of legacy `excludedChunkCount` data.
- Prompt tests prove preselected context is not silently truncated by a second default selection pass.

Weak or implementation-coupled tests:

- `typed-retrieval.service.test.ts` asserts exact `searchByVector`/`searchByText` call counts and
  candidate-limit arguments. These are useful guardrails but mirror implementation details and do not
  prove the client-visible retrieval result by themselves.
- Most EPIC tests use in-memory repositories, so they cannot prove SQL filter parity, vector column
  constraints, GIN behavior, or transaction semantics.
- Coverage is healthy and all thresholds pass, but coverage does not prove the missing public
  same-profile reindex behavior.

Missing tests:

- Public/admin same-profile reindex initiation and its observable embed-call savings.
- Real Postgres `KnowledgeReindexService` end-to-end promotion/rollback and old-generation read
  safety.
- Full fused vector-plus-lexical retrieval through the Postgres repository and API projection.
- Operator-visible reused-versus-embedded counts.
- Context Engine selection options flowing through the complete Avatar turn/prompt boundary.

## Documentation Gaps

The required documents were reviewed and are broadly synchronized: the embedding profile is 1536,
chunking documents the 8,000-character cap and overlap, the hybrid path and match types are described,
and the legacy diagnostics cleanup is reflected.

The remaining gap is operational accuracy. `docs/EMBEDDING_OPERATIONS.md`, `PROJECT_STATUS.md`,
`EPICS.md`, and `RAG_SYSTEM_AUDIT.md` describe same-profile incremental reindex as an available
operator behavior, but the documented admin start route returns `already_active` for that case. Those
documents should be corrected after the route is made explicit, or the feature should be described as
an internal-only capability until then. `TEST_STRATEGY.md` and `TEST_COVERAGE_PLAN.md` should also
identify the missing real-Postgres service-level evidence if the project keeps the current test shape.

## Path to A

1. Expose an explicit, authenticated same-profile rebuild intent and test it through the admin/API,
   including unchanged/changed embedding counts and atomic promotion.
2. Add a focused real-Postgres integration test for staged reindex, profile migration, lexical
   filtering/fusion, rollback safety, and old-generation readability during staging.
3. Make the quality harness optionally run against the Postgres repository, and add labelled fixtures
   that include misses, visibility exclusions, exact-entity recovery, and meaningful recall deltas.
4. Add bounded reindex observability for reused and freshly embedded chunks.
5. Add the context-engine option-divergence behavior test and synchronize the affected docs.

## Final Recommendation

**Rework before close.** The EPIC has a strong implementation base and should not be redesigned, but
the operator-reachable same-profile reindex gap and missing production persistence evidence should be
resolved before treating the EPIC as fully complete.
