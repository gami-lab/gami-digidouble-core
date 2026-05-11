# Code Audit — EPIC 5.2 Context Engine v2 (Core Orchestrator)

## Scope audited

EPIC scope audited from:

- docs/implementation-prompts/epic-5-2-context-engine-v2/README.md
- apps/core context engine domain module
- apps/core integration points in send-message, run-game-master, and admin session-context flows
- related API/shared contracts and route mappers
- unit and route tests tied to deterministic assembly, precedence, token budgeting, and context trace surfaces

Project alignment references reviewed:

- docs/VISION.md
- docs/PRINCIPLES.md
- docs/ARCHITECTURE.md
- docs/TECH_STACK.md
- docs/DATA_MODEL.md
- docs/API_CONTRACT.md
- docs/TEST_STRATEGY.md
- docs/TEST_COVERAGE_PLAN.md
- docs/EPICS.md
- docs/PROJECT_STATUS.md

## Executive Summary

EPIC 5.2 delivered a meaningful architectural improvement: a canonical Context Engine with explicit policy, traceability, and integration across Avatar, GM, and admin inspection surfaces. Internal domain contracts are clearer than before, and deterministic selection/precedence behavior is implemented with useful tests.

Build health is green on all mandatory checks.

Main risk blocking an A grade: token-budget enforcement is not fully consistent across projections. Specifically, GM retrieval knowledge can bypass budget trimming logic due to pre-population in base output, while trimming logic is applied through candidate selection primarily for avatar retrieval segments. This creates a policy-vs-runtime divergence in a core EPIC requirement.

## Final Grade

**B**

## Build Health

- lint: PASS
- typecheck: PASS
- tests: PASS
- coverage: PASS (`pnpm test:coverage` completed successfully for @gami/core)

Executed commands:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:coverage`

## Feature Confidence Matrix

| Feature                                      | Expected Behavior                                                                       | Evidence                                                                                                                                                                                                                                                        | Confidence (High/Medium/Low) | Notes                                                                                            |
| -------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------ |
| Canonical Context Engine contracts           | One internal canonical input/output/trace contract and policy ownership                 | `apps/core/src/domain/context/context-engine.types.ts`, `apps/core/src/domain/context/session-context.types.ts`, `apps/core/src/domain/context/context-engine.policy.ts`                                                                                        | High                         | Ownership and boundaries are explicit and coherent                                               |
| Deterministic precedence and trimming        | Deterministic order, protected segments, budget trimming with explainable trace         | `apps/core/src/domain/context/context-engine.service.ts`, `apps/core/src/domain/context/context-engine.service.test.ts`                                                                                                                                         | Medium                       | Deterministic behavior is strong; projection-level budget consistency has a gap                  |
| Shared assembly path for Avatar/GM contexts  | Avatar and GM context assembled from one engine pass in key flows                       | `apps/core/src/application/use-cases/get-session-context/get-session-context.use-case.ts`, `apps/core/src/application/use-cases/send-message/send-message.use-case.ts`, `apps/core/src/application/use-cases/run-game-master/run-game-master.context-engine.ts` | Medium                       | Mostly achieved; GM recent-message enrichment still has ad-hoc augmentation outside engine       |
| Admin context observability (`contextTrace`) | Bounded, explainable trace exposed through stable DTO mapping with redaction discipline | `apps/core/src/api/routes/mappers/session-context.mapper.ts`, `apps/core/src/api/routes/admin-session-context.test.ts`, `apps/core/src/api/routes/admin-session-context.stack-e2e.test.ts`                                                                      | High                         | Good bounds and redaction tests; good operational visibility                                     |
| Contract cleanup and boundary mapping        | Internal contracts separated from shared API DTOs via mapper                            | `apps/core/src/api/routes/mappers/session-context.mapper.ts`, `packages/shared/src/runtime-inspector-types.ts`                                                                                                                                                  | Medium                       | Better than previous state; shared trace segment typing is permissive (`string`) and drift-prone |

## Strengths

- Strong modular boundary direction: domain context engine is framework-agnostic and reusable.
- Deterministic trace model is explicit and useful for operations and debugging.
- Good route-level auth/not-found/happy-path coverage for admin session-context endpoint.
- Integration reached all critical surfaces: send-message, GM pipeline, and admin inspection.
- Build health and test suite are stable and passing.

## Findings

### GM Retrieval Budget Bypass in Context Engine

- Severity: High
- Category: Architecture / Functional completeness
- Problem: GM retrieval knowledge is pre-populated in base output before candidate selection and trimming, while retrieval candidates/trimming are applied on avatar projection. This means token-budget policy is not consistently enforced for GM retrieval segments.
- Why it matters: EPIC DoD requires explicit, testable, consistently enforced token-budget rules. Policy/runtime divergence can produce oversized or inconsistent GM context and reduce predictability.
- Evidence:
  - `apps/core/src/domain/context/context-engine.service.ts` (`buildBaseOutput` assigns `gm.knowledge` directly when retrieval exists)
  - `apps/core/src/domain/context/context-engine.service.ts` (`pushRetrievalSegmentCandidate` only applies retrieval candidates to avatar projection)
- Recommendation: Move GM retrieval inclusion behind candidate-based selection (same as avatar) and add projection-specific trimming tests proving both avatar and GM obey policy budgets.

### Partial Parallel Composition in GM Input Path

- Severity: Medium
- Category: Architecture quality
- Problem: GM recent message construction appends working-memory text as a synthetic `system` message before assembly, while memory is also represented through context engine memory fields.
- Why it matters: This weakens the single-pipeline intent and creates hidden coupling between pre-assembly shaping and post-assembly context semantics.
- Evidence:
  - `apps/core/src/application/use-cases/run-game-master/run-game-master.use-case.ts` (`loadRecentMessages` appends `toWorkingMemoryPromptContext(...)`)
  - `apps/core/src/application/use-cases/run-game-master/run-game-master.context-engine.ts` (engine still assembles memory context)
- Recommendation: Consolidate working-memory projection rules in Context Engine and keep `recentMessages` as pure chronological messages.

### Shared Trace Contract Too Permissive for Segment IDs

- Severity: Medium
- Category: Structural maintainability
- Problem: Shared API trace DTO uses `string` for segment identifiers and policy arrays instead of a bounded union.
- Why it matters: Increases drift risk between domain policy segment IDs and API contract, reducing compile-time safety and making future field additions less reliable.
- Evidence:
  - `packages/shared/src/runtime-inspector-types.ts` (`SessionContextTrace` uses `string[]` and `segmentId: string`)
  - `apps/core/src/domain/context/context-engine.policy.ts` defines strict `ContextSegmentId` union
- Recommendation: Export a shared segment-id union contract (or generated type) and map domain IDs to that union to preserve strict compile-time alignment.

### Integration Tests Validate Shape More Than Behavioral Equivalence

- Severity: Medium
- Category: Test quality
- Problem: Some integration assertions confirm assembled context object presence/shape but do not prove cross-flow behavioral equivalence for key context decisions.
- Why it matters: This can permit regressions where shape remains valid but selected/trimmed content behavior diverges from consumer expectations.
- Evidence:
  - `apps/core/src/application/use-cases/send-message/send-message.use-case.test.ts` (asserts presence of `assembledContext.avatar/gm/trace`)
- Recommendation: Add consumer-outcome tests that assert specific selected/trimmed effects on generated prompt inputs and GM payload content under constrained policy budgets.

### Project Status and EPIC Closure Signal Are Out of Sync

- Severity: Low
- Category: Documentation alignment
- Problem: Project status marks EPIC 5.2 as in progress while implementation notes and quality gates indicate near-completion.
- Why it matters: Operational clarity and governance confidence suffer when closure state differs from technical reality.
- Evidence:
  - `docs/PROJECT_STATUS.md` (EPIC 5.2 = in progress)
- Recommendation: Update closure status once final audit actions and debt disposition are accepted.

## Architecture Review

- Layering is mostly respected: Context Engine logic resides in domain; API route remains thin and uses boundary mapper; use cases orchestrate repositories and assembly.
- No major provider leakage into domain context module observed.
- Boundary mapping quality improved compared with prior contract duplication patterns.
- Key drift risk remains in mixed composition responsibilities (GM recent-message augmentation outside engine) and non-unified budget application across projections.

## Test Review

Strong tests:

- `apps/core/src/domain/context/context-engine.service.test.ts` covers deterministic assembly, precedence, trimming, and conflict dedupe.
- `apps/core/src/application/use-cases/get-session-context/get-session-context.use-case.test.ts` validates bounded assembled context outputs.
- `apps/core/src/api/routes/admin-session-context.test.ts` and stack-e2e counterpart validate auth, not-found, bounded trace, and redaction concerns.

Weak tests:

- Cross-flow behavior proof between send-message assembled context and actual prompt/GM downstream behavior is limited.

Missing tests:

- Explicit test proving GM retrieval segments are budget-trimmed (or protected by policy) equivalently to avatar.
- Regression test that removing ad-hoc GM recent-message augmentation does not degrade required GM behavior when engine-provided memory is present.

Implementation-coupled tests:

- Assertions that only check object presence/shape (for assembled context) without validating consumer-observable consequences.

## Documentation Gaps

- EPIC closure signal in `docs/PROJECT_STATUS.md` should be reconciled with current implementation and audit outcome.
- If token-budget semantics are intentionally asymmetric by projection, document that explicitly in context engine policy/docs; currently this is implied to be uniform.

## Path to A

Minimal steps required:

1. Enforce token-budget selection consistently for GM retrieval segments through candidate-based assembly.
2. Add high-signal behavior tests for projection-specific trimming outcomes (avatar + GM) under constrained budgets.
3. Reduce cross-layer drift risk by tightening shared trace segment typing.
4. Remove or justify ad-hoc GM recent-message memory augmentation outside the engine pipeline.
5. Align `docs/PROJECT_STATUS.md` EPIC 5.2 status with accepted closure and debt decisions.

## Final Recommendation

**Close with debt**

Rationale:

- Core EPIC value is delivered and operationally usable.
- Build health is green.
- Remaining debt is meaningful but bounded and can be addressed in a short hardening pass.
