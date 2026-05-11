# Code Audit — EPIC 5.1 — Multi-Layer Knowledge & RAG System v1

## Scope audited

Audited the actual EPIC 5.1 code surface in `apps/core`, including the knowledge API route, ingestion service, typed retrieval service, knowledge use cases, repositories, domain contracts, and stack-e2e coverage. Also checked the relevant project docs for alignment: `docs/VISION.md`, `docs/PRINCIPLES.md`, `docs/ARCHITECTURE.md`, `docs/TECH_STACK.md`, `docs/DATA_MODEL.md`, `docs/API_CONTRACT.md`, `docs/TEST_STRATEGY.md`, `docs/TEST_COVERAGE_PLAN.md`, `docs/EPICS.md`, and `docs/PROJECT_STATUS.md`.

## Executive Summary

The code delivers the core EPIC shape: typed knowledge sources, ingestion jobs, chunk persistence, typed retrieval, and a public/admin API surface. The architecture is generally clean and follows the modular-monolith split well.

The main concerns are operational correctness and proof quality. Ingestion can delete existing chunks before a replacement run succeeds, retry handling is not idempotent, memory retrieval is too loosely scoped for the EPIC’s memory promise, and the stack-e2e happy path does not actually require ingestion to succeed. These are meaningful weaknesses for a knowledge system because they can hide data loss or false confidence.

## Final Grade

B

## Build Health

- lint: PASS
- typecheck: PASS
- tests: PASS
- coverage: PASS

## Feature Confidence Matrix

| Feature                       | Expected Behavior                                                             | Evidence                                                                                                                                                                                                 | Confidence | Notes                                           |
| ----------------------------- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------- |
| Knowledge source registration | Source creation validates input and persists canonical source DTOs            | [knowledge.ts](apps/core/src/api/routes/knowledge.ts#L134) and [create-knowledge-source.use-case.ts](apps/core/src/application/use-cases/create-knowledge-source/create-knowledge-source.use-case.ts#L1) | High       | Good route/use-case separation                  |
| Ingestion lifecycle           | Source ingestion creates jobs, updates status, and emits observability events | [knowledge-ingestion.service.ts](apps/core/src/application/services/knowledge/knowledge-ingestion.service.ts#L84)                                                                                        | Medium     | Core flow exists, but failure safety is weak    |
| Typed retrieval               | Retrieval returns separate memory/world/media sections with trace metadata    | [typed-retrieval.service.ts](apps/core/src/application/services/knowledge/typed-retrieval.service.ts#L27)                                                                                                | High       | Domain separation is explicit                   |
| Knowledge API contract        | API exposes source, job, and retrieval endpoints with auth and validation     | [knowledge.ts](apps/core/src/api/routes/knowledge.ts#L253)                                                                                                                                               | High       | Contract surface is clear                       |
| Stack-e2e protection          | Auth, validation, and not-found cases are covered for new endpoints           | [knowledge.stack-e2e.test.ts](apps/core/src/api/routes/knowledge.stack-e2e.test.ts#L1)                                                                                                                   | Medium     | Baseline exists, but the happy path is too weak |

## Strengths

- The code respects the modular-monolith layers reasonably well: routes stay thin, application services own behavior, and infrastructure adapters own persistence.
- The shared contract package is used for API-facing knowledge DTOs instead of route-local shapes, which reduces drift.
- The typed retrieval service is deterministic and separates memory, world, and media outputs instead of flattening everything into one bucket.
- Repository adapters exist for both in-memory and Postgres execution paths, which keeps tests fast while still validating real storage behavior.
- The knowledge route includes admin-safe observability events and payload bounding for retrieval responses.

## Findings

### 1. Ingestion can erase prior chunks before the replacement run succeeds

- Severity: High
- Category: Data safety / operational correctness
- Problem: `KnowledgeIngestionService` deletes all chunks for a source before creating the new set, but there is no transaction or staging step around delete-and-replace.
- Why it matters: If embedding, content loading, or chunk creation fails after the delete, the source can be left with no chunks even though a previous successful ingestion existed. That is data loss, not just a failed refresh.
- Evidence: [knowledge-ingestion.service.ts](apps/core/src/application/services/knowledge/knowledge-ingestion.service.ts#L112-L133)
- Recommendation: Make replacement atomic. Either stage new chunks and swap only after success, or wrap the delete/create sequence in a transaction so a failed run cannot wipe prior knowledge.

### 2. Retry ingestion is not idempotent

- Severity: High
- Category: Operational correctness / duplicate work
- Problem: Retrying a failed job always creates a brand-new queued job, with no check for an already-created retry or any linkage back to the original failure.
- Why it matters: Repeated retry clicks or concurrent operator actions can generate multiple jobs for the same source, creating duplicate work and confusing job history.
- Evidence: [retry-ingestion-job.use-case.ts](apps/core/src/application/use-cases/retry-ingestion-job/retry-ingestion-job.use-case.ts#L15-L45)
- Recommendation: Make retries idempotent by reusing an existing pending/running retry when present, or by storing an explicit retry linkage and refusing duplicate retries for the same failed job.

### 3. Memory retrieval is only softly scoped, not truly filtered

- Severity: Medium
- Category: Retrieval correctness / context safety
- Problem: The retrieval service boosts memory chunks when user/session/conversation metadata matches, but it still queries every ready memory source in the scenario and can surface unrelated memory chunks whenever token overlap exists.
- Why it matters: EPIC 5.1 promises avatar memory as personal history and past interactions. Soft boosts are not enough to keep unrelated memory out of the result set, especially once the scenario has multiple memory sources.
- Evidence: [typed-retrieval.service.ts](apps/core/src/application/services/knowledge/typed-retrieval.service.ts#L57-L87) and [typed-retrieval.service.ts](apps/core/src/application/services/knowledge/typed-retrieval.service.ts#L117-L140)
- Recommendation: Add explicit scope filters or source-level ownership constraints for memory retrieval before ranking, not just after ranking.

### 4. Stack-e2e happy path does not prove ingestion success

- Severity: Medium
- Category: Test quality / false confidence
- Problem: The stack-e2e test accepts either completed or failed ingestion as a pass condition, so the supposed happy path can succeed even when ingestion never completes successfully.
- Why it matters: This weakens the one test that should prove the end-to-end knowledge loop. It can hide broken ingestion while still leaving the suite green.
- Evidence: [knowledge.stack-e2e.test.ts](apps/core/src/api/routes/knowledge.stack-e2e.test.ts#L84-L160)
- Recommendation: Require completed status in the happy path and assert that retrieval returns content tied to the ingested source, not just a bounded string length.

### 5. Retrieval response bounding lives in the route layer as hidden presentation logic

- Severity: Low
- Category: Maintainability / contract clarity
- Problem: The knowledge retrieval route truncates returned content to 800 characters inside the controller instead of through a shared serializer or DTO rule.
- Why it matters: This creates a hidden presentation rule in the route layer. If another consumer needs the same safety rule, it can easily drift or be forgotten.
- Evidence: [knowledge.ts](apps/core/src/api/routes/knowledge.ts#L253-L315)
- Recommendation: Move response bounding into a shared helper or documented DTO policy so the rule is explicit and reusable.

## Architecture Review

The overall architecture is solid. The route layer delegates into application use cases and services, and the repositories stay behind explicit ports. Shared API contracts are canonicalized rather than duplicated in route-local response shapes, which is the right direction for this codebase.

The main architectural weakness is not layer violation but boundary safety. Ingestion replacement is not atomic, retry semantics are not stable under repeated operator action, and retrieval scoping is not strong enough for the memory use case. Those are maintainability and correctness problems, not layering problems.

## Test Review

Strong tests:

- The typed retrieval unit test proves separate memory/world/media output sections and verifies that type filtering prevents cross-domain mixing.
- The repository integration tests validate Postgres persistence for knowledge sources and the ingestion job lifecycle.
- The route validation tests cover auth and schema failures for the new knowledge API surface.

Weak tests:

- The stack-e2e happy path does not require completed ingestion, so it can pass when the core pipeline fails.
- There is no test proving that ingestion replacement preserves the previous chunk set on failure.
- There is no test proving retry idempotency for repeated retries of the same failed job.
- There is no test proving memory retrieval is actually scoped tightly enough to avoid unrelated memory results.

Implementation-coupled tests:

- The stack-e2e assertion that retrieved content length is bounded to roughly the current route cap is tied to the controller’s truncation policy rather than a consumer-observed contract.

## Documentation Gaps

- `docs/API_CONTRACT.md` should be updated with the knowledge endpoints, request/response DTOs, and any response bounding rules.
- `docs/DATA_MODEL.md` should reflect the knowledge source/chunk/job persistence model and any scope fields required for memory retrieval.
- `docs/TEST_COVERAGE_PLAN.md` should explicitly call out the new knowledge module coverage expectations, especially retry idempotency and ingestion failure safety.
- `docs/PROJECT_STATUS.md` should be updated to record the knowledge/RAG implementation status and any remaining debt.

## Path to A

Minimal steps needed to reach A:

1. Make ingestion replacement atomic so a failed run cannot delete the last good chunk set.
2. Add retry idempotency and explicit retry linkage for ingestion jobs.
3. Tighten memory retrieval scoping so unrelated memory data cannot bleed into results.
4. Strengthen the stack-e2e happy path to require successful ingestion and source-tied retrieval evidence.
5. Move response bounding into a shared serializer/helper and update the docs that define the contract.

## Final Recommendation

Close with debt
