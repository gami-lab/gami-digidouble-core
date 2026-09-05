# RAG system: current implementation

This document describes the RAG code that is currently in this repository. It does not describe an ideal or planned RAG system.

## Important conclusion

The current system **generates and stores an embedding for every ingested chunk, but does not use embeddings during retrieval**.

Runtime retrieval currently:

- loads every chunk belonging to the eligible sources;
- filters those chunks by type, visibility, and memory scope;
- scores text with token overlap and a few metadata boosts;
- selects the highest-scoring chunks deterministically.

There is currently no query embedding, no cosine-distance calculation in application code, and no SQL nearest-neighbor query. The `VECTOR(16)` column and the pgvector IVFFlat index exist in the database schema, but the current repository port only exposes `listBySourceIds`, not vector search.

## End-to-end flow

```text
Knowledge source
  -> ingestion job
  -> source content loader
  -> paragraph/header chunking
  -> HashEmbeddingAdapter creates one stored vector per chunk
  -> chunks persisted in PostgreSQL

Avatar turn
  -> build query variants from turn context
  -> find ready sources by scenario and knowledge type
  -> load all chunks for those sources
  -> visibility and memory-scope filtering
  -> lexical token-overlap scoring
  -> deterministic per-type selection
  -> context-engine selection and token-budget filtering
  -> Avatar prompt

Post-turn Game Master run
  -> build GM query variants
  -> repeat the same retrieval service
  -> inject selected chunks into GM context
```

The main implementation files are:

- [knowledge-ingestion.service.ts](../apps/core/src/application/services/knowledge/knowledge-ingestion.service.ts)
- [typed-retrieval-query-builder.ts](../apps/core/src/application/services/knowledge/typed-retrieval-query-builder.ts)
- [typed-retrieval.service.ts](../apps/core/src/application/services/knowledge/typed-retrieval.service.ts)
- [retrieval-selection.ts](../apps/core/src/domain/knowledge/retrieval-selection.ts)
- [hash-embedding.adapter.ts](../apps/core/src/infrastructure/knowledge/hash-embedding.adapter.ts)
- [Postgres knowledge chunk repository](../apps/core/src/infrastructure/db/repositories/postgres-knowledge-chunk.repository.ts)

## 1. Where the knowledge comes from

A knowledge source is registered with:

- `scenarioId`
- `name`
- `knowledgeType`: `memory`, `world`, or `media`
- `format`: `pdf`, `text`, `markdown`, `url`, or `media`
- `uriOrPath`
- optional `metadata`
- optional visibility policy and avatar IDs

The HTTP contract is in [knowledge-contract-types.ts](../packages/shared/src/knowledge-contract-types.ts#L9-L42), and the route validation is in [knowledge.ts](../apps/core/src/api/routes/knowledge.ts#L77-L94).

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

## 3. How the chunk vector is computed

The application wires [HashEmbeddingAdapter](../apps/core/src/infrastructure/knowledge/hash-embedding.adapter.ts) as the default embedding adapter in [index.ts](../apps/core/src/index.ts#L200-L209). The adapter is also the server fallback in [server.ts](../apps/core/src/api/server.ts#L254-L268).

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

The default `D` is **16**. In ingestion, the adapter receives the final chunk text only:

```ts
embeddingAdapter.embed(chunkSeeds.map((chunk) => chunk.content))
```

Therefore:

- one vector is generated per chunk;
- the vector is generated from chunk content, including any copied Markdown headings;
- chunk metadata is not included in the vector input;
- source type, visibility, and IDs are not embedded;
- the vector is L2-normalized and rounded to six decimal places.

The database schema stores the value as `VECTOR(16)` in [infra/postgres/init.sql](../infra/postgres/init.sql#L74-L84). The ingestion test verifies that the default vector has length 16 in [knowledge-ingestion.service.test.ts](../apps/core/src/application/services/knowledge/knowledge-ingestion.service.test.ts#L111-L120).

## 4. How runtime query text is built

The system does not build a vector query. It builds one or more text query variants and passes those strings to the lexical retrieval scorer.

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

The admin retrieval endpoint accepts an explicit `scenarioId` and `query`, plus optional session, user, conversation, active-avatar, and per-type limit fields. The use case bypasses visibility automatically when `activeAvatarId` is absent. See [get-typed-retrieval.use-case.ts](../apps/core/src/application/use-cases/get-typed-retrieval/get-typed-retrieval.use-case.ts#L11-L33).

## 5. Which chunks are considered

The service runs the same process separately for each type: `memory`, `world`, and `media`. It does not mix the source types before filtering. The top-level implementation is [typed-retrieval.service.ts](../apps/core/src/application/services/knowledge/typed-retrieval.service.ts#L36-L69).

For one type, the process is:

1. List sources for the requested scenario, requested `knowledgeType`, and `status: ready`.
2. List all chunks for those source IDs.
3. Apply visibility filtering.
4. Apply additional memory-scope filtering for `memory` chunks.
5. Score every remaining chunk against every query variant.
6. Discard entries with a score of `0`.
7. Sort deterministically.
8. Select up to the per-type limit.

The PostgreSQL implementation currently performs step 2 with a normal `SELECT ... WHERE source_id IN (...) ORDER BY ...`; it does not use `embedding` in the query. See [postgres-knowledge-chunk.repository.ts](../apps/core/src/infrastructure/db/repositories/postgres-knowledge-chunk.repository.ts#L95-L109).

### Visibility filtering

The effective visibility is taken from the source policy and the chunk/source avatar IDs:

- `all`: visible;
- `avatars`: visible only when `activeAvatarId` is present in `visibleToAvatarIds`;
- `none`: hidden from Avatar retrieval;
- no explicit policy with avatar IDs: the IDs are treated as an avatar-scoped policy;
- `bypassVisibilityFilter: true`: visible regardless of policy.

The implementation is in [knowledge-visibility.ts](../apps/core/src/domain/knowledge/knowledge-visibility.ts#L67-L86). The retrieval trace reports `consideredChunkCount`, `excludedChunkCount`, and `activeAvatarId`.

### Memory scope filtering

Only `memory` chunks receive the extra scope check. If a memory chunk has `userId`, `sessionId`, or `conversationId` metadata, any corresponding input value must match it. If a particular key is absent from the chunk metadata, that key does not exclude the chunk. If the chunk has none of those three metadata keys, it remains eligible.

This behavior is in [typed-retrieval.service.ts](../apps/core/src/application/services/knowledge/typed-retrieval.service.ts#L165-L198).

## 6. How a chunk is scored

The live score is in [typed-retrieval.service.ts](../apps/core/src/application/services/knowledge/typed-retrieval.service.ts#L222-L241).

### Base score: token overlap

Both the query and chunk content are tokenized by:

```text
lowercase
split on anything except a-z, 0-9
discard tokens shorter than 2 characters
```

The content tokens are put in a `Set`. The score is:

```text
number of query tokens found in the content-token set
------------------------------------------------------
number of query tokens
```

There is no stemming, synonym expansion, language model, semantic similarity, or vector comparison in this calculation.

### Metadata boosts

After token overlap is greater than zero:

- `memory` adds `0.25` for matching `userId`, `0.15` for matching `sessionId`, and `0.10` for matching `conversationId`.
- `media` adds `0.10` when any query token is also found in the chunk metadata `tags`.
- `world` has no metadata boost.

The returned score is rounded to four decimal places for the retrieval result.

### Ties and duplicate chunks

Before selection, entries are sorted by:

1. descending score;
2. query variant order;
3. source ID;
4. chunk index.

The selector removes duplicate chunk IDs. It first tries to preserve results from `last_user_input`, `gm_retrieval_query`, and `gm_required_fact`. Their default minimums are 3, 1, and 1 respectively, subject to the limit and available matches. It then fills remaining slots by score. See [retrieval-selection.ts](../apps/core/src/domain/knowledge/retrieval-selection.ts#L23-L89).

The retrieval service applies that selector once per knowledge type, with no custom minimum options. The later Avatar context assembly applies it again to the combined `memory + world` results and passes the Avatar retrieval options, including `maxChunks` and `minimumChunksBySource`. This second selection is in [context-engine.service.ts](../apps/core/src/domain/context/context-engine.service.ts#L305-L327).

## 7. Limits and final prompt use

The limits differ by path:

- `TypedRetrievalService` default: 3 chunks per type.
- Avatar runtime call: normally 7 per type (`AVATAR_RETRIEVAL_DEFAULT_MAX_CHUNKS`), or the session's configured `maxChunks`.
- Avatar maximum configured value: 9.
- GM runtime call: 3 per type.
- Admin retrieval endpoint: caller can request 1–20 per type.

The Avatar context engine then combines `memory` and `world`, applies the Avatar limit/minimum options, and sends the selected content into the Avatar retrieved-context sections. Media is kept in its own section. See [context-engine.service.ts](../apps/core/src/domain/context/context-engine.service.ts#L305-L327) and [persona-prompt.service.ts](../apps/core/src/domain/avatar/persona-prompt.service.ts#L225-L243).

The context engine also applies the configured context token budget and precedence rules. Therefore, a chunk can be returned by retrieval but omitted from the final Avatar prompt if the context-engine budget/selection does not keep it. The turn trace exposes selected, included, and omitted retrieval counts through [send-message.context-selection.ts](../apps/core/src/application/use-cases/send-message/send-message.context-selection.ts#L3-L57).

## 8. When retrieval is checked

### During an Avatar message

Retrieval is checked while building the Avatar prompt, before the Avatar LLM call, for every normal user message when the typed retrieval service is wired and the generated query is non-empty. The retrieval latency is recorded in the turn data.

If retrieval throws, the send-message path logs the failure and continues without retrieved knowledge. If a consumed GM retrieval plan marked retrieval as required and retrieval failed or returned no knowledge, the Avatar prompt receives `insufficient_evidence` retrieval status. See [send-message.use-case.ts](../apps/core/src/application/use-cases/send-message/send-message.use-case.ts#L371-L401).

### After an Avatar message

After the Avatar response is produced, `schedulePostTurnWork` dispatches the Game Master asynchronously. The GM performs its own retrieval while preparing its post-turn context. This work does not delay the Avatar response. See [send-message.use-case.ts](../apps/core/src/application/use-cases/send-message/send-message.use-case.ts#L308-L320) and [send-message.use-case.ts](../apps/core/src/application/use-cases/send-message/send-message.use-case.ts#L523-L570).

### Explicit diagnostics

The admin retrieval route performs retrieval immediately for the submitted query. Its response includes typed results and trace data: query variants, source IDs, selected chunk IDs, and visibility counts.

## 9. What the vector infrastructure currently does not do

The following pieces exist:

- `IEmbeddingAdapter.embed(inputs)`;
- the default deterministic `HashEmbeddingAdapter`;
- `embedding` on the domain chunk type;
- `knowledge_chunks.embedding VECTOR(16)` in PostgreSQL;
- an IVFFlat index using `vector_cosine_ops`.

The following pieces do **not** exist in the current retrieval path:

- an embedding generated from the runtime query;
- a repository method such as `nearestNeighbors(queryEmbedding)`;
- a SQL `ORDER BY` using pgvector distance operators;
- application code reading `chunk.embedding` while scoring;
- cosine similarity computation in TypeScript;
- vector-distance trace data.

So, for the specific question “how do we compute the vector to compare?”: currently we do not compute a query vector and there is no vector comparison. Only the stored chunk vector is computed during ingestion, and it is currently unused by retrieval.

## 10. Issues and improvements identified from the code

These are concrete gaps in the current implementation, not claims about behavior that already exists.

### 1. Replace lexical retrieval with actual vector retrieval

The main improvement is to add a query-embedding path and a repository method for pgvector nearest-neighbor search. The query and chunk embeddings must use the same embedding model and dimension. The repository should apply scenario/type/status/visibility scope in SQL and order by cosine distance before returning candidates.

The current `HashEmbeddingAdapter` should be replaced or made explicitly test-only. Its character-position buckets do not represent semantic similarity, so two conceptually similar strings can score poorly and two unrelated strings can collide.

### 2. Make the pgvector dimension a single enforced configuration

The database is fixed at `VECTOR(16)`, while `HashEmbeddingAdapter` accepts a constructor dimension. The production wiring uses the default 16, but a custom adapter dimension could conflict with the database. The embedding model identity and dimension should be persisted/configured together and validated at ingestion and query time.

### 3. Use a transaction for replacing a source's chunks

Ingestion deletes all previous chunks and then inserts the new set. The service attempts to restore the old chunks if an insert fails, but that is application-level compensation rather than one database transaction. Also, `restorePreviousChunks` restores content, index, embedding, and metadata but does not restore the previous `visibleToAvatarIds`. A transaction would remove both failure windows.

### 4. Decide how oversized paragraphs should be handled

The configured chunk size is a maximum for packed paragraphs, but a single paragraph longer than that maximum is kept intact. If long documents are expected, the implementation needs a defined split rule for oversized paragraphs, likely with a tested overlap policy.

### 5. Improve tokenization if lexical fallback remains

The live scorer splits on ASCII `a-z0-9`. The query-planning helper accepts accented Latin characters, but the scorer itself does not preserve them as normal tokens. Multilingual retrieval will therefore need better normalization/tokenization even if vector search is added as the primary path.

### 6. Measure vector retrieval separately from lexical retrieval

The current turn data records retrieval latency and retrieval traces, but the trace does not identify an embedding model, query vector, distance, or candidate count from a vector index. Once vector retrieval is implemented, those fields should be added so retrieval quality and cost can be evaluated from recorded turns.
