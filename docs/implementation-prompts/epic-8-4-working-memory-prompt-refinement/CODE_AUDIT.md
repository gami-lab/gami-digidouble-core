# Code Audit — EPIC 8.4: Working Memory Prompt Refinement

## Scope audited

- EPIC definition: `docs/implementation-prompts/epic-8-4-working-memory-prompt-refinement/README.md`
- EPIC execution slices reviewed:
  - `00-contract-cleanup.md`
  - `01-covered-topics-contract-and-persistence.md`
  - `02-memory-compaction-prompt-and-normalization.md`
  - `03-gm-context-and-debug-surface-alignment.md`
  - `04-tests-hardening-and-doc-sync.md`
- Primary implementation reviewed:
  - `apps/core/src/domain/memory/memory.types.ts`
  - `apps/core/src/application/services/memory-maintenance.service.ts`
  - `apps/core/src/application/services/memory-selection.service.ts`
  - `apps/core/src/domain/game-master/gm-input-renderer.ts`
  - `apps/core/src/application/use-cases/run-game-master/run-game-master.context-engine.ts`
  - `apps/core/src/domain/context/session-context.types.ts`
  - `apps/core/src/api/routes/mappers/session-context.mapper.ts`
  - `apps/core/src/application/services/runtime-inspector-event-context.ts`
  - `apps/core/src/application/use-cases/list-session-events/list-session-events.use-case.ts`
  - `apps/core/src/application/use-cases/get-session-memory-layers/get-session-memory-layers.use-case.ts`
  - `apps/console/src/components/runtime-inspector-tab-content.tsx`
  - `apps/console/src/components/gm-impact-trace.ts`
  - `packages/shared/src/memory-contract-types.ts`
  - `packages/shared/src/runtime-inspector-types.ts`
- Alignment docs reviewed:
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
  - `docs/MEMORY_SYSTEM_SPEC.md`
  - `docs/GAME_MASTER_CONTRACT.md`

## Executive Summary

EPIC 8.4 is only partially delivered.

The strong part is the canonical working-memory model itself: `coveredTopics` exists in the domain contract, persists correctly through in-memory and Postgres repositories, is produced by the compaction prompt path, and is accepted by the GM runtime input renderer. The implementation stays within the modular-monolith boundaries, keeps persistence replaceable, and ships with clean build health.

The EPIC is not closeable because the structured working-memory refinement stops before the operator/debug surfaces that the README and slice `03` explicitly require. `coveredTopics` reaches the GM prompt, but the session-context snapshot, recorded GM context, GM impact trace, and runtime inspector still collapse that input back to `workingSummary` or omit it entirely. The tests also stop short of proving the critical end-to-end observable behaviors for those surfaces.

## Final Grade

**C**

## Build Health

- lint: PASS
- typecheck: PASS
- tests: PASS
- coverage: PASS (`pnpm test:coverage` runs `@gami/core` only; 86.89% statements, 84.86% branches, 96.30% functions, 86.89% lines)

## Feature Confidence Matrix

| Feature                                | Expected Behavior                                                                                                                  | Evidence                                                                                                                                                      | Confidence | Notes                                                                                            |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------ |
| Canonical working-memory contract      | `coveredTopics` exists on the canonical working-memory model and shared memory DTOs without contract drift                         | `apps/core/src/domain/memory/memory.types.ts`; `packages/shared/src/memory-contract-types.ts`                                                                 | High       | Clear ownership and additive field propagation in core memory contracts                          |
| Persistence compatibility              | `coveredTopics` persists through repository paths and old rows default safely to `[]`                                              | `apps/core/src/infrastructure/db/in-memory-conversation-working-memory.repository.ts`; `postgres-conversation-working-memory.repository.ts`; repository tests | High       | Backward-safe persistence is well covered                                                        |
| Compaction prompt and normalization    | Working-memory compaction produces bounded summary, `coveredTopics`, unresolved-thread carry-forward, and objective fact filtering | `apps/core/src/application/services/memory-maintenance.service.ts`; `memory-maintenance.service.test.ts`                                                      | High       | Strong deterministic normalization coverage                                                      |
| GM runtime consumption                 | GM prompt can consume `coveredTopics` directly without re-inferring from the summary                                               | `apps/core/src/domain/game-master/gm-input-renderer.ts`; `gm-input-renderer.test.ts`                                                                          | Medium     | Runtime path exists, but use-case boundary test does not assert `coveredTopics` end to end       |
| Session-context / inspector visibility | Operators can inspect the richer working-memory shape in GM-facing context and debug surfaces                                      | `run-game-master.context-engine.ts`; `session-context.types.ts`; `runtime-inspector-tab-content.tsx`; `gm-impact-trace.ts`                                    | Low        | Structured fields are dropped or not rendered on GM/operator paths                               |
| Event/debug visibility                 | Recorded GM context and event-derived debug tools expose the richer memory shape consistently                                      | `runtime-inspector-event-context.ts`; `list-session-events.use-case.ts`; `gm-impact-trace.ts`                                                                 | Low        | Event/debug path remains summary-only                                                            |
| Documentation and closure readiness    | Status/docs accurately reflect completed EPIC scope and close-out state                                                            | `docs/PROJECT_STATUS.md`; EPIC README and slice docs                                                                                                          | Low        | Project status still marks the EPIC in progress and only documents slices `00`-`02` as completed |

## Strengths

- The implementation respects the architecture:
  - no business logic in API handlers
  - no provider leakage into domain contracts
  - persistence concerns remain in repository adapters
  - GM remains async and non-blocking
- The working-memory ownership cleanup was done well:
  - canonical domain contract in `apps/core/src/domain/memory/memory.types.ts`
  - canonical shared DTO fragments in `packages/shared/src/*memory*`
  - compatibility fallbacks for legacy rows are explicit
- The compaction refinement is pragmatic:
  - bounded lists
  - bounded summary
  - exact duplicate removal
  - malformed fact rejection
  - rejected inferred conversational-state facts
- Build health is strong. All required gates passed.

## Findings

### GM session-context snapshots still drop structured working-memory fields

- Severity: High
- Category: Functional Completeness / Contract Drift
- Problem:
  The GM-facing session-context snapshot still stores only `workingSummary` instead of the structured working-memory object that now includes `coveredTopics` and `unresolvedThreads`.
- Why it matters:
  Slice `03` explicitly requires admin/session-context alignment with the richer working-memory shape. Today an operator inspecting the GM context cannot verify what structured memory the GM actually consumed, which weakens debuggability and breaks the EPIC’s intended downstream usefulness.
- Evidence:
  `apps/core/src/application/use-cases/run-game-master/run-game-master.context-engine.ts:27-33`
  `apps/core/src/domain/context/session-context.types.ts:73-82`
  `packages/shared/src/runtime-inspector-types.ts:276-282`
  `apps/core/src/api/routes/mappers/session-context.mapper.ts:71-96`
- Recommendation:
  Add a bounded structured GM memory fragment to the session-context snapshot and shared DTOs, sourced from the canonical working-memory model, then map it through the existing session-context route.

### Recorded GM event context and GM impact trace remain summary-only

- Severity: High
- Category: Operational Quality / Observability
- Problem:
  The recorded GM context path still serializes only `workingSummary`, and the GM impact trace renders only that summary.
- Why it matters:
  The EPIC promised richer working memory for downstream orchestration and operator tooling. If the runtime event/debug path strips the structured fields, support and regression analysis still require re-inferring topic coverage from free text.
- Evidence:
  `apps/core/src/application/services/runtime-inspector-event-context.ts:49-56`
  `apps/core/src/application/use-cases/list-session-events/list-session-events.use-case.ts:598-612`
  `apps/console/src/components/gm-impact-trace.ts:395-400`
  `apps/console/src/components/gm-impact-trace.test.ts:199-229`
- Recommendation:
  Extend the recorded GM context memory fragment to include bounded structured working-memory fields and update GM impact trace rendering to show them safely.

### Runtime inspector memory UI does not render `coveredTopics`

- Severity: Medium
- Category: Functional Completeness / UX Contract
- Problem:
  The runtime inspector memory tab shows the summary, unresolved-thread count, and candidate-fact count, but does not show `coveredTopics` at all even when the view model carries them.
- Why it matters:
  Slice `03` requires console/runtime-inspector consumers to expose the richer memory shape. Right now the new field exists in the model and test fixtures but is invisible to operators.
- Evidence:
  `apps/console/src/components/runtime-inspector-tab-content.tsx:201-214`
  `apps/console/src/components/runtime-inspector-tab-content.test.tsx:119-126`
  `apps/console/src/components/runtime-inspector-tab-content.test.tsx:575-583`
- Recommendation:
  Render at least a bounded `coveredTopics` row in the memory tab, ideally as a compact inline list or count plus items, and add assertions that prove it is visible.

### Critical observable behaviors are not proven by consumer-boundary tests

- Severity: High
- Category: Test Quality
- Problem:
  Several tests seed `coveredTopics` but do not assert that consumers can actually observe it. The GM use-case boundary test proves summary and unresolved-thread propagation, not `coveredTopics`. The session-context route test and console tests likewise seed the field without asserting it appears on the response or UI.
- Why it matters:
  This repo explicitly values tests that prove consumer-observable behavior. Green tests here give false confidence because the most important EPIC-specific behavior is exactly what remains unasserted.
- Evidence:
  `apps/core/src/application/use-cases/run-game-master/run-game-master.memory-input.use-case.test.ts:200-206`
  `apps/core/src/api/routes/admin-session-context.test.ts:115-125`
  `apps/core/src/application/use-cases/list-session-events/list-session-events.use-case.test.ts:563-608`
  `apps/console/src/components/runtime-inspector-tab-content.test.tsx:119-126`
  `apps/console/src/components/runtime-inspector-tab-content.test.tsx:575-583`
- Recommendation:
  Add consumer-boundary assertions for:
  - GM prompt rendering of `coveredTopics` in the real use-case path
  - session-context/admin/event payload exposure of structured working memory where required
  - runtime inspector and GM impact trace rendering of `coveredTopics`

### Documentation does not support closing the EPIC

- Severity: Medium
- Category: Documentation Alignment
- Problem:
  `docs/PROJECT_STATUS.md` still marks EPIC 8.4 as `In progress` and only records slices `00` and `02` as completed. That matches the code audit outcome, but it also means the EPIC is not documented as complete and should not be closed.
- Why it matters:
  The README definition of done requires `docs/PROJECT_STATUS.md` and impacted source-of-truth docs to be accurate before closure. The current documentation state itself is evidence that the EPIC has not reached its end-of-EPIC completion bar.
- Evidence:
  `docs/PROJECT_STATUS.md:1079-1126`
  `docs/implementation-prompts/epic-8-4-working-memory-prompt-refinement/README.md:43-53`
  `docs/implementation-prompts/epic-8-4-working-memory-prompt-refinement/03-gm-context-and-debug-surface-alignment.md:11-15`
  `docs/implementation-prompts/epic-8-4-working-memory-prompt-refinement/03-gm-context-and-debug-surface-alignment.md:64-67`
- Recommendation:
  Do not close the EPIC yet. Finish slice `03` behavior, add slice `04` proof, then update `PROJECT_STATUS.md` and any contract docs impacted by the GM/session-context/event/debug surfaces.

## Architecture Review

The implementation remains architecturally disciplined.

- API, Application, Domain, and Infrastructure boundaries are still clean.
- The new field is owned canonically in the memory domain instead of leaking through ad hoc JSON shapes.
- Repository adapters remain replaceable.
- Prompt and normalization logic stay out of controllers.
- The async memory refresh lifecycle remains intact and non-blocking.

The main architecture issue is not a layer violation. It is a projection inconsistency: the structured working-memory model is canonical in the domain, but several GM/operator projections still collapse back to the older summary-only mirror. That increases future drift risk because downstream consumers now have two competing practical shapes:

- canonical runtime input: `workingMemory.summary + unresolvedThreads + coveredTopics`
- operator/debug mirror: `workingSummary`

That inconsistency is exactly the kind of additive-field blast-radius problem this EPIC was supposed to reduce.

## Test Review

Strong tests:

- `apps/core/src/application/services/memory-maintenance.service.test.ts`
  - good deterministic proof of prompt contract, bounded normalization, malformed fact rejection, and unresolved-thread carry-forward
- `apps/core/src/infrastructure/db/repositories/postgres-conversation-working-memory.repository.integration.test.ts`
  - good repository-level proof for persistence and legacy-row fallback
- `apps/core/src/domain/game-master/gm-input-renderer.test.ts`
  - proves the renderer itself can serialize `coveredTopics`
- `apps/core/src/application/services/memory-selection.service.test.ts`
  - proves selected working memory carries `coveredTopics`

Weak tests:

- `apps/core/src/application/use-cases/run-game-master/run-game-master.memory-input.use-case.test.ts`
  - seeds `coveredTopics` but does not assert it in the rendered GM prompt
- `apps/core/src/api/routes/admin-session-context.test.ts`
  - seeds `coveredTopics` but only asserts summary-oriented context fields
- `apps/console/src/components/runtime-inspector-tab-content.test.tsx`
  - seeds `coveredTopics` in the view model but never checks for UI visibility
- `apps/core/src/application/use-cases/list-session-events/list-session-events.use-case.test.ts`
  - labels the payload as “full memory fields” but omits `coveredTopics`

Missing tests:

- one use-case or route-level proof that GM prompt consumers observe `coveredTopics`
- one session-context or recorded-event proof that operators can inspect the richer GM memory shape when required
- one console/GM impact trace assertion proving the new field is visible to operators

Implementation-coupled tests:

- Not a major problem in this EPIC slice overall. The larger issue is omission, not over-coupling.

## Documentation Gaps

- `docs/PROJECT_STATUS.md`
  - should remain `In progress` until slice `03` and slice `04` are actually complete
  - once completed, it should record the GM/operator/debug-surface alignment explicitly
- `docs/API_CONTRACT.md`
  - review whether the session-context route should document the richer GM memory fragment once exposed
- `docs/GAME_MASTER_CONTRACT.md`
  - if recorded/session-context GM mirrors are extended, document the new bounded mirror shape explicitly
- The EPIC folder itself is accurate in describing unfinished work; the code is what still lags that scope.

## Path to A

Minimal steps needed to reach A:

1. Finish slice `03` by propagating bounded structured working memory into the GM session-context snapshot, recorded GM event context, runtime inspector, and GM impact trace.
2. Add consumer-boundary tests that prove `coveredTopics` is visible in:
   - the rendered GM prompt through the real use-case path
   - operator-facing debug/session-context/event surfaces
3. Update console rendering so `coveredTopics` is actually inspectable instead of only stored in state.
4. Keep `workingSummary` only as an explicitly documented mirror, not the sole practical operator-facing representation.
5. After the above is done, update `docs/PROJECT_STATUS.md` and any affected contract docs, then re-run the same quality gates.

## Final Recommendation

**Rework before close**

The repository is healthy and the core memory refinement is solid, but the EPIC definition of done is not met. The missing GM/operator/debug-surface alignment and the lack of consumer-boundary proof for those behaviors mean this should not be closed as a finished EPIC.

## Remediation Outcome

### Changes Made

- propagated bounded structured GM working memory (`summary`, `unresolvedThreads`, `coveredTopics`) through session-context snapshots, shared DTOs, recorded GM diagnostics, and admin/session-event projections while keeping `workingSummary` as a compatibility mirror
- aligned operator surfaces so the richer working-memory shape is visible in the runtime inspector memory tab, GM runtime context view, and GM impact trace
- strengthened consumer-boundary tests to prove observable behavior for GM prompt input, admin session-context output, session-event shaping, and console/debug rendering
- updated `docs/GAME_MASTER_CONTRACT.md`, `docs/API_CONTRACT.md`, and `docs/PROJECT_STATUS.md` to match the implemented contract and completion state

### Findings Resolved

- Resolved: GM session-context snapshots no longer drop structured working-memory fields.
- Resolved: recorded GM event context and GM impact trace no longer remain summary-only when structured working memory is available.
- Resolved: runtime inspector memory UI now renders `coveredTopics`.
- Resolved: critical observable behaviors are now proven by consumer-boundary tests.
- Resolved: documentation now supports closing the EPIC.

### Findings Deferred

- None.

### Build Gates

- lint: PASS
- typecheck: PASS
- tests: PASS
- coverage: PASS (`pnpm test:coverage` for `@gami/core`)

### Final Feature Confidence

- Working-memory compaction and normalization are proven with deterministic domain/service tests.
- GM runtime input is proven to consume `coveredTopics` through the real use-case path.
- Admin session-context output is proven to expose bounded structured GM working memory.
- Recorded GM diagnostics and session-event payload shaping are proven to preserve structured GM working memory.
- Runtime inspector and GM impact trace are proven to show `coveredTopics` and unresolved threads to operators.

### Final Grade

A

### Remaining Risks

- `workingSummary` still exists as a compatibility mirror, so future additive working-memory fields must continue to be added to the canonical `workingMemory` contract first and mirrored outward deliberately.
