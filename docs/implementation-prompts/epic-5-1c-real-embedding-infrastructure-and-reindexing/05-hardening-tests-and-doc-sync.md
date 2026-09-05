# Harden Embedding Lifecycle And Complete Documentation

## Context

The preceding slices create a real embedding provider path, versioned corpus storage,
profile-aware ingestion, and full reindexing. The EPIC is not complete until production composition,
failure recovery, database invariants, concurrent-read safety, operational visibility, and source-of-truth
documentation are verified together.

This final slice closes only integration gaps found by end-to-end review; it must not expand EPIC scope.

## Scope

Implement now:

- audit production and test composition to prove hash embeddings cannot be selected implicitly;
- exercise the complete initial-profile, ingestion, profile-change, failed-reindex, retry, and
  successful-promotion lifecycle;
- verify active reads never expose staged, stale, missing, or incompatible vectors;
- test adapter batching/usage/error behavior and PostgreSQL dimension/index constraints;
- test stale ingestion and concurrent retrieval/promotion behavior deterministically;
- confirm restart recovery and repeated reindex requests are idempotent;
- validate safe observability fields and absence of source text, vectors, secrets, and raw payloads;
- synchronize all impacted docs and mark EPIC 5.1c complete only if its full definition of done passes.

Out of scope:

- nearest-neighbor retrieval or ranking quality;
- more embedding providers;
- vectorizing memory/user facts;
- generalized job queues, schedulers, dashboards, or vector databases;
- unrelated cleanup discovered during the audit.

## Relevant Docs

- `docs/VISION.md`
- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/DATA_MODEL.md`
- `docs/API_CONTRACT.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`
- deployment/configuration examples and operator guides impacted by embedding configuration

## Implementation Guidance

- Build a requirements-to-tests matrix from the EPIC definition of done before adding tests. Reuse
  existing lower-level coverage and add only missing failure-boundary and cross-component cases.
- At minimum cover:
  - multi-batch order preservation, count/index corruption, non-finite values, and dimension mismatch;
  - explicit invalid input, rate limit, provider failure, and retry classification;
  - missing credentials/unsupported provider and absence of production hash fallback;
  - fresh-database profile initialization and legacy `VECTOR(16)` invalidation/migration;
  - transactional source replacement and rollback;
  - profile changes in provider, model, and dimension independently;
  - partial source failure, retry after failure/restart, duplicate starts, and competing promotion;
  - active reads during staging and immediately before/after atomic promotion;
  - ingestion begun under a stale profile and query vectors tagged with the active profile;
  - reindex/admin route auth, validation, not-found, response envelopes, and successful lifecycle.
- Use deterministic fake provider clients in normal suites. Keep real OpenAI calls opt-in and do not
  make CI/network credentials a prerequisite for proving adapter contracts.
- Inspect `apps/core/src/index.ts`, `apps/core/src/api/server.ts`, seeds, and test builders for every
  `HashEmbeddingAdapter` construction. Only explicitly test-scoped composition may retain it.
- Verify the database index definition and `vector(n)` typmod directly in PostgreSQL tests rather
  than only asserting repository behavior.
- Run focused suites first, then repository-wide typecheck, lint, unit tests, relevant integration/
  stack-e2e suites, and build. Record any environment-limited skipped live-provider checks.
- Update docs with exact supported profile defaults/variables, fixed-dimension migration procedure,
  reindex lifecycle and recovery, API contracts, observable fields, and the EPIC 5.1d query-vector boundary.

## Constraints

- Respect current architecture; hardening must not introduce shortcuts.
- KISS, YAGNI, DRY.
- Keep all normal automated tests deterministic and provider-network-free.
- No weakening of database constraints to make tests pass.
- No raw source content, vectors, credentials, or provider payloads in logs/events/API errors.
- Do not mark the EPIC complete while any required lifecycle or documentation item remains open.

## Deliverables

- Requirements-to-tests coverage for the full embedding/profile/reindex lifecycle.
- Closed production-wiring and failure-recovery gaps.
- Verified PostgreSQL dimension, index, staging, and promotion invariants.
- Verified mandatory stack-e2e coverage for all new endpoints.
- Updated configuration/deployment and operator guidance.
- Fully synchronized `PROJECT_STATUS`, EPIC ledger, architecture, data model, API, and test docs.

## Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts: embedding profile/result/error, knowledge source/chunk,
   ingestion job, reindex operation/progress, admin DTOs, configuration, and observability events.
2. Search for duplicated type definitions, repeated inline response shapes, local console/client
   copies, inconsistent optionality/nullability, and field-name drift.
3. Identify the canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one before hardening proceeds.

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md` — always required and must describe shipped production behavior;
- `docs/EPICS.md` — mark EPIC 5.1c complete only after all acceptance criteria pass;
- `docs/ARCHITECTURE.md` — embedding port, profile resolution, ingestion, reindex, and promotion flow;
- `docs/DATA_MODEL.md` — fixed dimensions, profile/generation identity, operations, and active-corpus invariants;
- `docs/API_CONTRACT.md` — exact operator routes and error/status DTOs;
- `docs/TECH_STACK.md` — provider/model/dimension configuration and supported OpenAI adapter;
- `docs/TEST_STRATEGY.md` and `docs/TEST_COVERAGE_PLAN.md` — deterministic provider and PostgreSQL lifecycle coverage;
- README/configuration/deployment/operator docs affected by new required environment variables and reindex steps;
- `docs/GAME_MASTER_CONTRACT.md` and `docs/MEMORY_SYSTEM_SPEC.md` — explicitly verify they remain
  accurate because embeddings do not alter GM timing or vectorize memory.

If a listed document needs no text change, record that it was reviewed and remains accurate. Code,
tests, and docs move together.

## Acceptance Criteria

- [ ] Production ingestion uses configured real OpenAI embeddings through the internal port.
- [ ] Hash vectors are available only through explicit test injection.
- [ ] Provider, model, dimension, usage, latency, and failures are explicit and observable.
- [ ] PostgreSQL vector dimension and index match the supported active profile.
- [ ] Profile changes cannot activate until a complete replacement corpus validates.
- [ ] Partial/stale work never creates a mixed active vector space.
- [ ] Failed ingestion/reindex preserves the previous valid corpus where possible and can be retried.
- [ ] Query vectorization shares the active profile without implementing retrieval.
- [ ] Unit, integration, PostgreSQL, route, and stack-e2e suites cover every required failure boundary.
- [ ] All required checks pass or have an explicitly documented environment limitation.
- [ ] All impacted documentation is current and EPIC status is truthful.
