# Embedding operations

## Current production profile

- Provider: OpenAI
- Model: `text-embedding-3-small`
- Dimensions: `16` (`VECTOR(16)` with cosine index)
- Batch size: configured independently from chat models
- Credential: `OPENAI_API_KEY`

The profile is independent from Avatar, GM, memory, and scenario chat-model selection. Test hash
embeddings are explicit test doubles only; there is no silent production fallback.

## Changing a profile

A provider/model/dimension change creates a new vector space. Do not change environment variables
and ingest into the existing corpus. A dimension change also requires a canonical fresh schema with
the matching vector type/index.

1. Deploy the compatible schema and target configuration.
2. Start `POST /v1/admin/knowledge/reindex` with `{}`.
3. Poll `GET /v1/admin/knowledge/reindex/{id}`.
4. Fix failed sources and retry with `POST .../{id}/retry`.
5. Let the service promote only after every snapshotted source has complete compatible vectors.

The previous active generation stays readable while staging. Repeated starts reuse the same source
snapshot; database claims serialize workers; interrupted work is retryable after restart.

## Safety

Reindex status and traces expose bounded profile/count/timing/failure metadata only. Source text,
vectors, credentials, and provider payloads are never logged or returned. Query vectorization uses
the same active profile and ordered-batch validation before repository search.
