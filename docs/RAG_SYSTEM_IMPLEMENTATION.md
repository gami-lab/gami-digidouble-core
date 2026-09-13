# RAG system

This is the durable behavior of the current static knowledge pipeline. Algorithms and field details
belong in the knowledge domain/services and shared contracts; this document records the decisions
and gotchas that aren't obvious from reading any single file.

## Scope

Static knowledge is scenario-shared and typed as `avatar_knowledge`, `world`, or `media`.
Conversational memory is a separate system. Static sources and chunks must not contain
`userId`, `sessionId`, or `conversationId` scope — those keys are rejected recursively at
persistence time, and the removed `memory` knowledge type is not accepted.

## End-to-end flow

```text
Knowledge source -> ingestion job -> content loader -> paragraph/header chunking
  -> embed each chunk (production: OpenAI adapter) -> persist chunks + vectors in PostgreSQL

Avatar turn -> build query variants from turn context -> filter ready sources by scenario/type
  -> load chunks -> visibility filtering -> embed query variants -> vector search
  -> deterministic per-type selection -> Context Engine final Avatar selection + budget/precedence
  -> Avatar prompt formatting

Post-turn GM run -> build GM query variants -> same retrieval service with visibility bypass
  -> inject into GM "Retrieved Context" (no fallback to Avatar results)
```

Main implementation entry points: `knowledge-ingestion.service.ts`, `typed-retrieval.service.ts`,
`typed-retrieval-query-builder.ts`, `retrieval-selection.ts`, and
`postgres-knowledge-chunk.repository.ts` under
`apps/core/src/application/services/knowledge/` and `apps/core/src/infrastructure/db/repositories/`.

## Pipeline

1. Register a source with an explicit visibility policy. Registering also schedules ingestion by
   default; the separate ingest route creates another queued job. Only `status: ready` sources are
   considered by runtime retrieval — `pending`/`error` sources are excluded.
2. Ingest text/Markdown/PDF/media descriptions into deterministic paragraph-aware chunks (see
   "Chunking strategy" below).
3. Embed chunks through the active immutable embedding profile.
4. Stage a complete source/corpus replacement and promote it atomically — partial or stale
   profile/generation results never become active, so a failed reindex can't half-apply.
5. At query time, normalize runtime query variants, embed them as one ordered batch, and search
   active pgvector data.
6. Filter eligibility before the candidate limit, apply Avatar visibility or explicit GM bypass,
   merge/deduplicate deterministically, and pass results to Context Engine. The Context Engine is
   the single authoritative final selector for the Avatar path, applying session limits together
   with token-budget and segment inclusion decisions.

## Chunking strategy and why

- Paragraph-aware, not fixed-width: text is split on blank lines into paragraphs, Markdown headings
  (levels 1-6) are tracked and kept with the paragraph text so heading context is embedded and
  retrieved alongside it, and consecutive paragraphs are packed into one chunk up to the configured
  size. This preserves semantic boundaries where possible instead of cutting mid-sentence.
- Oversized paragraphs are split deterministically at sentence boundaries first, with a raw character
  fallback for long sentences. Oversized fenced code blocks use raw character splitting so the hard
  safety ceiling is always honored; a fragment may not be a standalone valid fence, but no source
  content is silently truncated.
- The hard maximum is 8,000 characters per persisted chunk, including headings and overlap
  (`INGESTION_CHUNK_HARD_MAX`). Adjacent chunks repeat up to 200 trailing characters from the prior
  chunk (`INGESTION_CHUNK_OVERLAP`), including boundaries created while splitting an oversized
  paragraph. The overlap is reduced when necessary to stay within the target or hard maximum.
- Default chunk size is 1,500 characters (`INGESTION_CHUNK_SIZE_DEFAULT` in
  `packages/shared/src/knowledge-contract-types.ts`); callers may override per ingestion within the
  API-enforced 100–10,000 character bounds. The hard maximum remains an internal safety ceiling even
  when a caller requests the largest target.
- An empty source still produces one fallback chunk (`Reference source: <uriOrPath>`) so a source
  never silently ends up with zero retrievable content.
- A media source always produces exactly one chunk, from `metadata.description` or a generated
  `Media reference: <uriOrPath>` fallback — Core stores descriptions/references, not a real
  multimodal embedding of the asset.

## Embedding provider

Production uses the OpenAI embedding adapter (requires `OPENAI_API_KEY`), with no hash-vector
fallback — if the adapter isn't configured, ingestion/query embedding fails rather than silently
degrading to a fake vector. The default profile is `text-embedding-3-small` at its native 1536
dimensions, matching the fixed `VECTOR(1536)` column in `infra/postgres/init.sql`. The historical
16-dimensional retrieval baseline remains available for comparison in the retrieval-quality tool.

A deterministic hash-based adapter exists only for tests (explicitly injected, never a server
default). It accumulates character codes per input string into buckets and L2-normalizes the
result — useful for reproducible test fixtures, not a semantic embedding.

**Gotcha:** the embedding profile identity (provider/model/dimension) is persisted and enforced
across ingestion and query time. Changing the profile or dimension requires a matching fresh schema
revision (the `VECTOR(1536)` column width); existing database volumes are not reusable across a
dimension change. After the clean-slate deployment, use the staged reindex for the complete corpus —
you cannot silently swap models without a coordinated migration. See
[EMBEDDING_OPERATIONS.md](EMBEDDING_OPERATIONS.md) for the reindex procedure.

## Query sources

Avatar retrieval combines the current user input, working-memory summary/recent exchanges, and
relevant GM-planned queries/required facts. A heuristic (`shouldUsePlannedRetrieval`, in
`typed-retrieval-query-builder.ts`) decides per turn whether the GM's plan is still relevant —
it's suppressed on an explicit topic change or an emotion-focused message, and otherwise enabled on
token overlap or continuation language. This exists so a stale GM plan from a prior turn doesn't
pollute retrieval when the user has moved on.

GM and admin diagnostics may use the explicit unrestricted visibility mode (`bypassVisibilityFilter`)
so the GM can plan around knowledge hidden from the active Avatar — but it never bypasses scenario,
type, readiness, active-corpus, profile, or metadata rules, only Avatar-visibility scoping.

## Ranking and limits

PostgreSQL cosine distance is the repository truth (lower is better). Public similarity is derived
as `1 - distance` and clamped/rounded only by presenters — raw distance never leaves the
infrastructure layer. Ties are broken deterministically (similarity, then query-variant order,
source ID, chunk index) so identical inputs always produce the same result for different callers.

Limits differ by call site and can drift with code changes — check
`AVATAR_RETRIEVAL_DEFAULT_MAX_CHUNKS` and `DEFAULT_LIMIT_PER_TYPE` in
`packages/shared/src/knowledge-contract-types.ts` and `typed-retrieval.service.ts` for current
values; as of this writing the Avatar path defaults to 7/type (session-configurable up to 9), the
GM path to 3/type, and the admin endpoint accepts 1-20/type.

**Gotcha — two distinct selection stages:** `TypedRetrievalService` selects per knowledge type first
(e.g. up to N `avatar_knowledge` chunks and N `world` chunks independently). The Avatar Context
Engine then combines those typed results and performs the single final selection with the session's
`maxChunks`/`minimumChunksBySource` options before applying token-budget and segment inclusion
decisions. `persona-prompt.service.ts` only formats the resulting typed sections, so it cannot
silently apply a second limit or reorder the approved set. A chunk can still win retrieval selection
and be omitted by the context budget; the turn trace reports selected vs. included vs. omitted counts.

No production lexical scorer, metadata boost, or application-wide corpus scan participates in
retrieval — matching is vector similarity only, scoped by SQL eligibility filters.

## Failure behavior

Embedding or vector-search failures return bounded controlled outcomes; no partial query-vector
batch is accepted. Avatar generation can continue with explicit uncertainty guidance
(`insufficient_evidence` retrieval status) rather than fabricating retrieved evidence — this applies
when a GM plan marked retrieval as required and it failed or returned nothing. If retrieval throws
during an Avatar turn, the failure is logged and the turn continues without retrieved knowledge
rather than failing the whole response.

GM retrieval runs asynchronously after the Avatar response is sent (`schedulePostTurnWork`), so a
slow or failing GM retrieval never delays the user-facing reply.

## Diagnostics

Expose only profile identity, counts, timings, query index/source, visibility mode, outcome/failure,
similarity, and bounded selected references. Visibility diagnostics include considered candidates but
do not claim to count rows excluded by SQL visibility filters. Never expose raw vectors, credentials,
provider payloads, or unbounded source content. Runtime events and admin/console projections reuse the
shared retrieval DTOs; operator screens use the same categories as the API (Shared Avatar Knowledge,
Shared World Knowledge, Media Knowledge).

See [EMBEDDING_OPERATIONS.md](EMBEDDING_OPERATIONS.md) for profile changes and reindex operations.
