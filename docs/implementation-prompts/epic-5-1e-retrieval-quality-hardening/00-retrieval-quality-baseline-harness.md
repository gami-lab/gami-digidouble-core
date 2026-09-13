# Build A Retrieval-Quality Baseline Harness

## Context

`docs/RAG_SYSTEM_AUDIT.md` notes that no part of this codebase measures retrieval quality directly:
`tools/conversation-evaluation` judges whole conversations with an LLM judge, which cannot localize a
regression or an improvement to retrieval specifically. Every other slice in this EPIC changes
something that plausibly affects which chunks get retrieved (embedding dimension, chunking, lexical
fallback, selection code paths). Without a number captured before those changes, "it seems better" is
the best anyone can say afterward. This slice must land first and produce a **before** result against
the current (16-dimension) production profile.

## Scope

Implement now:

- a small, versioned set of fixtures: for a handful of existing or purpose-built scenarios, a query
  string plus the chunk ID(s) that should be retrieved for it (source them from real
  `avatar_knowledge`/`world` content already used in tests/fixtures where possible, to avoid inventing
  a parallel corpus);
- a scorer that runs each fixture query through the existing `TypedRetrievalService` (not a
  reimplementation) and computes recall@k and mean reciprocal rank against the fixture's expected
  chunk IDs;
- a runnable script or test (`tools/` or an `apps/core` integration test, matching existing
  conventions) that reports aggregate recall@k/MRR, plus per-fixture detail for debugging;
- capture and commit the **before** result (a small JSON/Markdown report) run against the current
  16-dimension production profile, so slice `07` can diff against it.

Out of scope:

- changing embedding dimensions, chunking, selection, or lexical search (later slices);
- a general-purpose evaluation framework, dashboard, or CI gate — this is a small, targeted tool;
- fixtures spanning every scenario in the product; a representative sample is enough.

## Relevant Docs

- `docs/RAG_SYSTEM_AUDIT.md` (source of this EPIC)
- `docs/RAG_SYSTEM_IMPLEMENTATION.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`

## Implementation Guidance

- Reuse `TypedRetrievalService`, `KnowledgeQueryEmbeddingService`, and the existing test-support
  adapters/fixtures (`HashEmbeddingAdapter`, `SemanticFixtureEmbeddingAdapter`) for any deterministic
  unit-level scoring; use the real `OpenAiEmbeddingAdapter` (behind an explicit opt-in, e.g. an env
  var or a separate script target) for the actual before/after measurement, since a deterministic
  fixture adapter cannot tell you anything about real semantic fidelity.
  See `tools/conversation-evaluation/src/evaluation.ts` for the existing pattern of a standalone
  scripted tool that calls into `apps/core` services against a running/composed stack, and follow the
  same conventions here instead of inventing a new one.
- Keep fixtures small and explicit: one JSON/TS file listing `{ scenarioId, query, expectedChunkIds }`
  entries. Do not auto-generate expected IDs from current retrieval output — that would just measure
  "did retrieval change," not "is retrieval correct." Pick fixtures where the expected chunk is
  obvious from the source content (e.g. a query naming an entity that appears in exactly one chunk).
- Recall@k: for k in the product's actual per-type limits (3 default, 7/9 avatar max), the fraction of
  fixtures whose expected chunk ID(s) appear in the top-k candidates. MRR: reciprocal rank of the
  first expected chunk in the ranked candidate list, 0 if absent.
- Report format should be stable enough to diff by hand: one committed baseline file, one instruction
  for how to regenerate it.

## Constraints

- Do not modify `TypedRetrievalService`, `retrieval-selection.ts`, chunking, or embedding config in
  this slice — it must measure the system as it stands today.
- No new production HTTP endpoint. This is a dev/ops tool, not a runtime feature.
- Do not commit real `OPENAI_API_KEY` values or live provider responses; the committed baseline report
  contains only scores/counts, never raw content or vectors.

## Deliverables

- A fixture set with a documented rationale for each expected chunk.
- A scorer/report tool runnable from the command line.
- A committed **before** baseline report (recall@k, MRR) generated against the current 16-dimension
  production profile.
- A short README in the tool's directory explaining how to regenerate the report.

## Mandatory Pre-Implementation Check

Before coding:

1. Confirm whether `tools/conversation-evaluation` already has infrastructure (config loading,
   provider wiring, report format) this harness can reuse instead of duplicating.
2. Identify which existing scenario/knowledge-source fixtures already have content specific enough to
   build fair recall fixtures from, to avoid hand-authoring a large new corpus.
3. Confirm how the composed `apps/core` stack is normally driven for scripted tools (see
   `tools/conversation-evaluation`) and reuse that composition path rather than reimplementing service
   wiring.

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md` — always required;
- `docs/TEST_STRATEGY.md` and `docs/TEST_COVERAGE_PLAN.md` to note the new harness and what it does
  and does not cover;
- `docs/EPICS.md` only with truthful progress (this slice alone does not complete the EPIC).

If a document needs no change, explicitly record that it was reviewed and remains accurate.

## Acceptance Criteria

- [ ] A committed fixture set exists with an explicit expected-chunk rationale per fixture.
- [ ] A scorer computes recall@k (for the product's real per-type limits) and MRR using the actual
      `TypedRetrievalService`, not a reimplementation of ranking.
- [ ] A before-fix baseline report is committed, generated against the current production embedding
      profile.
- [ ] The tool documents exactly how to regenerate the report for later slices.
- [ ] No production runtime behavior changes.
