# Embedding operations

## Current production profile

Set via environment, independent from `LLM_PROVIDER`/Avatar/GM/memory/scenario chat-model selection:

- `EMBEDDING_PROVIDER=openai`
- `EMBEDDING_MODEL=text-embedding-3-small`
- `EMBEDDING_DIMENSIONS=16` — must match the deployed `VECTOR(16)` column with cosine index.
- `EMBEDDING_BATCH_SIZE=100` — safe request batch size; the adapter still enforces the provider's
  own limit underneath.
- `OPENAI_API_KEY` — required and non-empty.

Defaults live in `apps/core/src/config.ts` (`DEFAULT_EMBEDDING_*`); see `.env.example` for the
canonical variable names.

An unsupported provider, missing credential, incompatible model/dimension pair, or a dimension
other than the deployed `VECTOR(16)` fails fast at startup/adapter construction — not silently, and
not at first query time. There is no hash-vector fallback in production; the deterministic hash
adapter is an explicit test double only.

## Changing a profile

A provider/model/dimension change creates a new, incompatible vector space. **Do not** just change
the environment variable and let ingestion continue against the existing corpus — old vectors and
new vectors are not comparable. A dimension change additionally requires a new canonical PostgreSQL
schema revision (the `VECTOR(16)` column type and its `vector_cosine_ops` index must be recreated
to match).

Rollout sequence:

1. Deploy the compatible schema revision and the target environment configuration together.
2. Start `POST /v1/admin/knowledge/reindex` with the operator API key and `{}`.
3. Poll `GET /v1/admin/knowledge/reindex/{reindexOperationId}` until `completed` or `failed`.
4. On failure, inspect the failed source IDs and bounded failure codes, fix the underlying source
   or provider condition, and retry with
   `POST /v1/admin/knowledge/reindex/{reindexOperationId}/retry` — do not restart from scratch.
5. Do not promote a profile manually. Promotion happens automatically, and only once every
   snapshotted source has staged fully compatible vectors; the database transaction then flips the
   active generation atomically.

Operational guarantees worth relying on:

- The previous active generation stays readable while the new one is staging — reindexing is not a
  read outage.
- Repeated `reindex` starts against the same target profile and source snapshot reuse the existing
  operation instead of duplicating work.
- Concurrent workers are serialized by a database claim transition, so you can retry/kick the
  operation from multiple places without racing yourself.
- On process restart, orphaned `running` operations are marked `interrupted` and are resumable
  through the same retry-safe workflow — you don't need to manually reset state after a crash
  mid-reindex.

## Safety and observability

Reindex status and embedding traces expose only bounded profile identifiers, source/chunk counts,
attempts, timestamps, and failure codes/latency. Source text, vectors, credentials, and raw provider
payloads are never logged or returned.

Query-time vectorization (`KnowledgeQueryEmbeddingService`) trims, filters, and stably deduplicates
query variants, sends one ordered batch through the embedding adapter, and validates the active
profile and a complete finite result before returning profile/generation-tagged vectors — a partial
or invalid batch fails closed rather than returning partial vectors. This service only vectorizes
queries; it does not itself perform retrieval or ranking.

Memory and user facts are not vectorized by this lifecycle — only static knowledge chunks are.
