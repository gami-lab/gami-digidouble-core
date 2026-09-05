# Implement Safe Full Reindexing And Operator Controls

## Context

Changing embedding provider, model, or dimensions changes the vector space. Activating configuration
before all shared knowledge is rebuilt would corrupt retrieval. EPIC 5.1c therefore needs an
explicit operation that stages every source under the target profile and promotes it only after
the replacement corpus is complete.

This slice implements the application workflow and the minimal operator surface needed to start,
retry, and inspect that long-running operation.

## Scope

Implement now:

- detect that a requested/configured profile differs from the active profile by provider, model,
  or dimensions and create/reuse a reindex operation;
- enumerate all shared knowledge sources from canonical repositories;
- reload source content and rerun the current deterministic chunker when needed;
- generate and transactionally stage replacement chunks for each source under one target profile/generation;
- validate source completion, vector counts, dimensions, and profile identity;
- atomically promote the target profile/generation only after every required source succeeds;
- persist operation/source progress and expose explicit completion/failure status with bounded errors;
- make the operation idempotent, retryable, and safe when duplicate starts or workers occur;
- add minimal authenticated admin endpoints to start/retry and inspect reindex operations if no
  existing operator action/status route can own these capabilities cleanly.

Out of scope:

- scheduled/automatic polling workers beyond the repository's existing async execution pattern;
- nearest-neighbor retrieval;
- an admin UI unless a tiny existing inspector integration is necessary for operability;
- unrelated knowledge-source authoring changes;
- additional embedding providers.

## Relevant Docs

- `docs/VISION.md`
- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/DATA_MODEL.md`
- `docs/API_CONTRACT.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`

## Implementation Guidance

- Implement reindexing as an Application use case/service over source/content-loader, chunker,
  embedding, profile, reindex-operation, chunk, event-log, and transaction ports. API handlers only
  validate/map; Infrastructure owns SQL and provider calls.
- Reuse ingestion's content loading, chunking, batch validation, and transactional staging logic.
  Do not fork a second chunking algorithm or bypass normal source visibility metadata.
- Snapshot the target profile and expected source IDs at operation creation. An operation retry must
  use that immutable target and source set, not silently adopt later configuration.
- Use stable operation/generation IDs and per-source state so rerunning completed sources is safe,
  failed sources can be retried, and duplicate starts for the same target do not create competing
  active candidates. Define deterministic ownership/locking for concurrent workers.
- Keep the current active pointer unchanged while processing. Retrieval/listing through active
  paths must not see staged chunks. Promotion should compare the expected current active profile to
  prevent an older operation from overwriting a newer decision.
- A failed or unreadable source must be named by safe ID and error code in operation progress and
  must block promotion. Do not include source content, vectors, credentials, or raw provider payloads.
- Emit start, source-progress/failure, retry, completion, and promotion diagnostics with operation
  ID, target profile, counts, attempts, latency, and safe failure category. Avoid high-volume per-vector events.
- Keep async execution non-blocking at the HTTP boundary: return an accepted operation resource,
  then execute through the current background scheduling style. Process restart recovery must be
  explicit—running operations can be resumed/retried rather than remaining permanently ambiguous.
- Define additive shared admin DTOs only if endpoints expose them. Do not leak persistence rows.
- For every new endpoint, add route unit tests and a colocated `*.stack-e2e.test.ts` following the
  existing route pattern. Cover missing/wrong API keys (`401`), invalid inputs (`400`), unknown
  operation IDs (`404` with the correct `ApiResponse` code), plus start/status/retry success paths.

## Constraints

- Respect `API -> Application -> Domain -> Infrastructure`.
- KISS, YAGNI, DRY.
- Reindexing must not block Avatar responses or ordinary retrieval against the current corpus.
- Never activate a partially built or mixed-profile corpus.
- No silent automatic fallback to the previous embedding adapter for failed sources.
- Do not add a queue dependency solely for this EPIC; use existing async patterns unless proven insufficient.
- External input is validated at the API boundary and all responses use `ApiResponse<T>`.

## Deliverables

- Reindex start/retry/status use cases and persisted lifecycle.
- All-source staging with deterministic source progress and safe retries.
- Completeness validation and atomic profile/corpus promotion.
- Structured observability and recovery after partial failure or restart.
- Minimal authenticated operator routes and canonical shared DTOs where required.
- Route unit, application, concurrency, integration, and mandatory stack-e2e tests.

## Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts: knowledge sources/chunks, profile, generation, reindex
   operation/source progress, admin DTOs, events, and API envelopes.
2. Search for duplicated type definitions, repeated inline response shapes, local console/client
   copies, inconsistent optionality/nullability, and field-name drift.
3. Identify the canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one before feature work proceeds.

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md` — always required;
- `docs/API_CONTRACT.md` with exact admin routes, validation, status, errors, and envelopes;
- `docs/ARCHITECTURE.md` with async reindex and promotion flow;
- `docs/DATA_MODEL.md` with operation/source lifecycle and invariants;
- `docs/TECH_STACK.md` if deployment/runtime configuration changes;
- `docs/TEST_STRATEGY.md` and `docs/TEST_COVERAGE_PLAN.md` for stack/concurrency/recovery coverage;
- `docs/EPICS.md` only when progress/status is accurate.

If no additional documentation changes are needed, explicitly verify that every impacted document
is still accurate. Code, tests, and docs move together.

## Acceptance Criteria

- [ ] Any provider, model, or dimension change requires a full replacement operation before activation.
- [ ] Reindex snapshots and processes every required shared knowledge source.
- [ ] Duplicate starts and retries are idempotent and concurrent workers cannot corrupt staging.
- [ ] Failed sources are explicit, retryable, and prevent promotion.
- [ ] Concurrent retrieval continues against the prior active corpus until atomic promotion.
- [ ] Promotion validates source/vector completeness, profile identity, and dimensions.
- [ ] Restart/partial-write recovery has deterministic behavior and tests.
- [ ] Operator status exposes progress and bounded diagnostics without sensitive content.
- [ ] Every new endpoint has route and stack-e2e auth/validation/not-found/success coverage.
