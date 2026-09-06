# Replace Lexical Ranking In Avatar And Game Master Runtime

## Context

With ordered query vectors and filtered nearest-neighbor candidates available, the existing
`TypedRetrievalService` can stop loading and token-scoring all chunks. This slice owns the ranking
transition while retaining query-source balancing, per-type bounds, deduplication, required
retrieval behavior, Context Engine ownership, Avatar visibility, and asynchronous GM behavior.

## Scope

Implement now:

- refactor `TypedRetrievalService` to embed variants once and execute bounded vector searches for
  each required type/query pair through the repository port;
- remove token-overlap scoring, explanation helpers, and metadata relevance boosts from production;
- merge candidates deterministically, deduplicate chunks, preserve per-query-source minimums and
  per-type limits, and rank using normalized similarity;
- carry matched query source/index plus distance/similarity into safe internal trace data;
- wire the same configured service into Avatar message handling and asynchronous GM context;
- keep Avatar retrieval visibility-filtered and GM retrieval explicitly unrestricted;
- on embedding/search failure, return the controlled empty/failure outcome, preserve Avatar reply
  generation, and trigger existing insufficient-evidence guidance when retrieval was required;
- update focused unit and use-case integration tests.

Out of scope:

- admin/UI presentation (prompt `04`);
- changing Context Engine token budgets or final inclusion policy;
- conversational-memory redesign, hybrid ranking, LLM reranking, or relevance thresholds not
  justified by existing contracts.

## Relevant Docs

- `docs/ARCHITECTURE.md`
- `docs/PRINCIPLES.md`
- `docs/API_CONTRACT.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`

## Implementation Guidance

- Start with `typed-retrieval.service.ts`, `retrieval-selection.ts`, `send-message.use-case.ts`,
  `run-game-master.context.ts`, route composition in `conversations.ts`, and top-level server/index
  adapter construction.
- Resolve/embed normalized queries once per retrieval request, then search a deliberately bounded
  candidate pool large enough for current balanced selection. Do not issue an unbounded query.
- Preserve distinct best matches for `last_user_input`, `gm_retrieval_query`, and
  `gm_required_fact` before global fill. Base all comparisons on similarity, with existing stable
  query/source/chunk tie breakers.
- A chunk returned for multiple variants should retain the variant that caused its best similarity;
  define deterministic equal-score behavior and test it.
- Keep Context Engine as the only owner of final prompt inclusion/trimming. Retrieval returns a
  bounded ranked set and trace; routes and prompt assemblers must not rank independently.
- Delete lexical-only private helpers and update reasons from `token-overlap`/metadata matches to a
  concise vector-match reason or structured diagnostic.
- Preserve Avatar latency on provider failure: catch only at the retrieval boundary, record the
  controlled result, and continue response assembly. Do not swallow unrelated programming errors.
- GM remains async/non-blocking relative to the Avatar. A GM retrieval failure is observable and
  yields bounded empty RAG context rather than failing the user turn.
- Assert production composition requires the embedding/profile dependencies; do not default to the
  hash adapter or a lexical implementation.

## Constraints

- One retrieval algorithm and application boundary for Avatar and GM.
- No provider SDK in Domain/Application business logic.
- No silent lexical or hash-vector production fallback.
- No route/prompt-level search or ranking.
- Preserve current public endpoint shapes until prompt `04` deliberately extends diagnostics.
- Keep all selection deterministic under fixed fake vectors.

## Deliverables

- Vector-backed `TypedRetrievalService` with bounded multi-query/type merge behavior.
- Removed production lexical scorer and metadata boosts.
- Avatar and asynchronous GM wiring through the same service.
- Controlled failure/empty-result behavior and required-evidence propagation.
- Updated deterministic service and runtime use-case tests.

## Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts: query variant, retrieved item/result/trace, session Avatar
   options, GM retrieval plan/state, context projections, failure outcome, and composition options.
2. Search for duplicated type definitions, repeated inline response shapes, local console/client
   copies, inconsistent optionality/nullability, and field-name drift.
3. Identify the canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one before feature work proceeds.

## Mandatory Final Step — Documentation Update

After implementation, review and update `docs/PROJECT_STATUS.md` (always), `docs/ARCHITECTURE.md`,
`docs/API_CONTRACT.md`, `docs/GAME_MASTER_CONTRACT.md`, `docs/MEMORY_SYSTEM_SPEC.md`,
`docs/TEST_STRATEGY.md`, `docs/TEST_COVERAGE_PLAN.md`, and `docs/EPICS.md` where needed. Explicitly
verify unchanged docs. Code, tests, and docs move together.

## Acceptance Criteria

- [ ] Production retrieval never calls `listBySourceIds` to rank a corpus.
- [ ] Token overlap and metadata boosts are absent from the production retrieval path.
- [ ] Query variants share one validated batch embedding operation and bounded SQL searches.
- [ ] Balanced source minimums, per-type limits, tie breakers, and deduplication remain deterministic.
- [ ] Avatar and GM use one service with correct filtered/unrestricted visibility modes.
- [ ] Required retrieval failure injects insufficient-evidence guidance.
- [ ] Embedding/search failure does not block the Avatar response or invoke lexical fallback.
- [ ] Runtime integration tests and documentation checks pass.
