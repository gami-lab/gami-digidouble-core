# RAG system

This is the durable behavior of the current static knowledge pipeline. Algorithms and field details
belong in the knowledge domain/services and shared contracts.

## Scope

Static knowledge is scenario-shared and typed as `avatar_knowledge`, `world`, or `media`.
Conversational memory is a separate system. Static sources and chunks must not contain
`userId`, `sessionId`, or `conversationId` scope.

## Pipeline

1. Register a source with an explicit visibility policy.
2. Ingest text/Markdown/PDF/media descriptions into deterministic paragraph-aware chunks.
3. Embed chunks through the active immutable embedding profile.
4. Stage a complete source/corpus replacement and promote it atomically.
5. Normalize runtime query variants, embed them as one ordered batch, and search active pgvector data.
6. Filter eligibility before the candidate limit, apply Avatar visibility or explicit GM bypass, merge/deduplicate deterministically, and pass bounded results to Context Engine.

## Query sources

Avatar retrieval can combine the current user input with relevant GM-planned queries and required
facts. The plan is consumed only when relevant to the next turn. GM and admin diagnostics may use
the explicit unrestricted visibility mode, but it does not bypass scenario, type, readiness, active
corpus, profile, or metadata rules.

## Ranking and limits

PostgreSQL cosine distance is the repository truth (lower is better). Public similarity is derived
as `1 - distance` and clamped/rounded only by presenters. Multi-query matches are deduplicated and
selected within the configured bounded limits. No production lexical scorer, metadata boost, or
application-wide corpus scan participates in retrieval.

## Failure behavior

Embedding or vector-search failures return bounded controlled outcomes. Avatar generation can
continue with explicit uncertainty guidance; failures must not fabricate retrieved evidence. No
partial query-vector batch is accepted.

## Diagnostics

Expose only profile identity, counts, timings, query index/source, visibility mode, outcome/failure,
similarity, and bounded selected references. Never expose raw vectors, credentials, provider payloads,
or unbounded source content. Runtime events and admin/console projections reuse the shared retrieval
DTOs.

See [EMBEDDING_OPERATIONS.md](EMBEDDING_OPERATIONS.md) for profile changes and reindex operations.
