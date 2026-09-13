# Add A Lexical Candidate Path For Exact-Entity Queries

## Context

Retrieval today is pure dense-vector cosine search — there is no keyword/full-text fallback anywhere
in `IKnowledgeChunkRepository`/`PostgresKnowledgeChunkRepository`. `docs/RAG_SYSTEM_AUDIT.md` flags
this as a P2 gap: named entities (character names, places, exact IDs common in narrative world lore)
are exactly the kind of query a compressed embedding is most likely to miss, and a simple lexical
fallback recovers most of that risk without needing a full hybrid-search framework. This matters more,
not less, if the `02` dimension migration lands with a moderate (e.g. 256) rather than maximal
dimension count.

## Scope

Implement now:

- a PostgreSQL full-text or trigram index on `knowledge_chunks.content` (`tsvector`/`GIN` or
  `pg_trgm`, whichever fits this schema's existing conventions better — check `init.sql` for any
  precedent before choosing) scoped by the same scenario/type/readiness/visibility/profile/generation
  filters `searchByVector` already applies;
- a bounded lexical candidate query in the same repository, reusing the existing filter-building
  helpers (`buildSourceFilter`, `buildVisibilityFilter`) rather than duplicating that SQL;
- a fusion step in `TypedRetrievalService` (or a clearly-owned helper it calls) that merges lexical and
  vector candidates for the same chunk without inventing a second, divergent ranking algorithm —
  reciprocal rank fusion (RRF) is a reasonable, well-understood choice, but a simpler "union in,
  dedupe by chunk ID, prefer the vector-similarity rank with a lexical-match tiebreak boost" is
  acceptable if it keeps the change smaller and easier to reason about;
- trace/diagnostics fields describing whether a returned chunk matched lexically, vector-only, or
  both, following the existing bounded-diagnostics conventions (no raw content beyond what is already
  exposed).

Out of scope:

- a general hybrid-search framework, a pluggable ranking strategy, or configurable fusion weights —
  keep this to one fixed, documented fusion behavior;
- reranking with a cross-encoder or LLM (a separate, larger change not requested by this audit);
- changing the embedding pipeline (already handled by `01`/`02`).

## Relevant Docs

- `docs/RAG_SYSTEM_AUDIT.md`
- `docs/RAG_SYSTEM_IMPLEMENTATION.md`
- `docs/DATA_MODEL.md`
- `docs/API_CONTRACT.md`
- `docs/ARCHITECTURE.md`

## Implementation Guidance

- Start with `postgres-knowledge-chunk.repository.ts`'s `searchByVector`, `buildSourceFilter`, and
  `buildVisibilityFilter` — the lexical query must reuse these, not re-derive scenario/visibility SQL
  independently, or the two paths will silently drift on what counts as "eligible."
- Decide explicitly whether lexical candidates should still require the `assertActiveCorpus`
  profile/generation compatibility check to pass, even though a lexical index is provider/dimension
  independent and carries no vector distance — probably yes, for consistency with what a source's
  "readiness" means, but document the decision either way.
- Add the fusion step in `TypedRetrievalService.retrieveByType`, right where `mergeCandidates` already
  merges per-query-variant vector candidates — this is the natural single place to also fold in
  lexical candidates before `selectBalancedRetrievedItems` runs.
- `IKnowledgeChunkRepository` gains a new method (e.g. `searchByText`) rather than overloading
  `searchByVector`; keep the two query shapes and result types explicit and separately testable.
- Write deterministic tests (fixtures, not live provider calls) proving: a query naming an entity that
  only appears verbatim in one chunk is retrieved even when a `HashEmbeddingAdapter`/
  `SemanticFixtureEmbeddingAdapter` vector match would not have surfaced it.

## Constraints

- Respect `API -> Application -> Domain -> Infrastructure`; SQL/index specifics stay in
  Infrastructure, fusion policy stays in Application (`TypedRetrievalService`), matching how vector
  search is already layered.
- No route, presenter, prompt assembler, or UI implements ranking — this constraint from the 5.1d epic
  still applies; fusion logic lives in exactly one place.
- Reuse `MAX_VECTOR_SEARCH_CANDIDATES`-style bounding for the lexical query; no unbounded scans.
- No new embedding/provider dependency — this is PostgreSQL-native lexical search.

## Deliverables

- A bounded, filter-consistent lexical candidate query in `PostgresKnowledgeChunkRepository`.
- One fusion implementation in `TypedRetrievalService`, covered by deterministic tests.
- Trace fields distinguishing lexical/vector/both matches, following existing bounded-diagnostics
  conventions.
- An index migration in `infra/postgres/init.sql` for the chosen lexical search mechanism.

## Mandatory Pre-Implementation Check

Before coding:

1. Confirm whether `infra/postgres/init.sql` already has any `pg_trgm`/full-text precedent elsewhere
   in the schema to stay consistent with existing conventions.
2. Re-read `docs/GAME_MASTER_CONTRACT.md` and the retrieval query-variant sources
   (`gm_guideline`, `gm_retrieval_query`, etc.) to decide whether lexical fusion should apply to every
   query variant or only specific ones (e.g. `last_user_input`/`gm_required_fact`, which are more
   likely to name concrete entities than `working_memory` summaries).
3. Confirm the `00`/`07` baseline harness has at least one fixture that a pure-vector search on the new
   (post-`02`) dimension count still misses, so this slice's benefit is measurable, not assumed.

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md` — always required;
- `docs/RAG_SYSTEM_IMPLEMENTATION.md` — its "Vector similarity" section currently states retrieval has
  no lexical component; update it;
- `docs/DATA_MODEL.md` for the new index;
- `docs/API_CONTRACT.md` if new trace fields are exposed;
- `docs/EPICS.md` only with truthful progress.

## Acceptance Criteria

- [ ] A bounded lexical candidate query exists, reusing the existing scenario/visibility/readiness
      filter-building helpers rather than duplicating that SQL.
- [ ] Lexical and vector candidates are fused in exactly one place, with deterministic tests proving
      an entity-exact query is retrieved even when a vector-only match would miss it.
- [ ] Trace/diagnostics distinguish lexical/vector/both matches without exposing raw content beyond
      today's existing bounds.
- [ ] No route, presenter, or UI layer implements or duplicates ranking/fusion logic.
- [ ] `docs/RAG_SYSTEM_IMPLEMENTATION.md` accurately describes the hybrid retrieval behavior.
