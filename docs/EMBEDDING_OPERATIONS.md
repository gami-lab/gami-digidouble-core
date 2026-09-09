# Embedding Operations

## Supported production profile

Production currently supports the OpenAI embedding adapter with this fixed profile:

- `EMBEDDING_PROVIDER=openai`
- `EMBEDDING_MODEL=text-embedding-3-small`
- `EMBEDDING_DIMENSIONS=16`
- `EMBEDDING_BATCH_SIZE=100` (safe request batch size; the adapter enforces the provider limit)
- `OPENAI_API_KEY` must be present and non-empty

Embedding settings are independent from `LLM_PROVIDER`, Avatar, Game Master, memory, and scenario
chat-model selection. Unsupported providers, missing credentials, incompatible model/dimension
pairs, and dimensions other than the deployed `VECTOR(16)` fail startup or adapter construction;
there is no production hash-vector fallback.

## Profile changes

Changing provider, model, or dimensions changes the vector space. Do not change only the
environment variable and begin ingestion. A dimension change also requires a PostgreSQL migration
that changes `knowledge_chunks.embedding` and recreates its `vector_cosine_ops` index.

After deploying a compatible target profile:

1. Confirm the target environment variables and `OPENAI_API_KEY`.
2. Start `POST /v1/admin/knowledge/reindex` with the operator API key and an empty JSON object.
3. Poll `GET /v1/admin/knowledge/reindex/{reindexOperationId}` until `completed` or `failed`.
4. Inspect failed source IDs and bounded failure codes. Retry with
   `POST /v1/admin/knowledge/reindex/{reindexOperationId}/retry` after correcting the source or
   provider condition.
5. Promote no profile manually. Promotion occurs only after every snapshotted source has staged
   compatible vectors and the database transaction switches the active generation.

The previous active generation remains readable while staging. Repeated starts for the same target
and source snapshot reuse the existing operation. Concurrent workers are serialized by the database
claim transition. On process restart, orphaned `running` operations are marked interrupted and
resumed through the same retry-safe workflow.

## Safety and observability

Operation status exposes profile identifiers, source/chunk counts, attempts, timestamps, and
bounded failure details. Embedding traces record safe provider/model/dimension identifiers,
batch/input counts, usage when supplied, latency, outcome, and bounded failure code. Source text,
vectors, credentials, and raw provider payloads are not emitted.

Embedding query vectorization is owned by `KnowledgeQueryEmbeddingService` for EPIC 5.1d. Its
variant operation trims, filters, and stably deduplicates all configured query sources, sends one
ordered batch through `IEmbeddingAdapter`, validates the active profile and complete finite result,
and returns profile/generation-tagged query vectors only when the batch is valid. Failures return a
controlled retrieval outcome with no partial vectors. Safe diagnostics include profile, query-vector
count, and measured embedding latency; raw text, vectors, and provider payloads are not logged.
The service does not perform retrieval.

Memory and user facts are not vectorized by this lifecycle.
