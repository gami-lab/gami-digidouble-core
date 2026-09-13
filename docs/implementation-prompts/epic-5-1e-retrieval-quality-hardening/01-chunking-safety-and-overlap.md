# Cap Oversized Paragraphs And Add Chunk Overlap

## Context

`toChunkSeeds` in `knowledge-ingestion.service.ts` packs consecutive paragraphs up to a target
`chunkSize` but never splits a single paragraph larger than that target — a PDF or pasted source with
no blank lines can produce one arbitrarily large chunk. That risks an ingestion failure once the
chunk's token count exceeds the embedding model's input limit, and it quietly defeats the whole point
of a chunk-size setting. Separately, adjacent chunks share zero content overlap, so a fact split across
a chunk boundary can lose the context needed to disambiguate it. `docs/RAG_SYSTEM_AUDIT.md` calls the
first a P0 correctness gap and the second a P1 quality gap; both live in the same function, so this
slice fixes them together rather than touching `toChunkSeeds` twice.

## Scope

Implement now:

- a hard maximum chunk length, independent of the existing `chunkSize` target, applied to any single
  paragraph (or code fence) that would otherwise exceed it; split such a paragraph deterministically
  (e.g. on sentence boundaries first, falling back to a raw character cut) rather than failing
  ingestion or silently truncating content;
- a configurable overlap between adjacent chunks of the same source: the end of chunk N is repeated
  at the start of chunk N+1, bounded by a fixed size or percentage of `chunkSize`;
- chunk index and metadata semantics stay correct when a paragraph is split or overlap is inserted
  (no duplicate `chunkIndex`, no double-counted content in whatever downstream token-estimate/length
  accounting exists);
- update `INGESTION_CHUNK_SIZE_DEFAULT`/related shared constants and the ingestion contract docs if a
  new "hard max" or "overlap" configuration knob is added to the public ingestion contract.

Out of scope:

- embedding dimension, vector search, or selection changes (later slices);
- semantic/LLM-assisted chunking; this stays a deterministic, local transformation;
- re-ingesting existing production sources — that happens naturally via `02`'s staged reindex, which
  calls `toChunkSeeds` again.

## Relevant Docs

- `docs/RAG_SYSTEM_AUDIT.md`
- `docs/RAG_SYSTEM_IMPLEMENTATION.md`
- `docs/DATA_MODEL.md`
- `docs/API_CONTRACT.md`
- `docs/TEST_COVERAGE_PLAN.md`

## Implementation Guidance

- Start in `apps/core/src/application/services/knowledge/knowledge-ingestion.service.ts`, specifically
  `toChunkSeeds`, `parseParagraphsWithHeaders`, and the pack/flush loop.
  `knowledge-reindex.service.ts` calls the same `toChunkSeeds` function — verify the fix applies there
  too without a separate change.
- Choose the hard maximum conservatively relative to the embedding model's real input limit (leave
  headroom; do not target the limit exactly), and make it a named constant next to
  `INGESTION_CHUNK_SIZE_DEFAULT` in `packages/shared/src/knowledge-contract-types.ts`.
- For the sentence-boundary split, a simple regex-based sentence splitter is sufficient; do not pull
  in a new NLP dependency for this. Preserve any active Markdown heading path on every split piece,
  the same way `headersToAdd` already does for normal paragraph packing.
- For overlap, decide once whether it applies only to paragraph-packed text chunks or also to the
  split pieces of an oversized paragraph, and document the choice — consistency matters more than
  which choice, since retrieval treats every chunk uniformly.
- Update `knowledge-ingestion.service.test.ts` (and any reindex-service test that shares fixtures) with
  cases for: a single paragraph far larger than `chunkSize`, a paragraph containing an unbroken code
  fence larger than `chunkSize` (decide and document whether code fences are ever split — likely not,
  to avoid producing invalid code), and adjacent chunks whose overlap is verifiable by construction.

## Constraints

- Respect `API -> Application -> Domain -> Infrastructure`; this stays Application-layer logic.
- KISS, YAGNI, DRY — one splitting/overlap implementation, not a parallel path for the "normal" vs.
  "oversized" case.
- Do not change `IEmbeddingAdapter`, `IKnowledgeChunkRepository`, or any vector-search contract in this
  slice.
- Preserve existing chunk metadata fields (`sourceFormat`, `knowledgeType`, `ingestionJobId`, etc.);
  add new fields only if genuinely needed to express split/overlap provenance.

## Deliverables

- `toChunkSeeds` (and any shared helper it uses) enforces a hard per-chunk maximum regardless of
  paragraph structure.
- Adjacent chunks from the same source carry a bounded, deterministic content overlap.
- Updated ingestion/reindex tests covering both behaviors.
- Updated `docs/DATA_MODEL.md`/`docs/API_CONTRACT.md` if new ingestion configuration fields are added.

## Mandatory Pre-Implementation Check

Before coding:

1. Confirm every caller of `toChunkSeeds` (ingestion service, reindex service, and their tests) so the
   fix is applied once and used everywhere, not duplicated.
2. Check whether `chunkSize`'s existing 100–10,000 validation range in `knowledge.ts`
   (`apps/core/src/api/routes/knowledge.ts`) needs to change alongside a new hard-max constant.
3. Confirm there is no existing (even partial) truncation/splitting logic elsewhere in the ingestion
   path that this would duplicate.

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md` — always required;
- `docs/RAG_SYSTEM_IMPLEMENTATION.md` to describe the new hard-cap and overlap behavior accurately
  (its current "no overlap" / "paragraphs are never split" statements become false after this slice);
- `docs/DATA_MODEL.md` and `docs/API_CONTRACT.md` if ingestion configuration contracts change;
- `docs/EPICS.md` only with truthful progress.

## Acceptance Criteria

- [ ] No input can produce a chunk exceeding the documented hard maximum, regardless of paragraph or
      code-fence structure.
- [ ] Ingestion of a source with one very large, blank-line-free paragraph succeeds and produces more
      than one properly-indexed chunk.
- [ ] Adjacent chunks from the same source share a bounded, deterministic overlap, verified by tests.
- [ ] `chunkIndex` remains a correct, gapless, zero-based sequence per source after splitting/overlap.
- [ ] `knowledge-ingestion.service.ts` and `knowledge-reindex.service.ts` share the same fixed
      behavior (no divergent copies).
- [ ] `docs/RAG_SYSTEM_IMPLEMENTATION.md` no longer claims paragraphs are never split or chunks never
      overlap.
