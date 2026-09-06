# Embed Ordered Runtime Query Variants

## Context

The current query builder preserves useful origins—user input, GM queries and required facts,
guidance, working memory, and world context—but retrieval tokenizes their text instead of embedding
it. EPIC 5.1c supplies the active embedding profile and provider-neutral batch port. This slice
creates the single query-vectorization boundary used by all retrieval callers.

## Scope

Implement now:

- create an application service that normalizes and batch-embeds retrieval query variants;
- preserve variant source and stable input order through batch output mapping;
- resolve one active embedding profile per retrieval operation and verify returned provider, model,
  vector count, dimensions, finite values, and profile identity;
- support all existing configured sources: direct query, last user input, GM guidance/query/required
  fact, working memory, and world/scenario context;
- return safe metadata for provider/model/dimension, query-vector count, and embedding latency;
- translate embedding failures into the canonical controlled retrieval outcome without exposing
  vectors or provider payloads;
- add deterministic unit tests using the EPIC 5.1c fake embedding adapter.

Out of scope:

- nearest-neighbor SQL, candidate selection, prompt assembly, or API presentation;
- new query sources not already required by runtime configuration/contracts;
- retries or lexical fallback inside retrieval;
- live provider calls in normal tests.

## Relevant Docs

- `docs/ARCHITECTURE.md`
- `docs/PRINCIPLES.md`
- `docs/TECH_STACK.md`
- `docs/API_CONTRACT.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`
- EPIC 5.1c embedding/profile documentation

## Implementation Guidance

- Build on `typed-retrieval-query-builder.ts`; do not move retrieval policy into provider adapters.
- Reuse the EPIC 5.1c active-profile resolver and embedding batch contract. Retrieval must never
  choose a provider/model independently from the active stored corpus.
- Filter empty variants and deduplicate using existing stable rules before embedding. Keep a mapping
  from each output vector to source, text, and original normalized index.
- Call the adapter once per supported batch (or through its existing bounded batching behavior),
  not once per query variant.
- Measure the entire embedding operation using the repository's existing clock/observability style.
  Keep telemetry bounded: source/index and text length are safe; raw text is allowed only in the
  existing authorized diagnostic response if its contract deliberately retains it, never logs.
- Treat count mismatch, non-finite values, wrong dimension, stale profile, and provider failure as
  controlled failure. Return no partial query-vector set unless the canonical contract explicitly
  supports an all-or-nothing validated result.
- Tests must prove ordering for duplicate-looking sources, deduplication, empty input, profile
  mismatch, dimension mismatch, malformed count, provider failure, and absence of raw vectors in
  serialized diagnostics/log attributes.

## Constraints

- Depend only on the provider-neutral embedding port in Application code.
- No direct OpenAI SDK use or provider/model hard-coding.
- No lexical fallback.
- Keep normal automated tests deterministic and network-free.
- Avoid logging raw query text, prompts, vectors, secrets, or provider responses.
- Preserve the asynchronous/non-blocking GM contract.

## Deliverables

- One reusable profile-aware query-vectorization application service.
- Ordered query-vector results linked to canonical query variants.
- Safe embedding timing/profile/count diagnostics.
- Controlled failure mapping for all embedding validation/provider failures.
- Deterministic unit tests.

## Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts: query variants, embedding profile/batch result/error,
   retrieval outcome, observability attributes, and admin/runtime diagnostics.
2. Search for duplicated type definitions, repeated inline response shapes, local console/client
   copies, inconsistent optionality/nullability, and field-name drift.
3. Identify the canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one before feature work proceeds.

## Mandatory Final Step — Documentation Update

After implementation, review and update `docs/PROJECT_STATUS.md` (always), `docs/ARCHITECTURE.md`,
`docs/TECH_STACK.md`, `docs/API_CONTRACT.md`, `docs/GAME_MASTER_CONTRACT.md`,
`docs/TEST_STRATEGY.md`, `docs/TEST_COVERAGE_PLAN.md`, and `docs/EPICS.md` where behavior or progress
changed. Explicitly verify unchanged documents. Code, tests, and docs move together.

## Acceptance Criteria

- [ ] All normalized query variants are embedded in stable order through one batch boundary.
- [ ] Query and stored vectors are tied to the same active profile.
- [ ] Provider/model/dimension, latency, and vector count are safely observable.
- [ ] Invalid or failed batches yield a controlled all-or-nothing retrieval failure.
- [ ] No raw vector enters an API response, event, log, or error.
- [ ] No lexical fallback exists in this service.
- [ ] Deterministic unit tests and documentation checks pass.
