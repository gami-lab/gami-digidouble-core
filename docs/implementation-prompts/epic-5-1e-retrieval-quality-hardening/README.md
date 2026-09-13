# EPIC 5.1e — Retrieval Quality Hardening

## Objective

Fix the concrete correctness, fidelity, and dead-code gaps identified in
[`docs/RAG_SYSTEM_AUDIT.md`](../../RAG_SYSTEM_AUDIT.md) without re-litigating the architecture that
audit confirmed is sound (profile/generation versioning, staged reindex, SQL-pushed visibility,
bounded observability). The audit's headline finding is that production embeddings are truncated to
16 dimensions, which likely destroys most of the semantic signal the rest of the pipeline is built to
rank; this EPIC raises that fidelity, closes an ingestion correctness gap, removes duplicated/dead
retrieval code, and adds the minimum measurement harness needed to prove any of it actually helped.

## Generated

2026-09-13

## Prerequisite

Complete EPICs 5.1c (real embedding infrastructure and reindexing), 5.1d (real vector retrieval
runtime), and 4.2d/10.1 (shared RAG scope and legacy removal) first. This pack relies on their
provider-neutral embedding port, active embedding profile/corpus-generation model, staged reindex
service, pgvector repository, and canonical retrieval contracts. Do not recreate those capabilities
locally; extend them.

Read [`docs/RAG_SYSTEM_AUDIT.md`](../../RAG_SYSTEM_AUDIT.md) before starting any slice — it is the
source of truth for _why_ each slice exists, with exact file/line references into the current
implementation.

## Dependencies Between Prompts

- `00-retrieval-quality-baseline-harness.md` is first and depends on nothing new. It must run and
  record a **before** result against the current (16-dimension) production profile so later slices
  can be judged by a number, not by inspection.
- `01-chunking-safety-and-overlap.md` depends only on `00` existing (so its ingestion-shape changes
  can be measured later); it does not depend on `00`'s result.
- `02-embedding-dimension-migration.md` depends on `01` being merged first: the staged reindex this
  slice triggers re-chunks every source from scratch, so it should pick up `01`'s corrected chunking
  in the same pass rather than requiring a second full reindex.
- `03-single-authoritative-retrieval-selection.md` and `04-retrieval-contract-and-dead-code-cleanup.md`
  depend on `02` only in the sense that they should land on the corrected corpus; they do not touch
  embedding or chunking code and may be implemented in parallel with each other.
- `05-lexical-hybrid-fallback.md` depends on `02` (the canonical vector repository/contract it fuses
  results with must already reflect the new dimension) and on `04` (it must not resurrect the
  candidate/exclusion contract cleanup that slice performs).
- `06-incremental-reindexing.md` depends on `02` (it changes the same `KnowledgeReindexService`
  code path the dimension migration exercises) and should land after `02` is stable to avoid
  debugging two reindex changes at once.
- `07-quality-validation-and-doc-sync.md` runs last, depends on all prior slices, and re-runs `00`'s
  harness to record the **after** result.

## Ordered Execution List

| #   | File                                             | Purpose                                                                                      | Priority                         |
| --- | ------------------------------------------------ | -------------------------------------------------------------------------------------------- | -------------------------------- |
| 0   | `00-retrieval-quality-baseline-harness.md`       | Build a small recall@k fixture harness and capture a before-fix baseline                     | P2 (moved first for measurement) |
| 1   | `01-chunking-safety-and-overlap.md`              | Hard-cap oversized paragraphs; add configurable chunk overlap                                | P0 (cap) / P1 (overlap)          |
| 2   | `02-embedding-dimension-migration.md`            | Raise embedding dimensions from 16, migrate schema/index, staged reindex                     | P0                               |
| 3   | `03-single-authoritative-retrieval-selection.md` | Remove the redundant third `selectBalancedRetrievedItems` pass in prompt rendering           | P1                               |
| 4   | `04-retrieval-contract-and-dead-code-cleanup.md` | Fix or remove the always-zero `excludedChunkCount`; remove the unreachable chunk-create path | P1                               |
| 5   | `05-lexical-hybrid-fallback.md`                  | Add a lexical/full-text candidate path fused with vector results                             | P2                               |
| 6   | `06-incremental-reindexing.md`                   | Skip re-embedding unchanged chunk content on reindex via content hashing                     | P2                               |
| 7   | `07-quality-validation-and-doc-sync.md`          | Re-run the harness, record before/after deltas, close out documentation                      | —                                |

## Suggested Execution Order

`00 -> 01 -> 02 -> (03 + 04) -> 05 -> 06 -> 07`

Slices `03` and `04` may be implemented in parallel after `02`. Do not start `05` before `04` lands —
it fuses lexical candidates into the same trace/contract `04` cleans up, and doing it first would
mean re-touching the fusion code immediately after.

## Definition Of Done For Full EPIC

- [ ] A versioned recall@k/MRR fixture harness exists, is runnable without live provider calls beyond
      the configured embedding adapter, and has recorded before/after results for this EPIC.
- [ ] Production embedding dimensions are raised from 16 to a value the harness shows measurably
      improves retrieval quality; schema, index, and the active corpus generation reflect the change
      through the existing staged-reindex mechanism (no ad hoc one-off migration path).
- [ ] `toChunkSeeds` never produces a chunk whose size exceeds a documented hard maximum, regardless
      of input paragraph structure, and ingestion cannot fail solely because one paragraph had no
      blank lines.
- [ ] Adjacent chunks from the same source share a configurable, bounded content overlap.
- [ ] `selectBalancedRetrievedItems` runs exactly once for the Avatar retrieval path; prompt rendering
      formats an already-selected set instead of re-selecting it.
- [ ] `excludedChunkCount` (and any other trace field that cannot be computed after moving filtering
      into SQL) is either backed by a real value or removed from the DTO, event, and console UI
      together — no field that only ever reads a hardcoded constant remains user-visible.
- [ ] `PostgresKnowledgeChunkRepository.create()` is either removed, restricted to the interface(s)
      that actually call it in production, or documented in place as intentionally
      in-memory/test-only, so a reader is not misled about the production write path.
- [ ] A lexical/full-text candidate path exists for at least exact-entity-style queries and is fused
      with vector candidates without introducing a second, divergent ranking algorithm outside the
      canonical retrieval service.
- [ ] Reindexing skips re-embedding a chunk whose content is unchanged from the previously active
      generation, verified by a lower embedding-call count on a partial-change fixture.
- [ ] All checks pass and `docs/PROJECT_STATUS.md`, `docs/EPICS.md`, `docs/EMBEDDING_OPERATIONS.md`,
      `docs/RAG_SYSTEM_IMPLEMENTATION.md`, `docs/RAG_SYSTEM_AUDIT.md`, `docs/DATA_MODEL.md`, and
      `docs/API_CONTRACT.md` describe the shipped behavior accurately.
