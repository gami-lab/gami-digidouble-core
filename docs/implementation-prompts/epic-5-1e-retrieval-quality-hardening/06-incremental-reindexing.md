# Skip Re-Embedding Unchanged Chunks During Reindex

## Context

`KnowledgeReindexService.processSource` re-loads, re-chunks, and re-embeds **every** chunk of **every**
source on every reindex run, with no check for whether a chunk's content actually changed since the
previously active generation. `docs/RAG_SYSTEM_AUDIT.md` calls this fine at current scale but a real
cost/latency problem as sources grow in number or size, especially now that `02` and `05` may prompt
more frequent reindexes (dimension changes, lexical index backfills) and `01` changes chunk boundaries
for existing sources on their next reindex.

## Scope

Implement now:

- a content hash per chunk (e.g. a stable hash of the final chunk text after chunking, including any
  header/overlap content from `01`) computed during `toChunkSeeds` or immediately after;
- persist that hash alongside each chunk (staged and active), so `processSource` can compare a newly
  produced chunk's hash against the corresponding chunk in the previously active generation for the
  same source;
- when a chunk's hash matches the previous active generation's chunk at the same `sourceId` +
  `chunkIndex`, copy the existing embedding into the new generation instead of calling the embedding
  adapter again for that chunk — the new generation must still end up with a complete, self-contained
  set of vectors under its own `corpusGenerationId`/`embeddingProfileId`, exactly as `validateCorpusGeneration`
  already requires;
- **do not** skip re-embedding when the embedding profile itself changed (e.g. `02`'s dimension
  migration) — unchanged content still needs a new vector under a new profile. Skipping only applies
  to a reindex run targeting the _same already-active_ profile (e.g. picking up `01`'s chunking fix, or
  re-running after a transient failure).

Out of scope:

- incremental re-chunking (detecting which _source_ changed before even re-chunking it) — this slice
  is about skipping the embedding call per unchanged chunk, not skipping content-loading/chunking;
- changing the ingestion (`POST /v1/knowledge-sources/{id}/ingest`) path — this is scoped to
  `KnowledgeReindexService`, which is the multi-source, whole-corpus operation where the cost problem
  actually compounds;
- cross-profile hash reuse (a hash match under one profile never implies validity under a different
  profile).

## Relevant Docs

- `docs/RAG_SYSTEM_AUDIT.md`
- `docs/RAG_SYSTEM_IMPLEMENTATION.md`
- `docs/EMBEDDING_OPERATIONS.md`
- `docs/DATA_MODEL.md`

## Implementation Guidance

- Start with `knowledge-reindex.service.ts`'s `processSource` and
  `IKnowledgeCorpusRepository.replaceStagedSourceChunks`/`listActiveChunksBySourceIds`. The service
  already has access to the active corpus's chunks for a source before staging new ones — that is
  where a hash comparison belongs, not inside `toChunkSeeds`.
- Compute the hash from the final chunk content (what `toChunkSeeds` already returns) using a stable
  hashing function via Node's `crypto` module, already imported elsewhere in this file family (e.g.
  `knowledge-ingestion.service.ts`'s `crypto.randomUUID()`).
- Decide where the hash is persisted: either a new `content_hash` column on `knowledge_chunks`, or a
  deterministic derivation from existing columns if that is cheap enough — a real column is likely
  simpler to reason about and query.
- When copying an unchanged chunk's embedding forward, still write it under the new
  `corpus_generation_id`/`embedding_profile_id` via the existing staged-chunk write path — do not
  special-case "this row didn't change" by leaving it pointing at the old generation, or
  `validateCorpusGeneration`'s completeness check will not see it as part of the new generation.
- Add a test proving: given a source where only one of N chunks' content changed between two reindex
  runs at the same profile, the embedding adapter is called exactly once (for the changed chunk), not
  N times.

## Constraints

- Respect `API -> Application -> Domain -> Infrastructure`.
- Must not weaken `validateCorpusGeneration`'s guarantee that every chunk in a promoted generation has
  a complete, matching-profile vector — a copied-forward embedding must satisfy that check exactly
  like a freshly-computed one.
- No behavior change to the profile-change path (`02`'s migration): a profile change must still
  re-embed everything, with no accidental hash-based skip across profiles.
- KISS: a simple content-hash comparison, not a diffing/patching system.

## Deliverables

- A persisted content hash per chunk, compared against the previously active generation during
  reindex.
- `KnowledgeReindexService.processSource` skips the embedding call for unchanged chunks within the
  same profile, while still producing a complete new generation.
- A test demonstrating the reduced embedding-call count on a partial-change fixture.
- Confirmation (via test) that a profile change still re-embeds every chunk regardless of content hash.

## Mandatory Pre-Implementation Check

Before coding:

1. Confirm the exact chunk-identity key (`sourceId` + `chunkIndex`, or something more stable if `01`'s
   overlap/splitting changes make `chunkIndex` alignment across reindexes unreliable) before designing
   the hash-comparison lookup.
2. Confirm `validateCorpusGeneration`'s exact completeness check (`CorpusValidation` fields:
   `expectedChunkCount`, `actualChunkCount`, `nonNullVectorCount`) to ensure a copied-forward embedding
   satisfies it identically to a freshly computed one.
3. Check whether `replaceStagedSourceChunks` already has any content-addressing behavior this would
   duplicate.

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md` — always required;
- `docs/EMBEDDING_OPERATIONS.md` — describe the incremental-skip behavior so an operator running a
  reindex understands why it may be faster/cheaper than a full re-embed;
- `docs/RAG_SYSTEM_IMPLEMENTATION.md` and `docs/RAG_SYSTEM_AUDIT.md` — mark the incremental-reindexing
  gap resolved;
- `docs/DATA_MODEL.md` for the new hash column/derivation;
- `docs/EPICS.md` only with truthful progress.

## Acceptance Criteria

- [ ] A content hash is computed and persisted per chunk, comparable across reindex runs at the same
      embedding profile.
- [ ] Reindexing a source where only some chunks changed calls the embedding adapter only for the
      changed chunks, verified by a test asserting the call count.
- [ ] A promoted generation produced with skipped re-embeds still passes `validateCorpusGeneration`
      identically to a fully re-embedded one.
- [ ] A profile change (e.g. the `02` dimension migration) still re-embeds every chunk regardless of
      content hash, verified by a test.
- [ ] `docs/EMBEDDING_OPERATIONS.md` describes the incremental-skip behavior for operators.
