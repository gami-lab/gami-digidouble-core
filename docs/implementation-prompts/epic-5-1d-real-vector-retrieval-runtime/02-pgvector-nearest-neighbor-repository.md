# Add Filtered Pgvector Nearest-Neighbor Search

## Context

The current repository can only list chunks by source IDs, forcing the application service to load
and score the whole eligible corpus. This slice adds the nearest-neighbor port and makes PostgreSQL
apply eligibility constraints before candidate limiting and cosine ordering.

## Scope

Implement now:

- extend `IKnowledgeChunkRepository` with a vector-search operation accepting query vector,
  scenario, knowledge type, candidate limit, active profile, visibility mode/active avatar, eligible
  source IDs or equivalent static scope, and user/session/conversation scope where still applicable;
- return bounded candidates ordered by pgvector cosine distance with normalized similarity;
- implement the operation in PostgreSQL using `<=>` and the EPIC 5.1c active corpus/profile model;
- filter scenario, ready source status, type, source/chunk visibility, active avatar, profile,
  generation, and remaining static scope in SQL before or within nearest-neighbor selection;
- keep GM visibility bypass explicit rather than inferring it from a missing avatar;
- add a deterministic in-memory/fake implementation for unit tests without reproducing production
  lexical logic;
- add PostgreSQL integration tests for order, filters, limits, dimensions, and query-plan/index shape.

Out of scope:

- query embedding, multi-query merging, Context Engine budgeting, or UI changes;
- hybrid search, metadata boosts, reranking, or a new vector database;
- unrelated changes to chunk-list operations used for administration/ingestion.

## Relevant Docs

- `docs/ARCHITECTURE.md`
- `docs/PRINCIPLES.md`
- `docs/TECH_STACK.md`
- `docs/DATA_MODEL.md`
- `docs/API_CONTRACT.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`
- EPIC 5.1c profile/corpus/index documentation

## Implementation Guidance

- Start at `IKnowledgeChunkRepository.ts`, `postgres-knowledge-chunk.repository.ts`, its integration
  test, the relevant migrations, and knowledge-source visibility/status columns.
- Prefer a typed options object and candidate result rather than positional parameters. Keep
  profile/generation identifiers mandatory for production search.
- Use cosine distance as the SQL ordering primitive. Return exact finite `distance` and derive
  `similarity = 1 - distance` consistently; document expected range/clamping for display.
- Ensure `LIMIT` applies after eligibility filters. Never fetch vectors/content for excluded rows
  merely to filter them in Application memory.
- Encode source policy (`all`, `avatars`, `none`) and chunk overrides according to existing
  `knowledge-visibility.ts` semantics. Add truth-table tests before replacing that logic.
- Make GM bypass an explicit enum/boolean in the repository request and diagnostic metadata. A
  missing `activeAvatarId` must not silently grant unrestricted access.
- Preserve memory/static-scope behavior exactly as documented, but note EPIC 4.2d owns any later
  removal of conversational memory from RAG.
- Validate vector dimension/profile before issuing SQL and map database errors to the canonical
  retrieval failure without leaking vector values.
- Use `EXPLAIN` or an equivalent stable assertion to verify an index-compatible shape. Do not make
  fragile cost/node assertions that fail solely due to tiny fixture tables; document the chosen
  method and ensure filtering plus `ORDER BY embedding <=> query LIMIT n` can use the pgvector index.

## Constraints

- SQL and pgvector details remain in Infrastructure.
- No application-side corpus scan or production cosine loop.
- No lexical operators, token overlap, or metadata relevance boosts.
- Keep queries parameterized and IDs prefix-safe.
- Preserve ready-source and active-corpus transactional invariants from EPIC 5.1c.
- Do not add a dependency or dedicated vector database.

## Deliverables

- Canonical nearest-neighbor repository request/result port.
- PostgreSQL cosine-search implementation with all required SQL-side filters.
- Explicit Avatar-filtered and GM-unrestricted visibility modes.
- Deterministic fake/in-memory vector repository behavior for unit tests.
- PostgreSQL integration coverage including index-compatible query structure.

## Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts: knowledge source/chunk, embedding profile/generation,
   visibility policy, active avatar, memory/static scope, candidate, and retrieval failure.
2. Search for duplicated type definitions, repeated inline response shapes, local console/client
   copies, inconsistent optionality/nullability, and field-name drift.
3. Identify the canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one before feature work proceeds.

## Mandatory Final Step — Documentation Update

After implementation, review and update `docs/PROJECT_STATUS.md` (always), `docs/ARCHITECTURE.md`,
`docs/DATA_MODEL.md`, `docs/TECH_STACK.md`, `docs/API_CONTRACT.md`, `docs/GAME_MASTER_CONTRACT.md`,
`docs/TEST_STRATEGY.md`, `docs/TEST_COVERAGE_PLAN.md`, and `docs/EPICS.md` as needed. Document exact
distance/similarity and visibility semantics. Explicitly verify unchanged docs. Code, tests, and
docs move together.

## Acceptance Criteria

- [ ] The port accepts every required scope and returns bounded ordered vector candidates.
- [ ] SQL filters scenario, ready status, type, visibility, static scope, and active profile/corpus.
- [ ] Avatar visibility and explicit GM bypass match the existing truth table.
- [ ] Cosine distance ordering and normalized similarity semantics are consistent and tested.
- [ ] Wrong dimensions/profiles fail in a controlled manner without leaking vectors.
- [ ] No full-corpus list operation participates in nearest-neighbor retrieval.
- [ ] PostgreSQL tests verify order, filters, limits, dimensions, and index compatibility.
