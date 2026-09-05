# Add Embedding Profile And Versioned Corpus Persistence

## Context

The current database stores optional `VECTOR(16)` values with no provider/model identity. A safe
profile change cannot update that column in place while retrieval is active because partial work
would mix vector spaces or temporarily remove the valid corpus.

This slice introduces the smallest PostgreSQL model that can stage a complete replacement corpus,
validate it, and atomically promote it while readers continue using the previous active corpus.

## Scope

Implement now:

- persist embedding profiles and identify exactly one active profile/corpus generation;
- persist provider, model, dimensions, and generation/profile identity with every vectorized chunk;
- add reindex-operation persistence sufficient for pending/running/completed/failed status,
  attempts, timestamps, source progress, and bounded failure details;
- migrate the embedding column from `VECTOR(16)` to the selected supported production dimension;
- explicitly invalidate legacy hash vectors rather than pretending they match the new profile;
- recreate the pgvector cosine index with the correct fixed-dimension type/operator class;
- add repository transaction primitives for staging source chunks, validating a generation, and
  atomically promoting one complete generation/profile;
- ensure active-corpus reads filter by the atomically selected generation/profile.

Out of scope:

- calling OpenAI or orchestrating all-source reindexing;
- implementing nearest-neighbor retrieval;
- vectorizing memory or user facts;
- retaining active vectors from multiple incompatible profiles.

## Relevant Docs

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

- Inspect `infra/postgres/init.sql`, all PostgreSQL knowledge repositories, in-memory repositories,
  and repository integration tests before choosing table changes.
- Use a database-owned active pointer or equivalent single-row state so profile activation and
  corpus visibility change in one transaction. Do not mark a profile active before all expected
  sources/chunks for its generation validate.
- Prefer immutable generation/profile identity on chunks. Enforce provider/model/dimension
  consistency with foreign keys/checks and application validation rather than hiding identity only
  inside untyped JSON metadata.
- Because PostgreSQL `vector(n)` dimensions are schema-fixed, reject configured dimensions that do
  not match the deployed schema. Document that a dimension change requires the corresponding
  migration plus a full staged reindex; configuration alone must not start a mixed deployment.
- Define migration behavior for existing installations and fresh bootstrap. Legacy 16-dimensional
  vectors must become inactive/null or be removed in a controlled migration; source records should
  remain available for reingestion.
- Keep the old active generation queryable throughout a replacement build. Staged chunks must not
  appear in normal retrieval/repository listing paths unless a reindex-specific method requests them.
- Make repeated writes for the same operation/source/generation idempotent with clear unique keys.
  Transactionally replace that source's staged chunks to recover from partial attempts.
- Validate expected source count, per-source completion, non-null vector count, profile identity,
  and vector dimensions immediately before promotion.
- Add PostgreSQL integration tests for constraints, legacy invalidation/migration assumptions,
  staging isolation, transactional replacement, failed promotion, and atomic active-pointer switch.

## Constraints

- Respect repository/application transaction boundaries; no SQL in Domain or API handlers.
- KISS, YAGNI, DRY.
- Use PostgreSQL + pgvector only; do not introduce another vector database.
- Never expose two incompatible profiles through the active retrieval corpus.
- Preserve source content/metadata needed to regenerate vectors.
- Avoid destructive in-place replacement of the previous valid corpus before promotion succeeds.

## Deliverables

- Persisted embedding profile and reindex-operation schema.
- Fixed production-dimension vector column and rebuilt cosine index.
- Explicit legacy hash-vector invalidation behavior.
- Profile/generation metadata on each vectorized chunk.
- Repository ports/adapters for isolated staging, validation, transactional source replacement, and atomic promotion.
- In-memory parity needed for deterministic application tests.
- PostgreSQL migration/integration coverage.

## Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts: `KnowledgeSource`, `KnowledgeChunk`, profile, corpus
   generation, reindex operation/source progress, and repository transaction methods.
2. Search for duplicated type definitions, repeated inline response shapes, local console/client
   copies, inconsistent optionality/nullability, and field-name drift.
3. Identify the canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one before feature work proceeds.

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md` — always required;
- `docs/DATA_MODEL.md` with tables, constraints, lifecycle, and legacy invalidation;
- `docs/ARCHITECTURE.md` with staging and atomic promotion boundaries;
- `docs/TECH_STACK.md` with the fixed pgvector dimension/profile compatibility rule;
- `docs/API_CONTRACT.md` if repository state becomes externally visible;
- `docs/TEST_STRATEGY.md` and `docs/TEST_COVERAGE_PLAN.md` for PostgreSQL lifecycle coverage;
- `docs/EPICS.md` only when progress/status is accurate.

If no additional documentation changes are needed, explicitly verify that every impacted document
is still accurate. Code, tests, and docs move together.

## Acceptance Criteria

- [ ] PostgreSQL enforces the selected production dimension.
- [ ] The vector index uses `vector_cosine_ops` on the fixed-dimension column.
- [ ] Legacy hash vectors cannot enter the active real-embedding corpus.
- [ ] Every active vector identifies one canonical profile and corpus generation.
- [ ] Staged chunks are invisible to concurrent normal retrieval.
- [ ] A failed source replacement or failed promotion preserves the prior active corpus.
- [ ] Promotion validates completeness and changes the active profile/corpus atomically.
- [ ] Idempotency and dimension/profile constraints are covered by PostgreSQL tests.
