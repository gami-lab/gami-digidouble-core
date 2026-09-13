# RAG system: current implementation

This document describes the RAG code that is currently in this repository. It does not describe an ideal or planned RAG system.

## Important conclusion

The current composition generates and stores an embedding for every ingested chunk and uses those
embeddings during retrieval. Production composition uses the Infrastructure OpenAI adapter with an
independent profile and no hash-vector fallback. The default profile is
`text-embedding-3-small` with 16 requested dimensions, matching the current `VECTOR(16)` schema.

Runtime retrieval currently:

- loads every chunk belonging to the eligible sources;
- filters those chunks by scenario, canonical type, readiness, active corpus, and visibility;
- embeds normalized query variants and searches bounded vector pools without lifecycle-scope boosts;
- selects the highest-similarity chunks deterministically.

The application derives normalized cosine similarity from repository candidates. PostgreSQL performs
the nearest-neighbor ordering and eligibility filtering through the canonical vector repository
port.

## End-to-end flow

```text
Knowledge source
  -> ingestion job
  -> source content loader
  -> paragraph/header chunking
  -> explicitly injected deterministic test adapter creates one stored vector per chunk
  -> chunks persisted in PostgreSQL

Avatar turn
  -> build query variants from turn context
  -> find ready sources by scenario and knowledge type
  -> load all chunks for those sources
  -> scenario/type/readiness/active-corpus filtering
  -> Avatar visibility filtering (or explicit GM visibility bypass)
  -> profile-aware query embedding and vector search
  -> deterministic per-type selection
  -> context-engine selection and token-budget filtering
  -> Avatar prompt

Post-turn Game Master run
  -> build GM query variants
  -> repeat the same retrieval service
  -> use the explicit GM visibility-bypass result
  -> inject selected chunks into GM `Retrieved Context` without falling back to Avatar results
```

The main implementation files are:

- [knowledge-ingestion.service.ts](../apps/core/src/application/services/knowledge/knowledge-ingestion.service.ts)
- [typed-retrieval-query-builder.ts](../apps/core/src/application/services/knowledge/typed-retrieval-query-builder.ts)
- [typed-retrieval.service.ts](../apps/core/src/application/services/knowledge/typed-retrieval.service.ts)
- [retrieval-selection.ts](../apps/core/src/domain/knowledge/retrieval-selection.ts)
- [hash-embedding.adapter.ts](../apps/core/src/infrastructure/knowledge/test-support/hash-embedding.adapter.ts)
- [Postgres knowledge chunk repository](../apps/core/src/infrastructure/db/repositories/postgres-knowledge-chunk.repository.ts)

## 1. Where the knowledge comes from

A knowledge source is registered with:

- `scenarioId`
- `name`
- `knowledgeType`: `avatar_knowledge`, `world`, or `media`
- `format`: `pdf`, `text`, `markdown`, `url`, or `media`
- `uriOrPath`
- optional `metadata`
- optional visibility policy and avatar IDs

The HTTP contract is in [knowledge-contract-types.ts](../packages/shared/src/knowledge-contract-types.ts#L9-L42), and the route validation is in [knowledge.ts](../apps/core/src/api/routes/knowledge.ts#L77-L94).

`avatar_knowledge` is static source material relevant to an Avatar, including avatar-specific
backstory that is visibility-scoped to that Avatar. It is not conversational user memory. New or
updated source/chunk metadata cannot contain `userId`, `sessionId`, or `conversationId`,
including at nested keys; the API rejects those keys before persistence. The removed `memory` value
is not accepted, persisted, or converted into conversational-memory records.

The source content is loaded as follows in [file-url-knowledge-source-content-loader.ts](../apps/core/src/infrastructure/knowledge/file-url-knowledge-source-content-loader.ts):

- If `metadata.inlineText` exists, it is used directly.
- For `format: media`, `metadata.description` is used. If absent, the content becomes `Media reference: <uriOrPath>`.
- For HTTP(S) sources, text is fetched over HTTP(S).
- For local text/Markdown/PDF sources, the path must be under a configured allowed root.
- PDFs are converted to text with `pdf-parse`.
- Loaded content is limited to 10 MiB by default.

Registering a source creates an ingestion job and schedules ingestion by default. The separate `POST /v1/knowledge-sources/{sourceId}/ingest` route also creates a queued job and schedules it asynchronously. See [register-knowledge-source.use-case.ts](../apps/core/src/application/use-cases/register-knowledge-source/register-knowledge-source.use-case.ts#L43-L78) and [trigger-ingestion.use-case.ts](../apps/core/src/application/use-cases/trigger-ingestion/trigger-ingestion.use-case.ts#L15-L54).

The job lifecycle is:

```text
queued -> running -> completed
                    or failed
```

Only sources with `status: ready` are considered by runtime retrieval. A source that is still `pending` or has `error` status is excluded in [typed-retrieval.service.ts](../apps/core/src/application/services/knowledge/typed-retrieval.service.ts#L71-L81).

## 2. How chunks are created

The chunking implementation is in [knowledge-ingestion.service.ts](../apps/core/src/application/services/knowledge/knowledge-ingestion.service.ts#L269-L450).

### Text, Markdown, and PDF text

The loader returns text. The ingestion service then:

1. trims the complete document;
2. parses it into paragraphs separated by blank lines;
3. tracks Markdown headings from levels 1 through 6;
4. keeps the active heading path with the paragraph;
5. packs consecutive paragraphs into one chunk while the combined string is at most the configured chunk size;
6. assigns a zero-based `chunkIndex`.

The default chunk size is **1,500 characters**. The API permits a per-ingestion `chunkSize` from **100 to 10,000** characters. These values are defined in [knowledge-contract-types.ts](../packages/shared/src/knowledge-contract-types.ts#L17-L19) and validated in [knowledge.ts](../apps/core/src/api/routes/knowledge.ts#L145-L156).

The implementation has these exact behaviors:

- There is no overlap between adjacent chunks.
- Paragraphs are not split. If one paragraph is longer than the limit, it remains one chunk.
- Markdown headings are included in the chunk text, so the heading context is embedded and retrieved with the paragraph.
- Code fences are kept together while paragraphs are parsed.
- An empty source creates one fallback chunk containing `Reference source: <uriOrPath>`.

Each text chunk's metadata contains:

- `sourceFormat`;
- `knowledgeType`;
- descriptive loader metadata, excluding `inlineText`;
- `ingestionJobId`.

The source's `visibleToAvatarIds` are copied to each new chunk.

### Media

A media source produces exactly one chunk. Its content is:

- `metadata.description`, when present; otherwise
- `Media reference: <uriOrPath>`.

The chunk metadata also contains `mediaUri: <uriOrPath>`. The current implementation therefore retrieves media descriptions/references; it does not create a deep multimodal embedding.

## 3. How the deterministic test chunk vector is computed

Tests may explicitly inject [HashEmbeddingAdapter](../apps/core/src/infrastructure/knowledge/test-support/hash-embedding.adapter.ts) with a supplied `EmbeddingProfile`. It is not a production default or server fallback. Production uses [OpenAiEmbeddingAdapter](../apps/core/src/infrastructure/knowledge/openai-embedding.adapter.ts), which requires `OPENAI_API_KEY` and validates its configured model/dimension pair before startup.

Despite its name, this is not a cryptographic hash and it is not a model-generated semantic embedding. It is a deterministic character-code accumulator.

For each input string and a dimension count `D`:

```text
values = [0, 0, ..., 0]       // D values

for each JavaScript character at position i:
    code = input.charCodeAt(i)
    bucket = i modulo D
    values[bucket] += code

norm = sqrt(sum(values[bucket] squared))
                         // norm becomes 1 if the computed norm is zero

vector[bucket] = round(values[bucket] / norm, 6 decimal places)
```

The deterministic test profile currently supplies `D = 16`. In ingestion, the adapter receives the final chunk text only:

```ts
embeddingAdapter.embed({ inputs: chunkSeeds.map((chunk) => chunk.content) })
```

Therefore:

- one vector is generated per chunk;
- the vector is generated from chunk content, including any copied Markdown headings;
- chunk metadata is not included in the vector input;
- source type, visibility, and IDs are not embedded;
- the vector is L2-normalized and rounded to six decimal places.

The database schema still stores the value as `VECTOR(16)` in [infra/postgres/init.sql](../infra/postgres/init.sql#L74-L84). The ingestion test verifies that the explicitly injected deterministic test profile produces vectors of length 16 in [knowledge-ingestion.service.test.ts](../apps/core/src/application/services/knowledge/knowledge-ingestion.service.test.ts#L111-L120).

## 4. How runtime query text is built

The system builds one or more normalized text query variants and embeds them through
`KnowledgeQueryEmbeddingService` before vector retrieval.

### Avatar query inputs

For an Avatar turn, [send-message.use-case.ts](../apps/core/src/application/use-cases/send-message/send-message.use-case.ts#L357-L389) builds query variants from:

| Query source         | Actual input                                             |
| -------------------- | -------------------------------------------------------- |
| `gm_guideline`       | Pending GM director notes, otherwise session GM notes    |
| `gm_retrieval_query` | Queries from the pending GM retrieval plan               |
| `gm_required_fact`   | Required facts from the pending GM retrieval plan        |
| `last_user_input`    | The current user message                                 |
| `working_memory`     | Working-memory summary plus recent user/Avatar exchanges |

The builder is [typed-retrieval-query-builder.ts](../apps/core/src/application/services/knowledge/typed-retrieval-query-builder.ts#L6-L32).

Planned GM retrieval queries and required facts are used only when `shouldUsePlannedRetrieval` returns true. The current heuristic disables planned retrieval when the user text contains one of:

- `instead`
- `different topic`
- `change the subject`
- `parlons de`
- `parle-moi de`

It also disables planned retrieval for an emotion-related message matching `feel`, `feeling`, `feelings`, `emotion`, `émotion`, `ressens`, or `sentir`, unless an earlier rule enables it. Otherwise it enables planned retrieval when a meaningful user token overlaps a planned token or when the message looks like an explicit continuation (`and`, `also`, `still`, `then`, `next`, `more about`, `tell me more`, `what about`, or `how about`).

Empty query variants are removed, and duplicate query text is removed case-insensitively. The final trace/query string joins the variants with `|`.

### Game Master query inputs

The post-turn GM path builds queries from:

- the scenario description/world-context text;
- the selected working-memory summary;
- up to three recent user/Avatar exchanges.

This is implemented in [run-game-master.context.ts](../apps/core/src/application/use-cases/run-game-master/run-game-master.context.ts#L164-L197) and [typed-retrieval-query-builder.ts](../apps/core/src/application/services/knowledge/typed-retrieval-query-builder.ts#L92-L106).

The GM calls retrieval with `bypassVisibilityFilter: true`, so it can inspect knowledge hidden from an Avatar.

### Direct/admin query

The admin retrieval endpoint accepts an explicit `scenarioId` and `query`, plus optional active-avatar and per-type limit fields. It has no user, session, or conversation scope inputs. The use case bypasses visibility automatically when `activeAvatarId` is absent. See [get-typed-retrieval.use-case.ts](../apps/core/src/application/use-cases/get-typed-retrieval/get-typed-retrieval.use-case.ts#L11-L33).

## 5. Which chunks are considered

The service runs the same process separately for each type: `avatar_knowledge`, `world`, and `media`. It does not mix the source types before filtering. The top-level implementation is [typed-retrieval.service.ts](../apps/core/src/application/services/knowledge/typed-retrieval.service.ts#L36-L69).

For one type, the process is:

1. List sources for the requested scenario, requested `knowledgeType`, and `status: ready`.
2. List all chunks for those source IDs.
3. Apply visibility filtering.
4. Apply active-corpus and embedding identity checks.
5. Apply Avatar visibility, unless the explicit Game Master bypass is active.
6. Embed normalized query variants once and search bounded candidate pools.
7. Merge, deduplicate, and rank by normalized similarity deterministically.
8. Select up to the per-type limit.

The PostgreSQL implementation performs vector ordering with the pgvector cosine-distance operator
and applies current source, corpus, profile, readiness, type, and visibility constraints in SQL.
See [postgres-knowledge-chunk.repository.ts](../apps/core/src/infrastructure/db/repositories/postgres-knowledge-chunk.repository.ts).

### Visibility filtering

The effective visibility is taken from the source policy and the chunk/source avatar IDs:

- `all`: visible;
- `avatars`: visible only when `activeAvatarId` is present in `visibleToAvatarIds`;
- `none`: hidden from Avatar retrieval;
- no explicit policy with avatar IDs: the IDs are treated as an avatar-scoped policy;
- `bypassVisibilityFilter: true`: visible regardless of policy.

The implementation is in [knowledge-visibility.ts](../apps/core/src/domain/knowledge/knowledge-visibility.ts#L67-L86). The retrieval trace reports `consideredChunkCount`, `excludedChunkCount`, and `activeAvatarId`.

### Static scope and metadata invariant

Static retrieval is shared by scenario and canonical knowledge type. It does not accept, match, or
score by `userId`, `sessionId`, or `conversationId`. New and updated source/chunk metadata rejects
those reserved keys recursively. Existing legacy rows are outside the fresh content contract and
are not silently relabeled. Conversational text can form the query, but conversational memory
repositories remain a separate lifecycle.

## 6. How a chunk is ranked

The live ranking is in [typed-retrieval.service.ts](../apps/core/src/application/services/knowledge/typed-retrieval.service.ts#L222-L241).
The repository returns cosine-distance candidates; the application derives normalized
`similarity = 1 - distance`, where higher values are better. Public and recorded retrieval
references expose only `similarity`; raw distance remains an infrastructure value.

### Vector similarity

Static retrieval has no user/session/conversation metadata boosts. Metadata is descriptive static
source information only and cannot establish private retrieval scope. Presenters clamp and round
similarity only at the public boundary.

### Ties and duplicate chunks

Before selection, entries are sorted by:

1. descending similarity;
2. query variant order;
3. source ID;
4. chunk index.

The selector removes duplicate chunk IDs. It first tries to preserve results from `last_user_input`, `gm_retrieval_query`, and `gm_required_fact`. Their default minimums are 3, 1, and 1 respectively, subject to the limit and available matches. It then fills remaining slots by similarity. See [retrieval-selection.ts](../apps/core/src/domain/knowledge/retrieval-selection.ts#L23-L89).

The retrieval service applies that selector once per knowledge type, with no custom minimum options. The later Avatar context assembly applies it again to the combined `avatar_knowledge + world` results and passes the Avatar retrieval options, including `maxChunks` and `minimumChunksBySource`. This second selection is in [context-engine.service.ts](../apps/core/src/domain/context/context-engine.service.ts#L305-L327).

## 7. Limits and final prompt use

The limits differ by path:

- `TypedRetrievalService` default: 3 chunks per type.
- Avatar runtime call: normally 7 per type (`AVATAR_RETRIEVAL_DEFAULT_MAX_CHUNKS`), or the session's configured `maxChunks`.
- Avatar maximum configured value: 9.
- GM runtime call: 3 per type.
- Admin retrieval endpoint: caller can request 1–20 per type.

The Avatar context engine then combines `avatar_knowledge` and `world`, applies the Avatar limit/minimum options, and sends the selected content into the Avatar retrieved-context sections. Media is kept in its own section. See [context-engine.service.ts](../apps/core/src/domain/context/context-engine.service.ts#L305-L327) and [persona-prompt.service.ts](../apps/core/src/domain/avatar/persona-prompt.service.ts#L225-L243).

The context engine also applies the configured context token budget and precedence rules. Therefore, a chunk can be returned by retrieval but omitted from the final Avatar prompt if the context-engine budget/selection does not keep it. The turn trace exposes selected, included, and omitted retrieval counts through [send-message.context-selection.ts](../apps/core/src/application/use-cases/send-message/send-message.context-selection.ts#L3-L57).

## 8. When retrieval is checked

### During an Avatar message

Retrieval is checked while building the Avatar prompt, before the Avatar LLM call, for every normal user message when the typed retrieval service is wired and the generated query is non-empty. The retrieval latency is recorded in the turn data.

If retrieval throws, the send-message path logs the failure and continues without retrieved knowledge. If a consumed GM retrieval plan marked retrieval as required and retrieval failed or returned no knowledge, the Avatar prompt receives `insufficient_evidence` retrieval status. See [send-message.use-case.ts](../apps/core/src/application/use-cases/send-message/send-message.use-case.ts#L371-L401).

### After an Avatar message

After the Avatar response is produced, `schedulePostTurnWork` dispatches the Game Master asynchronously. The GM performs its own retrieval while preparing its post-turn context. This work does not delay the Avatar response. See [send-message.use-case.ts](../apps/core/src/application/use-cases/send-message/send-message.use-case.ts#L308-L320) and [send-message.use-case.ts](../apps/core/src/application/use-cases/send-message/send-message.use-case.ts#L523-L570).

### Explicit diagnostics

The admin retrieval route performs retrieval immediately for the submitted query. Its response includes typed results and trace data: query variants, source IDs, selected chunk IDs, and visibility counts.

Operator displays use the same shared DTOs and explicit labels: Shared Avatar Knowledge, Shared
World Knowledge, and Media Knowledge. Source cards show scenario ownership and Avatar visibility;
GM-only visibility is not user access control. Console event readers consume only current structured
section payloads; current diagnostics never emit a static `memory` bucket or scope-match label.

The final proof also asserts that identical scenario/query/Avatar visibility inputs produce the
same static candidates for different callers, while conversational working, episodic, and
long-term fact projections remain user-scoped and non-vectorized. See
[EPIC_4_2D_REQUIREMENTS_MATRIX.md](EPIC_4_2D_REQUIREMENTS_MATRIX.md).

## 9. Current vector infrastructure boundaries

The following pieces exist:

- `IEmbeddingAdapter.embed({ inputs })` with ordered batch/result metadata;
- `KnowledgeQueryEmbeddingService` for profile-aware ordered runtime query vectorization;
- the explicitly injected deterministic test `HashEmbeddingAdapter`;
- the production OpenAI adapter with bounded batching, ordering, response validation, typed failure
  translation, and safe profile/usage/batch observability;
- `embedding` on the domain chunk type;
- `knowledge_chunks.embedding VECTOR(16)` in PostgreSQL;
- an IVFFlat index using `vector_cosine_ops`;
- `IKnowledgeChunkRepository.searchByVector` with active-corpus, readiness, scope, and explicit
  avatar/GM visibility filtering;
- a PostgreSQL `ORDER BY` using the pgvector cosine-distance operator.

The application owns query normalization, embedding orchestration, multi-query candidate merging,
deduplication, balanced selection, and public similarity mapping. The repository owns vector
ordering and SQL eligibility. Raw vectors and raw cosine distance remain internal.

## 10. Operational notes

### Profile and dimension

The database is still fixed at `VECTOR(16)`. The default OpenAI profile requests that dimension via
the provider's supported shortening parameter, while the adapter has no hard-coded storage
assumption. Embedding profile identity is persisted and enforced across ingestion and query time. A
dimension or profile change requires a matching canonical schema revision and staged
reindex.

### Source replacement

Source replacement validates the complete staged vector set and promotes it transactionally; partial
or stale profile/generation results do not become active.

### Chunking

The configured chunk size is a target for packed paragraphs, while a single oversized paragraph is
kept intact according to the current ingestion contract.

### Diagnostics

Turn events and session inspection record bounded profile, timing, candidate, selection, visibility,
and failure diagnostics. Public and recorded references expose normalized similarity only; vectors,
provider payloads, and raw query text remain excluded.
