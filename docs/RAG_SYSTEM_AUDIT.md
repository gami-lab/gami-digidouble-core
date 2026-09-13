# RAG system audit (post-redo)

This is an evaluative companion to [RAG_SYSTEM_IMPLEMENTATION.md](RAG_SYSTEM_IMPLEMENTATION.md),
which describes _what the code does_. This document judges _whether what it does is good_: is it a
real RAG system, does it match current best practice, does it contain dead or redundant code, and
what should change.

Scope: everything under `apps/core/src/{application,domain,infrastructure}/**/knowledge/**`, the
context engine's retrieval integration, and the admin/console retrieval surfaces. Verified against
the current working tree, not the pre-redo system the original audit covered.

## 1. Phase-by-phase description

### Phase 1 — Source registration and content loading

A `KnowledgeSource` (`avatar_knowledge` / `world` / `media`) is registered with a scenario, format,
and optional visibility policy. Content is loaded once per ingestion by
[file-url-knowledge-source-content-loader.ts](../apps/core/src/infrastructure/knowledge/file-url-knowledge-source-content-loader.ts):
inline text, HTTP(S) fetch, local file (under an allow-listed root), or `pdf-parse` for PDFs. Media
sources resolve to a text description, not a real multimodal embedding.

### Phase 2 — Chunking

[knowledge-ingestion.service.ts](../apps/core/src/application/services/knowledge/knowledge-ingestion.service.ts#L435-L492)
splits on blank lines, tracks Markdown heading paths, and packs consecutive paragraphs up to a
configurable size (default **1,500 chars**, 100–10,000 allowed). There is **no overlap** between
chunks, and **no upper bound** on a single paragraph: if one paragraph exceeds the chunk size it
becomes one oversized chunk regardless of length.

### Phase 3 — Embedding and corpus versioning

Chunk text is embedded through `IEmbeddingAdapter`. Production wires
[OpenAiEmbeddingAdapter](../apps/core/src/infrastructure/knowledge/openai-embedding.adapter.ts)
(`text-embedding-3-small`, real API calls, batched, validated, retryable-error-typed). Every chunk
carries an `embeddingProfileId` + `corpusGenerationId`; a source's chunks are written by
[replaceActiveSourceChunks](../apps/core/src/infrastructure/db/repositories/postgres-knowledge-corpus.repository.ts#L393)
inside one transaction, so a source is never left half-vectorized. Changing the embedding
profile/model runs a **staged reindex**
([knowledge-reindex.service.ts](../apps/core/src/application/services/knowledge/knowledge-reindex.service.ts)):
every source is re-embedded into a new `corpusGenerationId`, validated for completeness, and only
then atomically promoted as the active generation — the previous generation stays servable until
promotion succeeds. This is a genuine, non-trivial piece of infrastructure engineering.

### Phase 4 — Runtime query construction

[typed-retrieval-query-builder.ts](../apps/core/src/application/services/knowledge/typed-retrieval-query-builder.ts)
builds several labelled query variants per turn (`gm_guideline`, `gm_retrieval_query`,
`gm_required_fact`, `last_user_input`, `working_memory` for the Avatar; `world_context` +
`working_memory` for the GM). Notably, `gm_retrieval_query`/`gm_required_fact` are **written by the
Game Master LLM** on the previous turn (see `gm-prompt.service.ts`'s retrieval-planning policy) —
this is a real query-planning step, not just "embed the raw user message," and it is consumed only
when a keyword heuristic (`shouldUsePlannedRetrieval`) judges the plan still on-topic.

### Phase 5 — Query embedding

[knowledge-query-embedding.service.ts](../apps/core/src/application/services/knowledge/knowledge-query-embedding.service.ts)
embeds all variants in one batch through the same adapter/profile used at ingestion time, and
rejects the batch outright (all variants, not per-variant) if the profile drifted mid-flight.

### Phase 6 — Vector search

[postgres-knowledge-chunk.repository.ts](../apps/core/src/infrastructure/db/repositories/postgres-knowledge-chunk.repository.ts#L196-L233)
runs one `pgvector` cosine-distance `ORDER BY ... LIMIT` query per (query variant × knowledge type),
with scenario, readiness, embedding-profile/corpus-generation identity, and Avatar-visibility
filters **all pushed into the SQL `WHERE` clause**. There is no separate hybrid/keyword search path.

### Phase 7 — Merge, dedupe, rank

[typed-retrieval.service.ts](../apps/core/src/application/services/knowledge/typed-retrieval.service.ts#L245-L269)
merges per-variant candidate lists, keeps the best-scoring row per `chunkId`, and sorts deterministically
(similarity → query-variant order → sourceId → chunkIndex).

### Phase 8 — Selection (three times)

[retrieval-selection.ts](../apps/core/src/domain/knowledge/retrieval-selection.ts) guarantees a floor
of chunks from `last_user_input`/`gm_retrieval_query`/`gm_required_fact` before filling the rest by
similarity. This selector runs:

1. once per knowledge type inside `TypedRetrievalService`,
2. again on the combined `avatar_knowledge + world` set in
   [context-engine.service.ts:358](../apps/core/src/domain/context/context-engine.service.ts#L358),
3. **again** inside
   [persona-prompt.service.ts:226](../apps/core/src/domain/avatar/persona-prompt.service.ts#L226)
   with the same default limit, on the output of step 2.

### Phase 9 — Budget and prompt assembly

The context engine treats each retrieved-context segment (avatar-knowledge / world / media) as one
all-or-nothing candidate against a token budget — a segment is either fully included or fully
dropped, never trimmed item-by-item. `persona-prompt.service.ts` then renders the surviving items as
a `## Retrieved Context` Markdown block.

### Phase 10 — Post-turn Game Master retrieval

After the Avatar reply is sent, the GM runs its own retrieval asynchronously with
`bypassVisibilityFilter: true` (so it can see Avatar-hidden lore) and writes the next turn's
`retrievalPlan` (queries/required facts) — closing the loop described in Phase 4.

### Phase 11 — Diagnostics

The admin retrieval endpoint and console "inspect retrieval" panel run the same
`TypedRetrievalService` and surface a bounded trace: candidate/selected counts, timings, embedding
profile, visibility mode, and failure codes — never raw vectors or provider payloads.

## 2. Comparison against current RAG best practice

| Dimension                  | Current best practice                                                                                                                                                                       | This system                                                                                                                                     | Assessment                                                                                                                                                                                                                                                                                                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Embedding fidelity         | Use the model's native or near-native dimensionality (OpenAI's own Matryoshka guidance treats ~256 as a reasonable practical floor for `text-embedding-3-small`, whose native size is 1536) | **`dimensions: 16`**, hard-enforced at startup ([config.ts:55](../apps/core/src/config.ts), [EMBEDDING_OPERATIONS.md](EMBEDDING_OPERATIONS.md)) | **Critical gap.** 16 floats cannot encode meaningful semantics for prose; cosine similarity over such a vector is close to noise for anything beyond near-duplicate text. This is the single highest-impact finding — everything downstream (SQL filters, staged reindex, balanced selection) is well engineered around a signal that is almost certainly too degraded to rank well. |
| Chunking                   | Overlapping windows (~10–20%) or sentence-aware splitting with a hard max chunk size                                                                                                        | Paragraph-packing to a target size, **zero overlap**, **no hard cap** on an oversized single paragraph                                          | Missing overlap risks losing context at chunk boundaries; the uncapped paragraph is also a latent ingestion failure risk (see §4).                                                                                                                                                                                                                                                   |
| Retrieval method           | Hybrid dense + lexical (BM25/full-text) fused (e.g. RRF), especially for names/IDs/numbers                                                                                                  | Pure dense vector only, no lexical fallback                                                                                                     | At 16 dimensions this gap compounds: exact-entity lookups (character names, places) that lexical search would nail are left entirely to a degraded embedding.                                                                                                                                                                                                                        |
| Reranking                  | Cross-encoder or LLM rerank over the top-k vector hits                                                                                                                                      | None                                                                                                                                            | Acceptable at small scale; would meaningfully offset the low-dimension embedding if added.                                                                                                                                                                                                                                                                                           |
| Query transformation       | Query rewriting / HyDE / decomposition                                                                                                                                                      | GM-authored `retrievalPlan` (queries + required facts) generated by the LLM on the prior turn                                                   | **Genuine strength** — this is a legitimate agentic query-planning mechanism, not just raw-text search.                                                                                                                                                                                                                                                                              |
| Diversity (MMR)            | Penalize near-duplicate top-k results                                                                                                                                                       | None; only per-query-source balancing                                                                                                           | Minor gap; low risk given small per-type limits (3–9 chunks).                                                                                                                                                                                                                                                                                                                        |
| Vector index               | HNSW is now generally preferred over IVFFlat for pgvector (better recall/latency, no list-count retuning as data grows)                                                                     | IVFFlat ([init.sql:349](../infra/postgres/init.sql#L349))                                                                                       | Reasonable for a small corpus; revisit if corpus size grows.                                                                                                                                                                                                                                                                                                                         |
| Corpus lifecycle           | Versioned embedding spaces, staged rebuild, safe cutover                                                                                                                                    | Full staged reindex + generation promotion + rollback-safe active-corpus pointer                                                                | **Genuine strength**, better than most hand-rolled RAG stacks.                                                                                                                                                                                                                                                                                                                       |
| Multi-tenant/ACL filtering | Push access control into the retrieval query, not post-filtering in the app                                                                                                                 | Visibility policy filtered in SQL (`buildVisibilityFilter`)                                                                                     | **Strength.**                                                                                                                                                                                                                                                                                                                                                                        |
| Observability              | Bounded, PII/vector-safe tracing                                                                                                                                                            | Structured trace events with profile/timing/count/failure fields, no raw vectors/content leaked                                                 | **Strength.**                                                                                                                                                                                                                                                                                                                                                                        |
| Incremental indexing       | Re-embed only changed content (content hash / chunk diffing)                                                                                                                                | Every ingest and every reindex re-embeds **all** chunks of a source from scratch                                                                | Cost/latency gap; fine at current scale, will not scale to large or frequently-edited sources.                                                                                                                                                                                                                                                                                       |
| Retrieval evaluation       | Offline IR metrics (recall@k, MRR/nDCG) against a labelled query set                                                                                                                        | None; a separate LLM-judge conversation-evaluation harness exists (`tools/conversation-evaluation`) but does not isolate retrieval quality      | Explicitly out of scope by design ([epic-5-1d 04](implementation-prompts/epic-5-1d-real-vector-retrieval-runtime/04-diagnostics-admin-and-evaluation-integration.md)), so this is a known, not accidental, gap — but it also means the 16-dimension regression above has never been measured.                                                                                        |

## 3. Is this a real RAG system?

**Yes, architecturally** — and the surrounding machinery (profile/generation versioning, staged
reindex with transactional promotion, SQL-pushed ACL/visibility, bounded observability, an
LLM-authored retrieval-planning loop between the GM and the next Avatar turn) is well above the bar
of a typical hand-rolled RAG implementation. This is not the old system's "hash-vector fallback
posing as retrieval" — chunks are truly embedded by a real provider, truly stored in `pgvector`, and
truly ranked by nearest-neighbor search in SQL.

**But it is retrieval crippled by one configuration choice.** Shrinking `text-embedding-3-small` down
to 16 dimensions (documented as the deliberate "current production profile," not a bug) throws away
essentially all of the semantic resolution the embedding model provides. Practically, this means
similarity ranking over prose chunks is likely to behave closer to "coarse topical clustering" than
"semantic match," and the elaborate downstream ranking/selection/budgeting logic is polishing a
signal that was mostly discarded at the source. This should be treated as the top-priority fix — it
is also the cheapest one to reason about, since the rest of the pipeline (profile identity checks,
staged reindex, dimension validation) already exists specifically to make a dimension change safe.

## 4. Dead code and vestigial diagnostics

1. **`excludedChunkCount` is permanently `0`.**
   [typed-retrieval.service.ts:239](../apps/core/src/application/services/knowledge/typed-retrieval.service.ts#L239)
   and [:304](../apps/core/src/application/services/knowledge/typed-retrieval.service.ts#L304)
   hardcode `excludedChunkCount: 0` — visibility filtering moved into the SQL `WHERE` clause, so the
   application layer can no longer observe what it excluded. The field still flows through
   `retrieval-trace-dto.ts`, `knowledge.types.ts`, `knowledge-contract-types.ts`, and is rendered to
   operators in
   [session-admin-knowledge.tsx:371](../apps/console/src/pages/session-admin-knowledge.tsx#L371) as
   `excluded(world)=0` — a diagnostic that looks meaningful but never varies. Either compute a real
   SQL-side excluded count (e.g. a second bounded count query, or an `EXPLAIN`-free `COUNT(*) FILTER`
   in the same query) or delete the field end-to-end and stop showing it to operators.

2. **`selectBalancedRetrievedItems` runs three times on the Avatar path** for the same content: once
   per knowledge type in `TypedRetrievalService`
   ([typed-retrieval.service.ts:226](../apps/core/src/application/services/knowledge/typed-retrieval.service.ts#L226)),
   again on the combined `avatar_knowledge + world` set in
   [context-engine.service.ts:358](../apps/core/src/domain/context/context-engine.service.ts#L358),
   and a third time in
   [persona-prompt.service.ts:228](../apps/core/src/domain/avatar/persona-prompt.service.ts#L228) with
   the same default limit. The third call is not incorrect (the selector is stable/idempotent on an
   already-selected set), but it re-runs balancing logic on data that was already balanced and
   budgeted, which is confusing to trace and a latent bug magnet if the two call sites' options
   (`maxChunks`, `minimumChunksBySource`) ever drift apart. Recommend making the context engine the
   single authoritative selection point and have `persona-prompt.service.ts` format pre-selected
   items without re-selecting.

3. **`PostgresKnowledgeChunkRepository.create()` is unreachable in production.** All production
   vector writes go through
   [postgres-knowledge-corpus.repository.ts](../apps/core/src/infrastructure/db/repositories/postgres-knowledge-corpus.repository.ts)'s
   own `INSERT INTO knowledge_chunks` inside `replaceActiveSourceChunks`/`replaceStagedSourceChunks`.
   `PostgresKnowledgeChunkRepository.create()` exists only to satisfy the `IKnowledgeChunkRepository`
   interface; its only real caller is `InMemoryKnowledgeCorpusRepository` (the dev/test in-memory
   stack). It isn't harmful, but it is dead weight on the Postgres adapter and slightly misleads a
   reader into thinking single-chunk creation is a supported production write path. Worth a comment
   at minimum, or splitting a narrower interface for the corpus-generation write path vs. read/delete.

4. **`HashEmbeddingAdapter` and `SemanticFixtureEmbeddingAdapter`** are correctly test-only (verified:
   referenced only from test files and `UnconfiguredEmbeddingAdapter` correctly hard-fails when no
   provider is configured) — **not** dead code, despite superficially looking like leftover fallback
   paths from the pre-redo system. No action needed; flagged here only because the original audit's
   biggest complaint was exactly this kind of silent fallback, and it's worth confirming it's gone.

## 5. Recommendations, in priority order

**P0 — Fix embedding dimensionality.** Raise `DEFAULT_EMBEDDING_DIMENSIONS` from 16 to at least 256
(512 or the model's native 1536 if storage/latency budget allows), migrate `VECTOR(16)` →
`VECTOR(N)` and its IVFFlat index, and run the existing staged-reindex flow to repopulate. The
machinery to do this safely (profile/generation identity checks, dimension validation at startup,
transactional promotion) already exists — this is a configuration and migration change, not new
architecture. This single change is likely to have a larger effect on answer quality than any other
item in this list.

**P0 — Cap oversized paragraphs.** `toChunkSeeds` never splits a paragraph larger than `chunkSize`
([knowledge-ingestion.service.ts:459-481](../apps/core/src/application/services/knowledge/knowledge-ingestion.service.ts#L459-L481)).
A PDF or pasted source with no blank lines can produce a chunk large enough to exceed the embedding
model's input token limit, failing ingestion outright. Add a hard fallback split (e.g. by sentence or
by raw character count) for any paragraph beyond a safety multiple of `chunkSize`.

**P1 — Add chunk overlap.** Even a small fixed overlap (trailing N characters/sentences of the
previous chunk repeated at the start of the next) reduces boundary information loss, and is a
low-risk, well-understood change to `toChunkSeeds`.

**P1 — Resolve the triple-selection redundancy** described in Dead code finding #2: make
`context-engine.service.ts` the single place that runs `selectBalancedRetrievedItems` for the Avatar
path, and have `persona-prompt.service.ts` only format the already-selected items it's given.

**P1 — Make `excludedChunkCount` real or remove it.** Currently a hardcoded zero surfaced to
operators as if it were live data (Dead code finding #1). Either compute it or delete it from the
DTO/UI so operators aren't reading a diagnostic that never moves.

**P2 — Add a lexical fallback for exact-entity queries.** A `tsvector`/trigram index on
`knowledge_chunks.content`, fused with the vector results (even a simple "union in, dedupe, prefer
vector rank" — full reciprocal-rank fusion isn't required to get most of the benefit), would recover
named-entity lookups that a compressed embedding is likely to miss. This becomes materially more
important if the P0 dimension fix is deferred.

**P2 — Incremental reindexing.** `KnowledgeReindexService.processSource` re-embeds every chunk of
every source on every reindex run, with no content-hash short-circuit for unchanged chunks. Fine
today; will become a real cost/latency problem as the number and size of sources grows. Track a
content hash per chunk and skip re-embedding when it's unchanged from the previous generation.

**P2 — A small retrieval-quality eval set.** The existing `tools/conversation-evaluation` harness
judges whole conversations with an LLM judge; it does not isolate retrieval precision/recall. A
lightweight, versioned set of (scenario, query, expected chunk IDs) fixtures with recall@k scoring
would (a) prove whether the P0 dimension fix actually helps and by how much, and (b) catch future
regressions in chunking/selection changes that a conversation-level judge would not localize to
retrieval specifically. This was explicitly deferred by design during the 5.1d epic, not forgotten —
but it is now the only way to validate the P0 fix quantitatively rather than by inspection.
