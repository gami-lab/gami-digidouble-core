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
configurable size (default **1,500 chars**, 100–10,000 allowed). A safety ceiling of 8,000 characters
and up to 200 characters of deterministic overlap are applied to persisted chunks. Oversized normal
paragraphs split at sentence boundaries with a raw-character fallback; oversized fenced code blocks
use raw splitting to honor the same ceiling.

### Phase 3 — Embedding and corpus versioning

Chunk text is embedded through `IEmbeddingAdapter`. Production wires
[OpenAiEmbeddingAdapter](../apps/core/src/infrastructure/knowledge/openai-embedding.adapter.ts)
(`text-embedding-3-small`, real API calls, batched, validated, retryable-error-typed). Every chunk
carries an `embeddingProfileId` + `corpusGenerationId`; a source's chunks are written by
[replaceActiveSourceChunks](../apps/core/src/infrastructure/db/repositories/postgres-knowledge-corpus.repository.ts#L393)
inside one transaction, so a source is never left half-vectorized. Changing the embedding
profile/model runs a **staged reindex**
([knowledge-reindex.service.ts](../apps/core/src/application/services/knowledge/knowledge-reindex.service.ts)):
every source is re-chunked into a new `corpusGenerationId`; changed chunks are re-embedded, while
unchanged chunks at the same `sourceId` + `chunkIndex` reuse their content-matched vector when the
active profile is unchanged. Every vector is still written under the new generation, validated for
completeness, and only then atomically promoted as the active generation — the previous generation
stays servable until promotion succeeds. A profile change always re-embeds every chunk. This is a
genuine, non-trivial piece of infrastructure engineering.

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

### Phase 6 — Vector and lexical search

[postgres-knowledge-chunk.repository.ts](../apps/core/src/infrastructure/db/repositories/postgres-knowledge-chunk.repository.ts#L196-L233)
runs one `pgvector` cosine-distance `ORDER BY ... LIMIT` query per (query variant × knowledge type),
with scenario, readiness, embedding-profile/corpus-generation identity, and Avatar-visibility
filters **all pushed into the SQL `WHERE` clause**. It also runs a bounded `simple` full-text query
with the same filters; both candidate paths are fused before selection.

### Phase 7 — Merge, dedupe, rank

[typed-retrieval.service.ts](../apps/core/src/application/services/knowledge/typed-retrieval.service.ts#L245-L269)
merges per-variant vector and lexical candidate lists, deduplicates by `chunkId`, and applies the
fixed lexical fusion boost before deterministic sorting. The item records whether it matched the
vector path, lexical path, or both.

### Phase 8 — Selection (two distinct stages)

[retrieval-selection.ts](../apps/core/src/domain/knowledge/retrieval-selection.ts) guarantees a floor
of chunks from `last_user_input`/`gm_retrieval_query`/`gm_required_fact` before filling the rest by
similarity. This selector runs:

1. once per knowledge type inside `TypedRetrievalService`,
2. once on the combined `avatar_knowledge + world` set inside
   [context-engine.service.ts:358](../apps/core/src/domain/context/context-engine.service.ts#L358),
   which owns the final Avatar budget decision. `persona-prompt.service.ts` formats those approved
   sections directly and does not select again.

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
profile, visibility mode, match type, and failure codes — never raw vectors or provider payloads.

## 2. Comparison against current RAG best practice

| Dimension                  | Current best practice                                                                                                                                                                       | This system                                                                                                                                                               | Assessment                                                                                                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Embedding fidelity         | Use the model's native or near-native dimensionality (OpenAI's own Matryoshka guidance treats ~256 as a reasonable practical floor for `text-embedding-3-small`, whose native size is 1536) | **`dimensions: 1536`**, enforced against the fresh `VECTOR(1536)` schema ([config.ts:55](../apps/core/src/config.ts), [EMBEDDING_OPERATIONS.md](EMBEDDING_OPERATIONS.md)) | **Resolved for the selected profile.** The native profile removes the previous 16-dimensional compression; the six-fixture harness records the before/after retrieval measurements. |
| Chunking                   | Overlapping windows (~10–20%) or sentence-aware splitting with a hard max chunk size                                                                                                        | Paragraph-aware packing with sentence/raw splitting, an 8,000-character hard cap, and up to 200 characters of overlap                                                     | Deterministic boundary protection and oversized-input safety are now covered; the bounded overlap is intentionally character-based.                                                 |
| Retrieval method           | Hybrid dense + lexical (BM25/full-text) fused (e.g. RRF), especially for names/IDs/numbers                                                                                                  | Bounded `simple` full-text GIN candidates fused with profile-aware pgvector candidates, with shared SQL eligibility filters and `matchType` diagnostics                   | Appropriate fixed hybrid path for the current small corpus; revisit weighting or reranking only if evaluation shows a need.                                                         |
| Reranking                  | Cross-encoder or LLM rerank over the top-k vector hits                                                                                                                                      | None                                                                                                                                                                      | Acceptable at small scale; would address a separate ranking-quality gap if added.                                                                                                   |
| Query transformation       | Query rewriting / HyDE / decomposition                                                                                                                                                      | GM-authored `retrievalPlan` (queries + required facts) generated by the LLM on the prior turn                                                                             | **Genuine strength** — this is a legitimate agentic query-planning mechanism, not just raw-text search.                                                                             |
| Diversity (MMR)            | Penalize near-duplicate top-k results                                                                                                                                                       | None; only per-query-source balancing                                                                                                                                     | Minor gap; low risk given small per-type limits (3–9 chunks).                                                                                                                       |
| Vector index               | HNSW is now generally preferred over IVFFlat for pgvector (better recall/latency, no list-count retuning as data grows)                                                                     | IVFFlat ([init.sql:349](../infra/postgres/init.sql#L349))                                                                                                                 | Reasonable for a small corpus; revisit if corpus size grows.                                                                                                                        |
| Corpus lifecycle           | Versioned embedding spaces, staged rebuild, safe cutover                                                                                                                                    | Full staged reindex + generation promotion + rollback-safe active-corpus pointer                                                                                          | **Genuine strength**, better than most hand-rolled RAG stacks.                                                                                                                      |
| Multi-tenant/ACL filtering | Push access control into the retrieval query, not post-filtering in the app                                                                                                                 | Visibility policy filtered in SQL (`buildVisibilityFilter`)                                                                                                               | **Strength.**                                                                                                                                                                       |
| Observability              | Bounded, PII/vector-safe tracing                                                                                                                                                            | Structured trace events with profile/timing/count/failure fields, no raw vectors/content leaked                                                                           | **Strength.**                                                                                                                                                                       |
| Incremental indexing       | Re-embed only changed content (content hash / chunk diffing)                                                                                                                                | Reindex hashes final chunk text and reuses matching active-profile vectors by source + chunk index; ingestion remains a full embed path                                   | Resolved for same-profile reindex; profile changes and chunking still correctly force new vectors.                                                                                  |
| Retrieval evaluation       | Offline IR metrics (recall@k, MRR/nDCG) against a labelled query set                                                                                                                        | A small opt-in recall@k/MRR harness now covers six labelled murder-party queries; the broader conversation-evaluation harness still judges whole conversations            | The harness records the historical 16-dimensional baseline and the native 1536-dimensional comparison; it is intentionally not a general framework, dashboard, or CI gate.          |

## 3. Is this a real RAG system?

**Yes, architecturally** — and the surrounding machinery (profile/generation versioning, staged
reindex with transactional promotion, SQL-pushed ACL/visibility, bounded observability, an
LLM-authored retrieval-planning loop between the GM and the next Avatar turn) is well above the bar
of a typical hand-rolled RAG implementation. This is not the old system's "hash-vector fallback
posing as retrieval" — chunks are truly embedded by a real provider, truly stored in `pgvector`, and
ranked by bounded SQL vector and full-text candidate paths.

The previous production profile was retrieval-crippled by one configuration choice. Shrinking
`text-embedding-3-small` down to 16 dimensions threw away essentially all of the semantic resolution
the embedding model provides. The selected native 1536-dimensional profile removes that compression;
on the representative six-fixture set, MRR improved from 0.722222 to 0.916667 while recall@3/7/9
remained 1.000000. This is useful baseline evidence, not a substitute for a larger labelled evaluation set.

## 4. Dead code and vestigial diagnostics

1. **Resolved — remove the unmeasurable `excludedChunkCount`.** Visibility filtering remains in the
   SQL `WHERE` clause, so the application cannot cheaply observe excluded rows without an additional
   corpus scan. The field, its derived visibility aggregate, and the unused
   `eligibilityExcludedCount` sibling were removed from retrieval traces, shared DTOs, persisted
   context-selection output, and console diagnostics. Parsers continue to ignore the legacy fields in
   older persisted events.

2. **Resolved — duplicate Avatar selection.** `TypedRetrievalService` still selects independently
   within each knowledge type
   ([typed-retrieval.service.ts:226](../apps/core/src/application/services/knowledge/typed-retrieval.service.ts#L226));
   that is distinct from the final cross-type decision. `context-engine.service.ts` is now the single
   authoritative final Avatar selector
   ([context-engine.service.ts:358](../apps/core/src/domain/context/context-engine.service.ts#L358)),
   while `persona-prompt.service.ts` formats the approved typed sections directly. The removed
   `retrievalOptions` plumbing prevents selection limits from being duplicated across layers.

3. **Resolved — document the retained direct chunk write method.** All production vector writes go through
   [postgres-knowledge-corpus.repository.ts](../apps/core/src/infrastructure/db/repositories/postgres-knowledge-corpus.repository.ts)'s
   own `INSERT INTO knowledge_chunks` inside `replaceActiveSourceChunks`/`replaceStagedSourceChunks`.
   `PostgresKnowledgeChunkRepository.create()` remains only because the shared interface is also used
   by the in-memory corpus repository and repository-level fixtures. Its implementation now explicitly
   documents that it is not a supported production write path.

4. **`HashEmbeddingAdapter` and `SemanticFixtureEmbeddingAdapter`** are correctly test-only (verified:
   referenced only from test files and `UnconfiguredEmbeddingAdapter` correctly hard-fails when no
   provider is configured) — **not** dead code, despite superficially looking like leftover fallback
   paths from the pre-redo system. No action needed; flagged here only because the original audit's
   biggest complaint was exactly this kind of silent fallback, and it's worth confirming it's gone.

## 5. Recommendations, in priority order

**Resolved — Raise embedding dimensionality.** The default is now the native 1536 dimensions for
`text-embedding-3-small`; the canonical schema and staged reindex path were updated together. The
historical 16-dimensional baseline and native-profile comparison are recorded by the retrieval-quality
harness.

**Addressed — Cap oversized paragraphs and add chunk overlap.** `toChunkSeeds` now applies the
8,000-character hard maximum and bounded deterministic overlap to both ingestion and staged reindex
paths. Remaining retrieval-quality work is tracked below and should be measured against the committed
baseline harness.

**Resolved — Make Context Engine the authoritative Avatar selector.** The final cross-type selection
and budget decision lives in `context-engine.service.ts`; `persona-prompt.service.ts` only formats the
already-selected items it receives.

**Resolved — Remove `excludedChunkCount`.** Visibility-filtered candidate counts remain available;
the unmeasurable excluded-row count is no longer emitted or rendered.

**Resolved — Add a lexical fallback for exact-entity queries.** A `simple` full-text GIN index on
`knowledge_chunks.content` supplies bounded, filter-consistent lexical candidates for every normalized
query variant. `TypedRetrievalService` fuses them with vector candidates and exposes a bounded
`matchType` diagnostic, recovering named-entity lookups that dense retrieval may miss.

**Resolved — Incremental reindexing.** Final chunk text is persisted as a SHA-256 content hash.
`KnowledgeReindexService` reuses a valid vector for matching `(sourceId, chunkIndex, contentHash)`
entries only when the target profile is the active profile; it still writes the copied vector under
the new generation and validates the complete corpus. Profile changes and the separate ingestion
path continue to embed all produced chunks.

**Resolved — Add a small retrieval-quality eval set.** The standalone retrieval-quality tool now
uses versioned `(scenario, query, expected chunk IDs)` fixtures and reports recall@k/MRR, including
the historical 16-dimensional baseline and native-profile comparison. It remains intentionally
small and is not a general framework, dashboard, or CI gate.
