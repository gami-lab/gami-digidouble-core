# Code Audit — EPIC 4.2d Memory Domain Separation

## Scope audited

- EPIC definition and DoD: `docs/implementation-prompts/epic-4-2d-memory-domain-separation/README.md`
- Governing docs reviewed: `docs/VISION.md`, `docs/PRINCIPLES.md`, `docs/ARCHITECTURE.md`, `docs/TECH_STACK.md`, `docs/DATA_MODEL.md`, `docs/API_CONTRACT.md`, `docs/TEST_STRATEGY.md`, `docs/TEST_COVERAGE_PLAN.md`, `docs/EPICS.md`, `docs/PROJECT_STATUS.md`
- Main implementation surfaces sampled: knowledge source API boundary, typed retrieval service, context snapshot contracts, send-message memory-maintenance boundary, reset-session boundary, admin session-context routes, legacy memory audit/migration logic
- Required commands run: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:coverage`

## Executive Summary

The EPIC is substantively implemented and the architecture is aligned with the intended modular-monolith boundaries. The core separation is visible in the code: static knowledge is normalized and constrained to `avatar_knowledge | world | media`, retrieval is scenario-scoped and visibility-bounded, and runtime context exposes separate `conversationState` and `retrievedContext` sections for Avatar and GM.

The main closure problem is build health, not missing primary behavior. `pnpm lint` and `pnpm typecheck` pass, and `pnpm test:coverage` passes, but the mandatory `pnpm test` gate currently fails on an EPIC-specific test in `typed-retrieval.service.test.ts`. That failure is not exposing a broken domain boundary; it exposes brittle test design that compares transient timing diagnostics as if they were deterministic retrieval identity. Because the required repo-wide test gate is red, this EPIC should not be treated as safely closed yet.

## Final Grade

`C`

Rationale: the feature set is largely delivered and the architecture is clean, but the required test gate is failing, some of the strongest EPIC claims rely on environment-gated evidence, and one key proof is implementation-coupled rather than consumer-oriented.

## Build Health

- lint: PASS
- typecheck: PASS
- tests: FAIL
- coverage: PASS (`pnpm test:coverage` completed successfully)

Observed test failure:

- `apps/core/src/application/services/knowledge/typed-retrieval.service.test.ts:306`
- Failing case: `returns identical static candidates for callers with the same scenario and Avatar visibility`
- Failure mode: exact object equality mismatch on `trace.timings.totalMs` (`1` vs `0`)

## Feature Confidence Matrix

| Feature                                                        | Expected Behavior                                                                                           | Evidence                                                                                                                   | Confidence | Notes                                                                                        |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------- |
| Static terminology migration boundary                          | Legacy `memory` input is accepted only at API migration boundary, normalized immediately, and never emitted | `knowledge-sources-management.test.ts`; API contract docs; knowledge type input normalizer                                 | High       | Strong contract-level proof at API boundary                                                  |
| Static retrieval domain separation                             | Retrieval uses only scenario, canonical type, active corpus, visibility, and explicit GM bypass             | `typed-retrieval.service.ts`; `typed-retrieval.service.test.ts`; vector repository tests                                   | Medium     | Domain behavior appears correct, but one EPIC-specific determinism test is currently failing |
| Conversation State vs Retrieved Context separation             | Avatar and GM inputs expose separate runtime sections with distinct provenance                              | `session-context.types.ts`; `persona-prompt.service.test.ts`; `admin-session-context.test.ts`; `gm-input-renderer.test.ts` | High       | Good structural and contract proof                                                           |
| Conversational memory lifecycle isolation                      | Reset/clear operations remove owned memory without mutating static knowledge                                | `reset-session.use-case.test.ts` including `does not mutate scenario knowledge while clearing session memory`              | High       | Good deterministic ownership proof                                                           |
| Retrieved knowledge does not become memory by prompt inclusion | Retrieved context is not forwarded into memory-maintenance input                                            | `send-message.use-case.test.ts`                                                                                            | Medium     | Important invariant is tested, but proof is implementation-coupled to call shape             |
| Operator diagnostics separation                                | Admin/runtime surfaces distinguish static categories from working/episodic/long-term memory                 | `admin-session-context.test.ts`; `admin-memory.test.ts`; retrieval presenter tests                                         | Medium     | Strong route-level evidence, but some stack/runtime evidence remains environment-gated       |
| Legacy row audit and quarantine                                | Ambiguous legacy static rows are classified safely and quarantined rather than silently converted           | `legacy-memory-audit.test.ts`; `legacy-memory-migration.test.ts`                                                           | High       | Good deterministic proof                                                                     |

## Strengths

- The architecture respects the intended layering. The normalization of legacy knowledge types is kept at the API boundary instead of leaking into application or domain logic.
- Runtime contracts clearly separate conversational memory from retrieved static knowledge. This is visible both in internal snapshot types and in prompt rendering tests.
- The EPIC avoids inventing unnecessary endpoints and mostly reuses existing inspection and knowledge-management surfaces.
- Static knowledge validation rejects reserved conversational scope keys recursively, which is the right enforcement point for this boundary.
- The documentation set is unusually thorough, especially the ownership map and the requirements-to-tests matrix.

## Findings

### Repo-wide test gate is currently red

- Severity: High
- Category: Test quality / Release readiness
- Problem: The mandatory `pnpm test` command fails in the current workspace state.
- Why it matters: The audit prompt explicitly requires build verification. A red repo-wide test gate blocks an `A` grade and should block EPIC closure.
- Evidence: `pnpm test` failed in `apps/core/src/application/services/knowledge/typed-retrieval.service.test.ts:306` because `trace.timings.totalMs` differed between two otherwise equivalent retrieval calls.
- Recommendation: Make the EPIC-specific shared-retrieval test assert deterministic retrieval behavior, not exact wall-clock diagnostic values.

### Shared-retrieval proof is brittle and implementation-coupled

- Severity: Medium
- Category: Test quality
- Problem: The test named `returns identical static candidates for callers with the same scenario and Avatar visibility` compares full result equality, including transient timing diagnostics.
- Why it matters: The consumer requirement is stable retrieval identity and isolation semantics, not identical elapsed milliseconds. This creates false negatives and weakens confidence in the suite.
- Evidence: `apps/core/src/application/services/knowledge/typed-retrieval.service.test.ts` expects `callerBResult` to equal `callerAResult`, while `TypedRetrievalService` computes timing fields from `Date.now()` in `typed-retrieval.service.ts`.
- Recommendation: Assert on the stable fields that matter to the contract: selected chunk IDs, per-type results, visibility mode, and bounded trace shape. Exclude or separately bound timing diagnostics.

### Documentation overstates closure status relative to current gates

- Severity: Medium
- Category: Documentation alignment
- Problem: The shipped-status docs state that final gates passed for EPIC 4.2d on 2026-09-10, but the current repo-wide `pnpm test` gate is failing.
- Why it matters: Closure documents are being used as audit evidence. If they drift from the current executable state, they reduce trust in the project’s status reporting.
- Evidence: `docs/PROJECT_STATUS.md` says final gates passed for Core/workspace packages on 2026-09-10; current command execution shows `pnpm test` failing in an EPIC 4.2d test.
- Recommendation: Update status wording so it matches the current repository state, or land the test fix before keeping closure language.

### Some closure-critical EPIC evidence is environment-gated

- Severity: Medium
- Category: Test strategy / Operational quality
- Problem: Some of the strongest end-to-end lifecycle claims still rely on PostgreSQL-gated or stack-gated suites rather than always-on deterministic checks.
- Why it matters: Environment-gated evidence is useful, but it is weaker as a closure criterion when the EPIC claim is foundational boundary enforcement.
- Evidence: `docs/EPIC_4_2D_REQUIREMENTS_MATRIX.md` explicitly notes PostgreSQL and stack suites are environment-gated; scenario-deletion cascade and stack contract evidence are not always-on.
- Recommendation: Keep the DB/stack tests, but add one or two additional deterministic proofs for the most important lifecycle invariants when possible.

### Non-contamination proof relies on internal call-shape assertions more than external behavior

- Severity: Medium
- Category: Test quality
- Problem: One of the key EPIC invariants, that retrieved knowledge must not become conversational memory just because it appeared in prompt context, is proven primarily by asserting the absence of a property on an internal service call.
- Why it matters: This is closer to implementation mirroring than consumer-observable proof. A refactor could preserve the call shape while still violating the user-visible boundary elsewhere.
- Evidence: `apps/core/src/application/use-cases/send-message/send-message.use-case.test.ts` asserts `memoryMaintenanceExecuteMock.mock.calls[0]?.[0]` does not have `retrievedContext`.
- Recommendation: Add a higher-level behavioral test around fact extraction or persisted memory outputs showing retrieved static documents do not become stored facts without allowed provenance.

## Architecture Review

Architecture quality is good.

- API layer owns migration compatibility and metadata validation.
- Application services own orchestration and retrieval composition.
- Domain contracts define the separation explicitly in context snapshot types.
- Infrastructure concerns remain in repositories and adapters.
- No vendor leakage into memory or retrieval domain logic was apparent in the audited slice.

The main concern is not architecture drift. It is closure confidence: the architecture looks correct, but one red deterministic test and a few proof-shape weaknesses reduce audit confidence.

## Test Review

Strong tests:

- `knowledge-sources-management.test.ts` proves legacy alias normalization and canonical output.
- `reset-session.use-case.test.ts` proves reset clears memory without mutating scenario knowledge.
- `persona-prompt.service.test.ts` proves `Conversation State` and `Retrieved Context` are rendered as separate sections.
- `admin-session-context.test.ts` proves session context surfaces do not leak another session’s conversational state.
- `legacy-memory-audit.test.ts` and `legacy-memory-migration.test.ts` provide deterministic coverage for quarantine-safe legacy handling.

Weak tests:

- `typed-retrieval.service.test.ts` shared-candidate equality proof is too strict because it includes wall-clock timing diagnostics.
- `send-message.use-case.test.ts` non-contamination proof is heavily call-shape-based rather than behavior-result-based.

Missing or weaker-than-ideal tests:

- An always-on deterministic test that proves closure-critical lifecycle boundaries now covered only in DB/stack-gated suites.
- A consumer-facing test that proves persisted facts/memory outputs remain clean after retrieved static content is used in prompts.

Implementation-coupled tests:

- `send-message.use-case.test.ts` assertion on absence of `retrievedContext` in memory-maintenance input.
- `typed-retrieval.service.test.ts` full-result equality including timing metadata.

## Documentation Gaps

- `docs/PROJECT_STATUS.md` should not continue to claim final 2026-09-10 gate success while the current required `pnpm test` gate is failing.
- If the shared-retrieval determinism claim is intended to exclude timing diagnostics, the wording in `docs/EPIC_4_2D_REQUIREMENTS_MATRIX.md` should make that explicit.

## Path to A

Minimal steps needed to reach `A`:

1. Fix the failing `pnpm test` gate by rewriting the shared-retrieval determinism assertion to ignore transient timing fields.
2. Add one higher-level behavioral test proving retrieved static content does not become stored memory/facts without allowed provenance.
3. Add at least one deterministic always-on proof for a lifecycle invariant currently covered only in DB/stack-gated suites, or narrow the documentation claim so it matches the actual always-on evidence.
4. Update `docs/PROJECT_STATUS.md` after the gate is green so executable status and documented status align.

## Final Recommendation

`Rework before close`

Reason: the EPIC implementation is close and mostly sound, but the required repo-wide test gate is currently failing, which is enough to block safe closure.
