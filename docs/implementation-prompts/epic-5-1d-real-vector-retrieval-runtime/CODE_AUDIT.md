# Code Audit — EPIC 5.1d Real Vector Retrieval Runtime

## Scope audited

- EPIC scope: `docs/implementation-prompts/epic-5-1d-real-vector-retrieval-runtime/README.md`
- Required project references reviewed:
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
- Key implementation paths sampled:
  - `apps/core/src/application/services/knowledge/knowledge-query-embedding.service.ts`
  - `apps/core/src/application/services/knowledge/typed-retrieval.service.ts`
  - `apps/core/src/application/ports/IKnowledgeChunkRepository.ts`
  - `apps/core/src/infrastructure/db/repositories/postgres-knowledge-chunk.repository.ts`
  - `apps/core/src/infrastructure/db/in-memory-knowledge-chunk.repository.ts`
  - `apps/core/src/application/use-cases/send-message/send-message.use-case.ts`
  - `apps/core/src/application/use-cases/run-game-master/run-game-master.context.ts`
  - `apps/core/src/api/routes/knowledge.ts`
  - `apps/core/src/api/routes/knowledge-retrieval.presenter.ts`
  - `apps/core/src/application/services/runtime-inspector-event-context.ts`

## Executive Summary

EPIC 5.1d is functionally delivered: runtime retrieval is vector-based, profile-aware, bounded, and shared across Avatar, async GM, and admin diagnostics. Production lexical overlap ranking is removed from runtime paths. Architecture boundaries are mostly respected (API thin, orchestration in Application, domain contracts explicit, pgvector contained in Infrastructure).

Primary concerns are not feature-missing defects but confidence and maintainability risks:

1. Integration suite currently fails due provider-skip logging interacting with strict console guards.
2. Stack E2E command fails preflight without a reachable app and reports as a hard failure.
3. Retrieval trace mapping/parsing logic is duplicated across multiple layers, increasing drift and field-add blast radius.
4. SQL index-compatibility assertion is weak (string presence, not plan-node/index usage).
5. Coverage percentages exclude infrastructure DB code, reducing usefulness for this EPIC’s critical repository path.

## Final Grade

**C**

Rationale: core EPIC behavior is delivered and mandatory gates pass, but reliability of higher-tier evidence is currently weakened by failing integration smoke tests and maintainability/test-rigor gaps that materially reduce confidence under change.

## Build Health

- lint: **PASS** (`pnpm lint`)
- typecheck: **PASS** (`pnpm typecheck`)
- tests: **PASS** (`pnpm test`)
- coverage: **PASS** (`pnpm test:coverage`) — `All files` summary observed at `lines 87.05 / branches 83.38 / functions 96.38 / statements 87.05`

Additional EPIC-relevant runs executed:

- `pnpm test:integration-e2e`: **FAIL** (2 failed tests, both Mistral transient-skip path)
- `pnpm test:stack-e2e`: **FAIL** (stack preflight cannot reach `APP_URL`; no test files executed)

## Feature Confidence Matrix

| Feature                                    | Expected Behavior                                                                                           | Evidence                                                                                                                | Confidence (High/Medium/Low) | Notes                                                               |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------- |
| Query variant embedding boundary           | Normalize ordered variants, embed in one batch, enforce profile/dimension/all-or-nothing failure            | `knowledge-query-embedding.service.ts`, `knowledge-query-embedding.service.test.ts`                                     | High                         | Strong deterministic tests and safe diagnostics checks.             |
| Repository vector search semantics         | SQL-side filtering + cosine order + bounded limit + profile/generation gating                               | `postgres-knowledge-chunk.repository.ts`, `postgres-knowledge-chunk.repository.integration.test.ts`                     | Medium                       | Good integration coverage, but index-shape assertion is shallow.    |
| Runtime typed retrieval composition        | Avatar/GM/admin share canonical service; no lexical fallback                                                | `typed-retrieval.service.ts`, `send-message.use-case.ts`, `run-game-master.context.ts`, `knowledge.ts`                  | High                         | Wiring and tests show single service path and controlled failures.  |
| Visibility asymmetry                       | Avatar filtered visibility; GM explicit unrestricted mode                                                   | `typed-retrieval.service.ts`, `postgres-knowledge-chunk.repository.ts`, related tests                                   | High                         | Explicit mode + tests for both paths.                               |
| Failure isolation                          | Embedding/search failures do not block Avatar response; required retrieval handled as insufficient evidence | `send-message.use-case.ts`, `typed-retrieval.service.ts`, tests in `send-message.use-case.test.ts` and retrieval suites | High                         | Try/catch fallback and required-evidence status preserved.          |
| Diagnostics unification                    | Trace/profile/timing/counts/distance/similarity flow to admin + runtime inspection safely                   | `knowledge-retrieval.presenter.ts`, `runtime-inspector-event-context.ts`, `list-session-events.use-case.ts`             | Medium                       | Implemented, but duplicated mapping/parsing creates drift risk.     |
| PostgreSQL behavior under real environment | End-to-end pgvector repo behavior in integration tier                                                       | `postgres-knowledge-chunk.repository.integration.test.ts` + run result                                                  | Medium                       | Passed in this run, but environment gating still applies generally. |
| Stack-level end-to-end confidence          | Full production binary validation                                                                           | `pnpm test:stack-e2e` run result                                                                                        | Low                          | Could not execute due missing reachable app stack.                  |

## Strengths

- Clean layered flow: API routes delegate to use cases; business retrieval logic lives in Application/Domain.
- Strong provider-neutral embedding boundary and profile identity enforcement.
- Canonical vector-search repository contract with explicit `KnowledgeVectorSearchError` semantics.
- Deterministic semantic fixture test for paraphrase vs unrelated candidates.
- Explicit GM unrestricted visibility mode (not inferred by omission).
- Controlled failure behavior avoids lexical fallback and protects Avatar response latency.

## Findings

### 1) Integration tier currently fails on intended transient-provider skip path

- Severity: **High**
- Category: **Test reliability / CI signal quality**
- Problem:
  Transient provider skip helper emits `console.warn`, but global test setup fails on any unexpected warn. This turns intended skip behavior into failed tests.
- Why it matters:
  Integration suite becomes noisy and unreliable; genuine regressions are harder to distinguish from infrastructure/provider quota incidents.
- Evidence:
  - `apps/core/src/test-utils/real-provider.ts` (`skipProviderSmokeTest` uses `console.warn`)
  - `apps/core/vitest.setup.ts` (throws on `console.warn`)
  - Command output: `pnpm test:integration-e2e` failed 2 tests with message `Unexpected console.warn in test`.
- Recommendation:
  Replace warning side-effect in skip helper with test-framework-native annotation/logging that does not violate guardrails, or explicitly guard expected warn in those skip paths.

### 2) Stack E2E command fails hard when preflight app endpoint is unavailable

- Severity: **Medium**
- Category: **Operational verification / release process**
- Problem:
  `pnpm test:stack-e2e` exits non-zero on preflight when `APP_URL` is not reachable, producing a hard failure before any tests run.
- Why it matters:
  Audit/release evidence can look red for environment reasons, obscuring product-quality signals.
- Evidence:
  - `apps/core/vitest.stack-e2e.global-setup.ts` failure surfaced in command output (`cannot reach app at http://localhost:3000`)
  - Command output: no stack test files executed, command failed.
- Recommendation:
  Keep hard-fail in CI/nightly where environment is required, but provide an explicit local precheck task or a documented non-failing local skip mode for audit workflows.

### 3) Retrieval trace presentation logic is duplicated across boundaries

- Severity: **Medium**
- Category: **Structural maintainability / contract drift risk**
- Problem:
  Similar retrieval trace normalization/presentation functions exist in multiple places.
- Why it matters:
  Adding a retrieval field requires multi-file synchronized edits, increasing drift risk and violating the “easy field evolution” goal.
- Evidence:
  - `apps/core/src/api/routes/knowledge-retrieval.presenter.ts` (`presentTrace`, `presentDistance`, `presentSimilarity`)
  - `apps/core/src/application/services/runtime-inspector-event-context.ts` (`toRetrievalTraceDto`, `presentDistance`, `presentSimilarity`)
- Recommendation:
  Consolidate retrieval trace DTO mapping into one shared mapper and have consumers call it; keep only transport-specific truncation at route edge.

### 4) Runtime-event retrieval trace parsing duplicates DTO schema manually

- Severity: **Medium**
- Category: **Maintainability / hidden coupling**
- Problem:
  `list-session-events` manually re-parses retrieval trace DTO shapes and optional fields.
- Why it matters:
  Every retrieval contract evolution requires careful parser updates, increasing chance of partial support or silent field loss.
- Evidence:
  - `apps/core/src/application/use-cases/list-session-events/list-session-events.use-case.ts` (`readRetrievalTrace*` family)
- Recommendation:
  Introduce shared runtime-safe decoder utilities for retrieval trace DTOs to reduce repeated schema logic and blast radius.

### 5) SQL index-compatibility test is weaker than claimed intent

- Severity: **Low**
- Category: **Test quality / regression protection**
- Problem:
  The test only checks that plan text contains `embedding <=>` and `Limit`; it does not assert index scan node/operator class usage.
- Why it matters:
  Query shape regressions that still contain those substrings may pass while performance/index usage degrades.
- Evidence:
  - `apps/core/src/infrastructure/db/repositories/postgres-knowledge-chunk.repository.integration.test.ts` lines asserting `toContain('embedding <=>')` and `toContain('Limit')`.
- Recommendation:
  Assert stronger EXPLAIN-plan invariants (e.g., index scan node presence under expected fixture conditions) while keeping deterministic tolerance for planner variance.

## Architecture Review

- Layering is largely correct:
  - API routes validate/authenticate and delegate (`knowledge.ts`, `conversations.ts`).
  - Application orchestrates retrieval, GM/Avatar context assembly, and failure policy (`typed-retrieval.service.ts`, `send-message.use-case.ts`, `run-game-master.context.ts`).
  - Domain owns contracts/selection (`knowledge.types.ts`, retrieval selection domain logic).
  - Infrastructure isolates pgvector SQL (`postgres-knowledge-chunk.repository.ts`).
- No direct provider leakage into domain logic was observed.
- Async-by-default principle remains respected for GM execution and non-blocking post-turn updates.
- Main architecture drift risk is contract-mapping duplication, not layer violation.

## Test Review

Strong tests:

- Query embedding boundary: deterministic, all-or-nothing, profile/dimension mismatch, safe diagnostics.
- Typed retrieval semantics: paraphrase fixture, deduplication, visibility mode behavior, controlled failures.
- Postgres repository integration: filtering + ordering + dimension/profile guardrails.
- Send-message retrieval behavior: prompt query reuse and failure isolation.

Weak tests:

- SQL plan compatibility assertion does not strongly prove index usage.
- Higher-tier suite reliability is reduced by provider-skip logging interaction.

Missing / under-proven behavior:

- Stack E2E evidence for this audit run (environment unavailable).
- Contract-evolution robustness of retrieval trace mapping/parsing (no single-source mapper/decoder).

Implementation-coupled tests:

- Some tests verify internal call shapes (e.g., exact retrieval query concatenation), useful for regression but potentially brittle. Balance with more consumer-visible assertions where possible.

## Documentation Gaps

- Clarify local audit workflow prerequisites for stack E2E (explicitly document required stack start command and expected failure mode when unavailable).
- Add a note in testing docs about transient provider skip behavior and console-guard compatibility expectations.
- Document retrieval trace mapper ownership to avoid future duplicated implementations.

## Path to A

Minimal steps to reach A:

1. Fix transient-provider skip logging so `pnpm test:integration-e2e` is green under expected quota/rate-limit conditions.
2. Ensure stack E2E is runnable in audit environments or clearly mark it as environment-gated with non-blocking local behavior.
3. Consolidate retrieval trace mapping/parsing into shared utilities to reduce field-add blast radius.
4. Strengthen SQL EXPLAIN assertions to verify index-compatible execution more directly.
5. Re-run and record: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:coverage`, `pnpm test:integration-e2e`, and (when environment ready) `pnpm test:stack-e2e`.

## Final Recommendation

**Close with debt**

The EPIC behavior is delivered and stable in core gates, but the identified test-reliability and maintainability debts should be scheduled immediately to raise confidence and reduce contract-drift risk.
