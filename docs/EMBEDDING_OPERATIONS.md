# Embedding operations

## Current production profile

Set via environment, independent from `LLM_PROVIDER`/Avatar/GM/memory/scenario chat-model selection:

- `EMBEDDING_PROVIDER=openai`
- `EMBEDDING_MODEL=text-embedding-3-small`
- `EMBEDDING_DIMENSIONS=1536` — the model's native profile; must match the deployed `VECTOR(1536)`
  column with cosine index.
- `EMBEDDING_BATCH_SIZE=100` — safe request batch size; the adapter still enforces the provider's
  own limit underneath.
- `OPENAI_API_KEY` — required and non-empty.

On startup, Core automatically creates and promotes an empty active corpus when the database has no
active corpus yet. This makes the first Admin UI ingestion work without a manual bootstrap request.
An existing active corpus is never replaced automatically; use the reindex operation below for a
profile change or an explicit full rebuild.

Defaults live in `apps/core/src/config.ts` (`DEFAULT_EMBEDDING_*`); see `.env.example` for the
canonical variable names.

An unsupported provider, missing credential, or incompatible model/dimension pair fails fast at
startup/adapter construction — not silently. The configured dimension must also match the deployed
`VECTOR(1536)` before ingestion or retrieval; the corpus repository rejects a mismatched profile
rather than mixing vector spaces. `text-embedding-3-small` supports up to 1536 output dimensions;
the application rejects dimensions beyond the configured model's supported maximum. There is no
hash-vector fallback in production; the deterministic hash adapter is an explicit test double only.

### Retrieval-quality measurement

The six-fixture retrieval harness measured the historical 16-dimensional profile against the native
1536-dimensional profile using the same labelled queries and `TypedRetrievalService` path:

| Profile                  | Recall@3 | Recall@7 | Recall@9 |      MRR |
| ------------------------ | -------: | -------: | -------: | -------: |
| Historical 16 dimensions | 1.000000 | 1.000000 | 1.000000 | 0.722222 |
| Current 1536 dimensions  | 1.000000 | 1.000000 | 1.000000 | 0.916667 |

Recall was already saturated on this small fixture set, while MRR improved by 0.194445. The native
profile was selected because it preserves the model's full semantic resolution; the measured gain is
supporting evidence, not a claim that this six-query sample represents every production workload.
The committed reports are `apps/core/src/tools/retrieval-quality/baseline-before.json` (historical),
`baseline-after-1536.json` (current), and the hand-reviewed `baseline-comparison.md`.

## Changing a profile

A provider/model/dimension change creates a new, incompatible vector space. **Do not** just change
the environment variable and let ingestion continue against the existing corpus — old vectors and
new vectors are not comparable. For this 16-to-1536 migration, wipe and recreate the database from
the canonical PostgreSQL schema before starting the application; the `VECTOR(1536)` column type and
its `vector_cosine_ops` index must be created together.

Rollout sequence:

1. Recreate the database from `infra/postgres/init.sql` and deploy the compatible target environment
   configuration together. Existing 16-dimensional data is intentionally discarded for this migration.
2. Start `POST /v1/admin/knowledge/reindex` with the operator API key and `{}`. This starts a
   replacement generation even when the configured profile is already active; unchanged chunks
   are reused in that same-profile run.
3. Poll `GET /v1/admin/knowledge/reindex/{reindexOperationId}` until `completed` or `failed`.
4. On failure, inspect the failed source IDs and bounded failure codes, fix the underlying source
   or provider condition, and retry with
   `POST /v1/admin/knowledge/reindex/{reindexOperationId}/retry` — do not restart from scratch.
5. Do not promote a profile manually. Promotion happens automatically, and only once every
   snapshotted source has staged fully compatible vectors; the database transaction then flips the
   active generation atomically.

### Incremental reindex behavior

Each persisted chunk stores a SHA-256 hash of its final text, including heading context and without
overlap.
During a reindex targeting the currently active profile, Core re-chunks every source but only sends
changed `(sourceId, chunkIndex, contentHash)` entries to the embedding provider. Matching active
chunks with finite, profile-sized vectors are copied into the staged generation and written with the
new generation/profile identity, so corpus validation remains unchanged. A changed chunk, a shifted
chunk index, a missing/invalid old vector, or any profile/model/dimension change forces a fresh embed.
The ordinary per-source ingestion path remains a full embed operation; this optimization is scoped to
the multi-source reindex flow.

Operational guarantees worth relying on:

- The previous active generation stays readable while the new one is staging — reindexing is not a
  read outage.
- Repeated `reindex` starts while the same target profile/source snapshot is still pending or
  running reuse the existing operation instead of duplicating work. A completed same-profile start
  creates a new replacement generation.
- Concurrent workers are serialized by a database claim transition, so you can retry/kick the
  operation from multiple places without racing yourself.
- On process restart, orphaned `running` operations are marked `interrupted` and are resumable
  through the same retry-safe workflow — you don't need to manually reset state after a crash
  mid-reindex.

## Safety and observability

Reindex status and embedding traces expose only bounded profile identifiers, source/chunk counts,
embedded-versus-reused chunk counts, attempts, timestamps, and failure codes/latency. Source text,
vectors, credentials, and raw provider payloads are never logged or returned.

Query-time vectorization (`KnowledgeQueryEmbeddingService`) trims, filters, and stably deduplicates
query variants, sends one ordered batch through the embedding adapter, and validates the active
profile and a complete finite result before returning profile/generation-tagged vectors — a partial
or invalid batch fails closed rather than returning partial vectors. This service only vectorizes
queries; it does not itself perform retrieval or ranking.

Memory and user facts are not vectorized by this lifecycle — only static knowledge chunks are.
