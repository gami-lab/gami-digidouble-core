# Raise Embedding Dimensions Off The 16-Dimension Floor

## Context

This is the headline fix from `docs/RAG_SYSTEM_AUDIT.md`. Production is hard-configured to embed
every chunk and query into **16 floats** (`DEFAULT_EMBEDDING_DIMENSIONS = 16` in
`apps/core/src/config.ts`), and the schema enforces it twice over:
`embedding_profiles.dimensions INT NOT NULL CHECK (dimensions = 16)` and
`knowledge_chunks.embedding VECTOR(16)` in `infra/postgres/init.sql`. `OpenAiEmbeddingAdapter`'s
factory (`createEmbeddingAdapter`) additionally refuses to start unless
`config.dimensions === DEFAULT_EMBEDDING_DIMENSIONS`, so this is a deliberate, defended choice, not an
oversight — but 16 dimensions cannot carry meaningful semantic structure for prose. Everything else
this system does well (staged reindex, profile/generation identity checks, transactional promotion)
exists specifically to make a change like this safe. Use it.

## Scope

Implement now:

- raise `DEFAULT_EMBEDDING_DIMENSIONS` to a value informed by the `00` baseline harness and OpenAI's
  own Matryoshka-representation guidance for `text-embedding-3-small` (treat 256 as a practical floor;
  prefer higher — up to the model's native 1536 — unless a measured storage/latency cost from the
  harness argues for staying lower). Record the chosen value and the reasoning, including the
  before/after recall numbers, in the documentation updates below;
- update `infra/postgres/init.sql`: `knowledge_chunks.embedding VECTOR(N)`, the `ivfflat` index
  definition (re-evaluate the `lists` parameter for the new dimension/expected corpus size), and the
  `embedding_profiles.dimensions` constraint (this should no longer hardcode `= 16`; either drop the
  exact-value `CHECK` in favor of the existing application-level profile/dimension identity checks, or
  replace it with a sane bound such as `dimensions > 0 AND dimensions <= 3072`);
- update `OpenAiEmbeddingAdapter`'s config validation and `createEmbeddingAdapter` to allow the new
  default while still rejecting a dimension/model combination the model doesn't support
  (`maxDimensionsForModel` already exists for this);
- run the existing `KnowledgeReindexService` staged-reindex flow end-to-end against the new profile in
  a real (or CI-equivalent) environment: start, process every source, validate, promote;
- confirm the previous (16-dimension) generation remains readable/rollback-safe until the new
  generation is promoted, per the existing corpus-generation contract — do not special-case this
  migration outside that contract.

Out of scope:

- chunking, selection, lexical fallback, or incremental reindexing changes (other slices);
- supporting more than one embedding provider or a runtime-configurable dimension per scenario; this
  stays one global active profile, as today;
- building new reindex UI; use the existing `POST /v1/admin/knowledge/reindex` flow.

## Relevant Docs

- `docs/RAG_SYSTEM_AUDIT.md`
- `docs/EMBEDDING_OPERATIONS.md`
- `docs/RAG_SYSTEM_IMPLEMENTATION.md`
- `docs/DATA_MODEL.md`
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`

## Implementation Guidance

- Start with `apps/core/src/config.ts` (`DEFAULT_EMBEDDING_DIMENSIONS`,
  `DEFAULT_EMBEDDING_MODEL`), `apps/core/src/infrastructure/knowledge/openai-embedding.adapter.ts`
  (`createEmbeddingAdapter`, `validateModelAndDimensions`, `maxDimensionsForModel`), and
  `infra/postgres/init.sql` (`embedding_profiles`, `knowledge_chunks`, the `idx_knowledge_chunks_embedding`
  ivfflat index).
- This repo treats `infra/postgres/init.sql` as the canonical fresh schema (see
  `docs/EMBEDDING_OPERATIONS.md`'s "a dimension change also requires a canonical fresh schema with the
  matching vector type/index") rather than an incremental migration tool — follow that existing
  convention rather than introducing a new migration mechanism.
- `KnowledgeReindexService.run` and `processSource` already implement the exact staged-rebuild
  behavior this migration needs (create profile → snapshot sources → re-embed → validate → promote).
  Do not write a separate one-off script; use the production path so the migration is exercised the
  same way an operator would run it in the future.
- After promotion, re-run the `00` baseline harness against the new profile and record the after
  numbers — that comparison belongs in `07`, but capture the raw run now while the environment is set
  up, so `07` isn't blocked re-deriving it.
- Double-check `MAX_VECTOR_SEARCH_CANDIDATES` and any hardcoded dimension assumptions in
  `postgres-knowledge-chunk.repository.ts` validation (`validateVectorSearchRequest`) for anything
  that implicitly assumed 16.

## Constraints

- Respect `API -> Application -> Domain -> Infrastructure`.
- Do not remove or weaken the existing profile/dimension identity checks
  (`validateEmbeddingResult`, `assertActiveCorpus`, `KnowledgeQueryEmbeddingService`'s
  `validateEmbeddingBatchResult`) — the new dimension must flow through the same validated contract,
  not bypass it.
- No silent fallback to a smaller dimension on provider error; failures must surface exactly as the
  existing `EmbeddingAdapterError`/`KnowledgeIngestionError` codes already define.
- This is a schema-affecting change: coordinate with however this repo currently provisions
  PostgreSQL for review/staging/production before merging, per `docs/COOLIFY_DEPLOYMENT_SPECIFICATION.md`
  if that doc covers schema rollout.

## Deliverables

- Updated default embedding dimension, with the reasoning and measured before/after numbers recorded.
- Updated `infra/postgres/init.sql` schema/index for the new vector size.
- Updated adapter validation allowing the new dimension while still bounding it to what the configured
  model supports.
- A completed staged reindex against the new profile, with the old generation provably still
  addressable until promotion (do not delete/alter it directly).
- Updated `docs/EMBEDDING_OPERATIONS.md` "current production profile" section.

## Mandatory Pre-Implementation Check

Before coding:

1. Read the `00` baseline report to see whether it already suggests a target dimension (e.g. if
   fixtures already fail categorically at 16, that's independent confirmation of the audit's claim).
2. Search for every place `16` or `DEFAULT_EMBEDDING_DIMENSIONS` appears as a literal or derived
   assumption (schema, adapter validation, tests, docs) so none are missed.
3. Confirm how this repo currently provisions/reset its PostgreSQL schema in each environment
   (local dev, CI, staging/production) so the `init.sql` change reaches every environment consistently.

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md` — always required;
- `docs/EMBEDDING_OPERATIONS.md` — update "current production profile" and any dimension-specific
  guidance;
- `docs/RAG_SYSTEM_IMPLEMENTATION.md` and `docs/RAG_SYSTEM_AUDIT.md` — the audit's dimension finding
  should be marked resolved with the new value and measured effect, not silently left describing 16;
- `docs/DATA_MODEL.md` for the schema change;
- `docs/EPICS.md` only with truthful progress.

## Acceptance Criteria

- [ ] `DEFAULT_EMBEDDING_DIMENSIONS` is raised from 16 to the chosen value, with the reasoning and
      measured recall@k/MRR delta recorded in documentation.
- [ ] `infra/postgres/init.sql` reflects the new vector size in both the column type and the ivfflat
      index, and no longer hardcodes `dimensions = 16` as an exact-value constraint.
- [ ] `OpenAiEmbeddingAdapter`/`createEmbeddingAdapter` validate the new dimension against the
      configured model's real maximum instead of a single hardcoded literal.
- [ ] A staged reindex to the new profile completes, validates, and promotes through the existing
      `KnowledgeReindexService` flow, with the previous generation remaining safely superseded (not
      deleted or corrupted) per the existing contract.
- [ ] Query-time and ingestion-time dimension/profile validation still rejects mismatches exactly as
      before (no regression in `validateEmbeddingResult`/`assertActiveCorpus` behavior).
- [ ] `docs/EMBEDDING_OPERATIONS.md`'s "current production profile" section states the new value.
