# Validate Quality Improvement And Close Out Documentation

## Context

Every prior slice in this EPIC changed something that plausibly affects retrieval quality or its
observability. This slice proves the EPIC delivered what it claimed — not by inspection, but by
re-running the `00` baseline harness and recording the delta — and brings every document this EPIC
touches back into agreement with the shipped code, matching how `epic-5-1d`'s own closing slice
(`05-quality-hardening-and-doc-sync.md`) closed that EPIC.

## Scope

Implement now:

- re-run the `00` harness against the fully updated system (new embedding dimension, corrected
  chunking, lexical fusion, incremental reindex) and record the **after** result alongside the
  committed **before** baseline;
- write a short before/after comparison (recall@k, MRR, and any qualitative notes — e.g. which
  fixtures specifically flipped from miss to hit) into the harness's report location from `00`;
- if the after result does _not_ show a clear improvement over the before baseline, treat that as a
  real finding, not a reason to suppress it: document what was measured, investigate whether the
  chosen dimension/fusion approach needs revisiting, and do not claim success in `docs/EPICS.md` that
  the numbers don't support;
- run the full test suite (`00`–`06`'s tests) together at least once to catch any interaction between
  slices (e.g. `01`'s chunking change combined with `06`'s content-hash reindex skip);
- close out documentation across every file touched or flagged by earlier slices.

Out of scope:

- new features beyond what `00`–`06` already implement;
- rewriting `docs/RAG_SYSTEM_AUDIT.md`'s phase-by-phase description from scratch — update it in place
  to reflect resolved findings, keep its structure.

## Relevant Docs

- `docs/RAG_SYSTEM_AUDIT.md`
- `docs/RAG_SYSTEM_IMPLEMENTATION.md`
- `docs/EMBEDDING_OPERATIONS.md`
- `docs/DATA_MODEL.md`
- `docs/API_CONTRACT.md`
- `docs/ARCHITECTURE.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`

## Implementation Guidance

- Re-run exactly the tool/script `00` documented, against the same fixture set, so the comparison is
  apples-to-apples. If a fixture had to change because `01`'s chunking changed chunk boundaries around
  its expected chunk ID, note that explicitly rather than silently swapping the fixture.
- Grep for every place `docs/RAG_SYSTEM_AUDIT.md` states a finding as open (the dimension count, the
  triple selection, the hardcoded `excludedChunkCount`, the unreachable `create()`, the absence of
  lexical search, the absence of incremental reindexing, the absence of an eval harness) and update
  each to state how it was resolved, or explicitly why it was intentionally left as-is if a later
  slice's implementation diverged from the original recommendation.
- Update `docs/EPICS.md`'s "Shipped"/"Open backlog" sections only once the Definition of Done in this
  EPIC's `README.md` is actually satisfied — do not mark it shipped speculatively.

## Constraints

- Do not soften or omit a negative or inconclusive quality-measurement result to make the EPIC look
  more successful than it was; the point of `00`/`07` is to make that impossible to fudge.
- Code, tests, and docs move together — no documentation-only or code-only follow-up commit implied by
  this slice.

## Deliverables

- A committed before/after quality comparison report.
- Full test suite passing with all EPIC slices integrated.
- `docs/RAG_SYSTEM_AUDIT.md`, `docs/RAG_SYSTEM_IMPLEMENTATION.md`, `docs/EMBEDDING_OPERATIONS.md`,
  `docs/DATA_MODEL.md`, `docs/API_CONTRACT.md`, `docs/ARCHITECTURE.md`, `docs/TEST_STRATEGY.md`,
  `docs/TEST_COVERAGE_PLAN.md`, `docs/PROJECT_STATUS.md`, and `docs/EPICS.md` all reflecting the
  shipped state accurately.

## Mandatory Pre-Implementation Check

Before coding:

1. Confirm every slice's Definition of Done item in the EPIC `README.md` is actually met before
   declaring the EPIC complete in `docs/EPICS.md`.
2. Re-read `docs/RAG_SYSTEM_AUDIT.md` end-to-end and produce a literal checklist of every finding it
   raised, so none are silently left unaddressed or undocumented.

## Mandatory Final Step — Documentation Update

This slice _is_ the documentation-update step for the EPIC. After the quality re-measurement:

- Update `docs/PROJECT_STATUS.md` to describe the current retrieval capability accurately.
- Update `docs/EPICS.md`'s "Shipped" list only if every Definition of Done item is met.
- Update `docs/RAG_SYSTEM_AUDIT.md` and `docs/RAG_SYSTEM_IMPLEMENTATION.md` in place to reflect
  resolved findings and the new, current end-to-end behavior.
- Explicitly verify unchanged documents and note that they were reviewed.

## Acceptance Criteria

- [ ] An after-fix quality report exists, directly comparable to the `00` before-fix baseline, using
      the same fixtures and metric definitions.
- [ ] The comparison is reported honestly, including if results are mixed or inconclusive.
- [ ] The full retrieval-related test suite (across `00`–`06`'s changes) passes together.
- [ ] `docs/RAG_SYSTEM_AUDIT.md` no longer lists any of this EPIC's addressed findings as open without
      an explanation of how (or why not) they were resolved.
- [ ] `docs/EPICS.md` reflects this EPIC's true completion state, matching the README's Definition of
      Done.
- [ ] Every document listed in "Relevant Docs" has been reviewed, with unchanged ones explicitly noted
      as reviewed-and-accurate.
