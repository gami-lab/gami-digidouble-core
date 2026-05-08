# Code Audit — EPIC 4.2c Memory System v3 (Working + Episodic Memory)

## Scope audited

- EPIC scope source:
  - `docs/implementation-prompts/epic-4-2c-memory-system-v3/README.md`
- Core implementation reviewed:
  - `apps/core/src/application/services/memory-maintenance.service.ts`
  - `apps/core/src/application/services/episodic-memory.service.ts`
  - `apps/core/src/application/services/memory-selection.service.ts`
  - `apps/core/src/application/use-cases/start-conversation/start-conversation.use-case.ts`
  - `apps/core/src/application/use-cases/end-conversation/end-conversation.use-case.ts`
  - `apps/core/src/application/use-cases/run-game-master/run-game-master.use-case.ts`
  - `apps/core/src/application/use-cases/get-session-memory-layers/get-session-memory-layers.use-case.ts`
  - `apps/core/src/api/routes/admin-memory.observability.test.ts`
  - `apps/core/src/api/routes/admin-session-memory.stack-e2e.test.ts`
- Supporting evidence reviewed:
  - memory policy and selection tests (`domain/memory`, `application/services`)
  - use-case tests for start/end conversation and GM memory input
  - repository integration tests for conversation working/episodic memory
- Alignment docs checked:
  - `docs/MEMORY_SYSTEM_SPEC.md`
  - `docs/ARCHITECTURE.md`
  - `docs/API_CONTRACT.md`
  - `docs/DATA_MODEL.md`
  - `docs/GAME_MASTER_CONTRACT.md`
  - `docs/TEST_STRATEGY.md`
  - `docs/TEST_COVERAGE_PLAN.md`
  - `docs/EPICS.md`
  - `docs/PROJECT_STATUS.md`

## Executive Summary

EPIC 4.2c is substantially implemented and technically strong. Core behaviors for bounded short-term memory, conversation working-memory rewrite cadence, episodic persistence, hydration on conversation start, and memory observability surfaces are present and aligned with architecture boundaries. Mandatory build gates are fully green.

The main remaining weakness is proof quality for a few critical product-level outcomes: cross-conversation continuity and GM episodic-memory usage are covered mostly through unit-level deterministic tests, with limited end-to-end consumer-observable regression protection. This prevents an honest A at this time.

## Final Grade

**B**

## Build Health

- lint: **PASS**
- typecheck: **PASS**
- tests: **PASS**
- coverage: **PASS** (`pnpm test:coverage` successful)

## Feature Confidence Matrix

| Feature                                  | Expected Behavior                                                         | Evidence                                                                                                                                              | Confidence (High/Medium/Low) | Notes                                                                                   |
| ---------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------- |
| Bounded short-term memory                | Turn-time memory remains bounded (last exchanges only)                    | `memory.policy.ts`, `memory-selection.service.ts`, `run-game-master.memory-input.use-case.test.ts`, `avatar-memory-context-assembler.service.test.ts` | High                         | Deterministic and well-covered at unit level.                                           |
| Conversation working-memory lifecycle    | Rewritten working memory with periodic refresh and trigger policy         | `memory-maintenance.service.ts`, `memory-maintenance.service.test.ts`                                                                                 | High                         | Includes 3-exchange post-turn gate + failure isolation.                                 |
| Episodic generation on close             | One episodic memory entry per closed conversation, async and non-blocking | `end-conversation.use-case.ts`, `episodic-memory.service.ts`, `end-conversation.use-case.test.ts`                                                     | High                         | Idempotent generation behavior present and tested.                                      |
| Hydration on conversation start          | New conversation seeded from scoped episodic memories                     | `start-conversation.use-case.ts`, `episodic-memory.service.ts`, `start-conversation.use-case.test.ts`                                                 | Medium                       | Strong unit coverage; limited route/e2e proof of continuity impact.                     |
| GM memory usage incl. episodic selection | GM receives bounded layered memory context                                | `run-game-master.use-case.ts`, `memory-selection.service.ts`, `run-game-master.memory-input.use-case.test.ts`                                         | Medium                       | Proof for episodic inclusion path is limited compared to working/short-term path proof. |
| Memory observability/debug surface       | Selection + hydration observability exposed via admin memory-layers       | `get-session-memory-layers.use-case.ts`, `admin-memory.observability.test.ts`, `admin-session-memory.stack-e2e.test.ts`, `docs/API_CONTRACT.md`       | High                         | Contract and behavior are present; stack route coverage exists.                         |

## Strengths

- Strong modular separation: policies in domain, orchestration in application, storage in infrastructure.
- Good deterministic memory policy design (bounded context, explicit limits, stable scoring reasons).
- Async failure isolation implemented correctly for memory maintenance and hydration/episodic event logging.
- Contract/doc sync appears disciplined: API, data model, GM contract, and project status reflect EPIC 4.2c behavior.
- Build hygiene is strong with all mandatory gates passing.

## Findings

### 1) Missing full consumer-observable continuity proof across conversations

- Severity: High
- Category: Test Quality / Functional Confidence
- Problem: Core continuity behavior (close conversation -> start new conversation -> avatar answer reflects prior episodic memory) is not clearly protected by an end-to-end behavior test.
- Why it matters: This is a primary user-visible promise of EPIC 4.2c; unit-only confidence can miss integration regressions.
- Evidence: strong unit tests around hydration and episodic generation (`start-conversation.use-case.test.ts`, `episodic-memory.service.test.ts`), but no direct route/e2e assertion of continuity in avatar output flow.
- Recommendation: Add at least one in-process API-level test proving continuity signal appears in subsequent avatar turn after close/start sequence.

### 2) GM episodic-memory usage is under-proven in tests

- Severity: Medium
- Category: Test Quality
- Problem: GM memory-input test strongly validates short-term/working/long-term fields, but episodic memory inclusion path is not equivalently asserted.
- Why it matters: EPIC DoD explicitly includes GM episodic-memory usage.
- Evidence: `run-game-master.memory-input.use-case.test.ts` currently expects `episodicMemories` undefined in covered scenario.
- Recommendation: Add deterministic GM input test with episodic candidates present and assert bounded, reason-tagged episodic entries in GM context.

### 3) Observability selection assembly creates service inline in use case

- Severity: Low
- Category: Maintainability / Architecture hygiene
- Problem: `GetSessionMemoryLayersUseCase` instantiates `MemorySelectionService` inline instead of receiving it as a dependency.
- Why it matters: Slightly increases coupling and reduces substitution testability for selection logic changes.
- Evidence: `new MemorySelectionService(...)` in `get-session-memory-layers.use-case.ts`.
- Recommendation: Inject a selection service interface to keep assembly logic centrally replaceable and easier to test in isolation.

### 4) Stack coverage for memory-layers does not exercise observability payload shape deeply

- Severity: Low
- Category: Contract Regression Risk
- Problem: Stack-e2e validates endpoint availability and core layer shape, but detailed observability field assertions are currently route/unit level only.
- Why it matters: Production-like regressions in observability payload shape could slip.
- Evidence: `admin-session-memory.stack-e2e.test.ts` checks `observability` existence, while detailed shape is in `admin-memory.observability.test.ts`.
- Recommendation: Add one stack assertion for key observability fields (`selection.selectedCount`, `hydration.hydratedConversationId`) in seeded scenario.

### 5) Hard-coded internal retrieval limits increase drift risk

- Severity: Low
- Category: Maintainability
- Problem: Episodic retrieval/selection limits (`12`, `3`) are local constants in service code.
- Why it matters: Policy drift can occur if limits evolve in domain policy/docs but service-level constants diverge.
- Evidence: `EPISODIC_RETRIEVAL_LIMIT`, `EPISODIC_SELECTION_LIMIT` in `episodic-memory.service.ts`.
- Recommendation: Centralize limits in memory policy constants alongside other memory bounds.

## Architecture Review

- Layering remains consistent with modular-monolith guidance.
- Domain memory policies are separate from use-case orchestration and infrastructure adapters.
- No direct provider leakage into domain/application observed in audited files.
- Async behavior is correctly used where valuable (memory maintenance, episodic generation, hydration observability append).
- Residual concern is maintainability coupling (inline service construction), not structural drift.

## Test Review

Strong tests:

- `memory-maintenance.service.test.ts` (trigger/success/failure/post-turn cadence behavior)
- `episodic-memory.service.test.ts` and `episodic-memory.policy.test.ts` (deterministic episodic generation/hydration policy)
- `end-conversation.use-case.test.ts` episodic generation and failure-isolation coverage
- `admin-memory.observability.test.ts` contract-focused observability assertions

Weak tests:

- GM memory input coverage is narrow on episodic presence path (`run-game-master.memory-input.use-case.test.ts`).

Missing tests:

- Cross-conversation continuity behavior through API flow (close -> new conversation -> response-level continuity assertion).
- Stack-level assertion for detailed observability payload fields.

Implementation-coupled tests:

- Some tests focus on internal selected-object shape rather than downstream conversational effect; useful but not sufficient for full user-observable confidence.

## Documentation Gaps

- No major stale-doc gap identified in audited scope; EPIC 4.2c appears reflected in:
  - `docs/PROJECT_STATUS.md`
  - `docs/API_CONTRACT.md`
  - `docs/DATA_MODEL.md`
  - `docs/GAME_MASTER_CONTRACT.md`
- Optional improvement: add explicit note in `docs/TEST_COVERAGE_PLAN.md` about required cross-conversation continuity behavioral regression test.

## Path to A

1. Add one API-level behavioral continuity regression test proving episodic hydration influences next conversation response context.
2. Expand GM memory-input test to assert episodic memory inclusion and bounded selection reasons.
3. Add stack-e2e assertion for observability payload key fields.
4. Refactor memory-selection dependency injection in memory-layers use case (small maintainability cleanup).
5. Re-run gates and keep docs synced if test strategy/coverage expectations are updated.

## Final Recommendation

**Close with debt**.

EPIC 4.2c is functionally strong and operationally stable, but key user-observable continuity proof should be strengthened before declaring A-quality closure.
