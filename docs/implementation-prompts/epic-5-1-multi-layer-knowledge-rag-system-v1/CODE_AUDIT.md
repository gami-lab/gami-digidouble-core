# Code Audit — EPIC 5.1 — Multi-Layer Knowledge & RAG System v1

## Scope audited

Audited the generated implementation prompt pack in `docs/implementation-prompts/epic-5-1-multi-layer-knowledge-rag-system-v1/`, including `README.md`, `00-contract-cleanup.md`, `01-knowledge-domain-and-persistence.md`, `02-ingestion-pipeline-and-job-lifecycle.md`, `03-retrieval-pipelines-by-type.md`, `04-api-contracts-and-stack-e2e.md`, and `05-console-integration-hardening-doc-sync.md`.

Also checked alignment against `docs/VISION.md`, `docs/PRINCIPLES.md`, `docs/ARCHITECTURE.md`, `docs/TECH_STACK.md`, `docs/DATA_MODEL.md`, `docs/API_CONTRACT.md`, `docs/TEST_STRATEGY.md`, `docs/TEST_COVERAGE_PLAN.md`, `docs/EPICS.md`, and `docs/PROJECT_STATUS.md`.

## Executive Summary

The prompt pack is structurally solid and aligned with the repository's architecture, testing discipline, and docs-first workflow. It correctly introduces a 00 contract-cleanup slice, enforces mandatory docs updates, and hard-requires stack-e2e coverage for new APIs.

The main risk is not code quality but execution ambiguity: the pack defines the right slices, but some of the new knowledge/API surfaces are still described at a high level. That is acceptable for a prompt pack, but it means the eventual implementation agent will need to make a few local design choices about route inventory, shared contract ownership, and coverage-doc updates.

## Final Grade

B

## Build Health

- lint: PASS
- typecheck: PASS
- tests: PASS
- coverage: PASS

## Feature Confidence Matrix

| Feature                              | Expected Behavior                                                                     | Evidence                                                                                                               | Confidence (High/Medium/Low) | Notes                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------- |
| Contract cleanup before feature work | EPIC starts with ownership cleanup and duplicate-shape audit                          | `00-contract-cleanup.md` explicitly mandates pre-implementation contract audit and canonical ownership                 | High                         | Good sequencing and clear anti-drift rule                                  |
| Knowledge persistence foundation     | New knowledge entities and schema are implemented before ingestion/retrieval behavior | `01-knowledge-domain-and-persistence.md` defines domain/schema/repository slice                                        | High                         | Clear separation of persistence from behavior                              |
| Ingestion pipeline                   | Sources can be registered, chunked, embedded, and tracked by job state                | `02-ingestion-pipeline-and-job-lifecycle.md` covers lifecycle and retry behavior                                       | Medium                       | Good scope, but source formats and job boundaries remain a little abstract |
| Type-specific retrieval              | Retrieval is separated into `memory`, `world`, and `media` outputs                    | `03-retrieval-pipelines-by-type.md` requires typed pipelines and deterministic merge                                   | High                         | Strong alignment with EPIC objective                                       |
| API contracts and stack-e2e          | New endpoints have explicit validation and required stack-e2e coverage                | `04-api-contracts-and-stack-e2e.md` hard-requires auth, validation, not-found, and TODO-skipped happy path when needed | High                         | This is the strongest slice in the pack                                    |
| Console/admin hardening and doc sync | Console integration, observability, and final docs update are completed               | `05-console-integration-hardening-doc-sync.md` closes the EPIC with doc sync                                           | Medium                       | Good closure slice, but doc targets could be more explicit                 |

## Strengths

- The pack follows the repository's preferred vertical-slice shape and includes a dedicated cleanup phase.
- Every prompt includes the mandatory pre-implementation contract check and final documentation update step.
- The API slice correctly enforces the stack-e2e rule for every new endpoint.
- The sequencing is sensible: persistence first, ingestion second, retrieval third, API surface fourth, console/hardening last.
- The pack is aligned with the project's modular-monolith and explicit-contract principles.

## Findings

### 1. Coverage-doc update is not explicitly required in the final slice

- Severity: Medium
- Category: Documentation alignment / test strategy drift
- Problem: The pack requires `docs/PROJECT_STATUS.md` and example docs to be updated, but it does not explicitly call out `docs/TEST_COVERAGE_PLAN.md` in the closing slice even though EPIC 5.1 introduces new API routes and mandatory stack-e2e tests.
- Why it matters: This repo treats test coverage planning as a first-class contract. If new endpoint/test tiers are added without updating coverage planning, future contributors can miss required suites or misunderstand what belongs in CI.
- Evidence: `05-console-integration-hardening-doc-sync.md` lists examples including `docs/API_CONTRACT.md`, `docs/DATA_MODEL.md`, `docs/ARCHITECTURE.md`, `docs/TEST_STRATEGY.md`, and `docs/EPICS.md`, but not `docs/TEST_COVERAGE_PLAN.md`.
- Recommendation: Add `docs/TEST_COVERAGE_PLAN.md` to the mandatory doc review list for this EPIC, or explicitly state why it is unaffected.

### 2. Route inventory is described by behavior, not by concrete file-level deliverables

- Severity: Medium
- Category: Execution ambiguity
- Problem: The API prompt names the endpoint behaviors but does not enumerate exact route file names or a minimal route matrix. That leaves room for the implementing agent to choose shapes that could diverge from the project's route conventions.
- Why it matters: New API surfaces are the highest-risk area for contract drift. A concrete file inventory reduces the chance of inconsistent route naming or duplicated endpoint ownership.
- Evidence: `04-api-contracts-and-stack-e2e.md` lists required behaviors but not a concrete per-route file plan.
- Recommendation: Expand the API slice with a route table mapping each endpoint to expected route file(s) and corresponding `*.stack-e2e.test.ts` file(s).

### 3. Knowledge-type semantics are correct but still slightly overloaded between source format and retrieval domain

- Severity: Low
- Category: Domain modeling clarity
- Problem: The pack distinguishes `knowledgeType` (`memory | world | media`) from source format, but the persistence slice still leaves room for confusion between ingestion format and retrieval domain.
- Why it matters: This is a common source of future field drift; if the same field is used for both document type and retrieval type, later changes become expensive.
- Evidence: `01-knowledge-domain-and-persistence.md` notes the distinction, but it does not prescribe a concrete schema naming convention for both concepts.
- Recommendation: In implementation, enforce separate fields and names for file/media format versus semantic knowledge domain, and document them in `docs/DATA_MODEL.md`.

### 4. The cleanup prompt is necessary, but it could be more explicit about shared-contract ownership targets

- Severity: Low
- Category: Contract ownership clarity
- Problem: `00-contract-cleanup.md` instructs the agent to audit duplicates and canonical ownership, but it does not name likely shared owners up front beyond general domain/shared boundaries.
- Why it matters: Ambiguity here can slow the first slice and increase the chance that new DTOs are added in the wrong layer.
- Evidence: The prompt references canonical ownership in broad terms but does not point to a likely shared package owner for HTTP-facing knowledge DTOs.
- Recommendation: Add a brief ownership map in the prompt or README so the implementing agent can immediately place response DTOs in the intended shared module.

### 5. The final slice depends on console integration before the backend contract is fully concretized

- Severity: Low
- Category: Sequencing risk
- Problem: The closing prompt mixes console integration, hardening, and doc sync, which is fine, but the readme does not explicitly state that console work is optional if the core API surface already satisfies operator needs.
- Why it matters: If the backend implementation lands cleanly, the console slice could become too broad and delay closure unnecessarily.
- Evidence: `05-console-integration-hardening-doc-sync.md` combines multiple concerns in one final slice.
- Recommendation: If implementation pressure rises, split console integration from final hardening/doc sync so the EPIC can still close with minimal operational surface.

## Architecture Review

The pack respects the repository's modular-monolith structure and avoids asking for speculative framework additions. It keeps domain/persistence, ingestion, retrieval, API, and console concerns in separate slices. The 00 cleanup step is the right safeguard for this EPIC because knowledge retrieval is exactly the kind of area where duplicated DTOs and field drift tend to accumulate.

The largest architectural risk is contract drift during implementation, not the prompt pack itself. The pack appropriately anticipates that risk by requiring canonical ownership checks and shared DTO reuse.

## Test Review

Strong tests required by the pack:

- Mandatory `*.stack-e2e.test.ts` coverage for every new endpoint.
- Auth, validation, and not-found behavior explicitly required.
- Deterministic tests for retrieval selection and repository behavior.
- Integration tests for Postgres-backed persistence.

Weak tests / gaps:

- No explicit requirement to update `docs/TEST_COVERAGE_PLAN.md`.
- The API slice requires stack-e2e tests but does not enumerate the exact route-by-route file matrix.
- The pack does not explicitly require consumer-facing contract tests for typed retrieval payloads beyond general unit/integration coverage.

Implementation-coupled tests to avoid:

- Tests that only assert route handlers call a use case.
- Tests that only inspect mock invocation counts.
- Tests that validate only internal ingestion steps without proving externally observable job state or retrieval output.

## Documentation Gaps

- `docs/TEST_COVERAGE_PLAN.md` should be explicitly reviewed during final doc sync.
- `docs/DATA_MODEL.md` will likely need a precise schema entry for knowledge source format versus semantic knowledge domain.
- `docs/API_CONTRACT.md` will need concrete DTOs and endpoint list additions once implementation lands.
- `docs/ARCHITECTURE.md` may need a small knowledge-module update if new ports/services are added.

## Path to A

Minimal steps to raise this from B to A:

1. Add `docs/TEST_COVERAGE_PLAN.md` to the mandatory final doc review list.
2. Expand the API prompt with a small route table mapping endpoint behavior to file-level deliverables and stack-e2e filenames.
3. Tighten the persistence prompt with a clearer schema naming convention separating source format from semantic knowledge domain.
4. Add a short ownership map for canonical shared DTO placement in `00-contract-cleanup.md`.
5. Keep the final slice narrow enough that console integration can be deferred if backend/API hardening already closes the EPIC.

## Final Recommendation

Close with debt
