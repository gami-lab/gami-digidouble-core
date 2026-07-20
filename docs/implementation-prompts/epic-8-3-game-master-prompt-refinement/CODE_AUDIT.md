# Code Audit — EPIC 8.3: Game Master Prompt Refinement

## Scope audited

- EPIC definition: `docs/implementation-prompts/epic-8-3-game-master-prompt-refinement/README.md`
- Related source:
  - `apps/core/src/domain/game-master/gm-prompt.service.ts`
  - `apps/core/src/domain/game-master/gm-input-renderer.ts`
  - `apps/core/src/domain/game-master/game-master.types.ts`
  - `apps/core/src/application/use-cases/run-game-master/run-game-master.use-case.ts`
  - `apps/core/src/application/use-cases/run-game-master/run-game-master.events.ts`
  - GM-focused tests under `apps/core/src/domain/game-master/` and `apps/core/src/application/use-cases/run-game-master/`
- Alignment docs reviewed:
  - `docs/VISION.md`
  - `docs/PRINCIPLES.md`
  - `docs/ARCHITECTURE.md`
  - `docs/TECH_STACK.md`
  - `docs/DATA_MODEL.md`
  - `docs/API_CONTRACT.md`
  - `docs/GAME_MASTER_CONTRACT.md`
  - `docs/TEST_STRATEGY.md`
  - `docs/TEST_COVERAGE_PLAN.md`
  - `docs/EPICS.md`
  - `docs/PROJECT_STATUS.md`

## Executive Summary

EPIC 8.3 is mostly delivered. The implementation keeps the GM prompt work inside the existing modular-monolith boundaries, preserves runtime contracts, avoids API drift, and lands with strong deterministic unit coverage at the prompt-builder and use-case boundary.

The main gaps are not in basic build health or gross architecture. They are in confidence and maintainability around the refined prompt path: one source-of-truth contract document is stale, the proof stops short of an in-process integration of the real GM composition path, the new tests are more wording-coupled than behavior-coupled, and observability still cannot tell operators which prompt revision produced a GM decision.

## Final Grade

**B**

## Build Health

- lint: PASS
- typecheck: PASS
- tests: PASS
- coverage: PASS (`pnpm test:coverage` runs `@gami/core` only; 86.75% statements, 84.65% branches, 96.26% functions, 86.75% lines)

## Feature Confidence Matrix

| Feature                               | Expected Behavior                                                                                                               | Evidence                                                                                                                                                                                    | Confidence | Notes                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------- |
| Structured GM system prompt           | Prompt is split into explicit Role, Objectives, Decision Policies, and Output Contract sections without changing runtime schema | `apps/core/src/domain/game-master/gm-prompt.service.ts`; `apps/core/src/domain/game-master/gm-prompt.service.test.ts`                                                                       | High       | Strong structural coverage                                                    |
| Structured GM runtime input rendering | GM input is rendered into clearly separated discussion and experience sections and omits empty optional blocks                  | `apps/core/src/domain/game-master/gm-input-renderer.ts`; `apps/core/src/domain/game-master/gm-input-renderer.test.ts`                                                                       | High       | Deterministic section-order and omission coverage exists                      |
| RunGameMaster prompt wiring           | Actual `llm.complete` request uses the refined system prompt and rendered GM input while preserving state/note persistence      | `apps/core/src/application/use-cases/run-game-master/run-game-master.use-case.test.ts`; `run-game-master.memory-input.use-case.test.ts`; `run-game-master.typed-retrieval.use-case.test.ts` | Medium     | Proven only through mocked use-case tests, not an integrated composition test |
| Decision-guidance refinement          | Prompt biases toward stability, evidence-based updates, and conservative unlock/switch behavior                                 | `apps/core/src/domain/game-master/gm-prompt.service.ts`; prompt assertions in `gm-prompt.service.test.ts` and `run-game-master.use-case.test.ts`                                            | Medium     | Tests prove prompt wording, not downstream decision quality                   |
| Contract compatibility                | `GameMasterInput`/`GameMasterOutput` semantics remain stable and existing normalization/unlock guards still work                | `apps/core/src/domain/game-master/game-master.types.ts`; GM use-case tests including defensive/unlock suites                                                                                | High       | No API change, no type drift in code                                          |
| Documentation sync                    | Source-of-truth docs match the refined implementation                                                                           | `docs/PROJECT_STATUS.md`, `docs/EPICS.md`, `docs/GAME_MASTER_CONTRACT.md`                                                                                                                   | Low        | `docs/GAME_MASTER_CONTRACT.md` still describes stale GM input fields          |

## Strengths

- The EPIC stayed within scope. No new endpoint, no API contract drift, and no cross-layer shortcut was introduced.
- Prompt ownership is materially clearer now:
  - static system instructions in `gm-prompt.service.ts`
  - dynamic input serialization in `gm-input-renderer.ts`
  - runtime contracts in `game-master.types.ts`
  - parse/normalize guards in the GM domain module
- The implementation respects the modular monolith architecture:
  - no provider leakage into the domain
  - no business logic moved into API handlers
  - GM remains async and non-blocking
- Build health is clean. Lint, typecheck, tests, and core coverage all pass.
- Test coverage is strongest where it should be for this slice:
  - prompt section ordering
  - session-start edge case
  - memory/persona/retrieval propagation into the GM request
  - unlock validation and safe GM event emission

## Findings

### `docs/GAME_MASTER_CONTRACT.md` no longer matches the runtime GM input contract

- Severity: Medium
- Category: Documentation / Contract Drift
- Problem:
  The source-of-truth GM contract doc still documents stale input fields, including `context.memory.shortTerm`, `context.memory.workingSummary`, and `context.rag.avatarMemory`, while the actual runtime contract uses `workingMemory`, omits `shortTerm` and `workingSummary` from `GameMasterInput`, and uses `rag.memory`.
- Why it matters:
  This EPIC explicitly aimed to remove prompt-contract drift. Leaving the contract doc stale recreates the exact maintenance hazard the EPIC was supposed to reduce: future work can reintroduce duplicate shapes, wrong field names, or incorrect test fixtures from documentation rather than code.
- Evidence:
  `docs/GAME_MASTER_CONTRACT.md:131-166` vs `apps/core/src/domain/game-master/game-master.types.ts:27-56` and `apps/core/src/domain/memory/memory.types.ts:102-118`
- Recommendation:
  Update the contract snippet to the exact runtime `GameMasterInput` shape and clearly separate runtime GM input from compatibility mirrors used only in context snapshots or event payloads.

### The refined GM prompt path is not proven by an in-process integration test

- Severity: Medium
- Category: Test Quality / Functional Confidence
- Problem:
  The EPIC’s proof stops at mocked `RunGameMasterUseCase` tests. The code verifies prompt content at the consumer boundary, but it never exercises the refined path through a real composed GM runtime with actual repository/event adapters, app wiring, and `llm.complete` interception together.
- Why it matters:
  This is a high-fanout path. Regressions in composition, persistence wiring, or safe event mapping can survive unit tests while all prompt-builder tests remain green.
- Evidence:
  Coverage exists in `apps/core/src/application/use-cases/run-game-master/run-game-master.use-case.test.ts`, `run-game-master.memory-input.use-case.test.ts`, and `run-game-master.typed-retrieval.use-case.test.ts`, but there is no GM-specific route/integration/e2e test proving the refined prompt path through the real application composition.
- Recommendation:
  Add one in-process integration test that boots the composed GM path with in-memory adapters, captures the actual `llm.complete` request, and asserts resulting state/event persistence.

### GM prompt tests are more wording-coupled than behavior-coupled

- Severity: Medium
- Category: Test Quality / Maintainability
- Problem:
  Several EPIC 8.3 tests assert exact prose sentences that are not all validation-critical, and the main use-case wiring test compares `request.systemPrompt` directly to `buildGameMasterSystemPrompt()`.
- Why it matters:
  The EPIC’s intent was to improve maintainability and enable prompt refinement without chaos. These tests will create churn for harmless wording improvements and partially mirror implementation instead of independently proving observable behavior.
- Evidence:
  `apps/core/src/domain/game-master/gm-prompt.service.test.ts:13-73`; `apps/core/src/application/use-cases/run-game-master/run-game-master.use-case.test.ts:247-257`
- Recommendation:
  Keep exact-string assertions only for section markers and validation-sensitive rules. For policy intent, assert narrower invariants such as section presence, required constraints, and stability bias keywords rather than full sentence bodies.

### GM observability still cannot identify which prompt revision produced a decision

- Severity: Medium
- Category: Operational Quality / Observability
- Problem:
  The GM trace metadata records correlation ID, provider, model, and turn metadata, but not a prompt version, checksum, or other stable prompt identifier.
- Why it matters:
  Prompt refinement is the whole point of this EPIC. Without a safe prompt identifier, operators cannot correlate regressions or improvements to a specific prompt revision in production telemetry.
- Evidence:
  `apps/core/src/application/use-cases/run-game-master/run-game-master.use-case.ts:271-289`
- Recommendation:
  Add a stable prompt version or fingerprint to GM trace metadata and, if useful, the safe GM event payload.

### The “Current Turn” section still does not explicitly show the full latest exchange

- Severity: Low
- Category: Functional Completeness / Prompt Clarity
- Problem:
  The explicit `Current Turn` section surfaces session ID, turn index, and latest user message, but not the latest avatar reply. The completed exchange is only implied inside `Recent Exchanges`.
- Why it matters:
  The README and prompt objectives emphasize that the GM interprets the latest exchange. The prompt is improved, but the renderer still makes the model infer the final avatar half of that exchange from history instead of foregrounding it.
- Evidence:
  `apps/core/src/domain/game-master/gm-input-renderer.ts:13-18`, `apps/core/src/domain/game-master/gm-input-renderer.ts:42-53`, `apps/core/src/domain/game-master/gm-prompt.service.ts:29-34`
- Recommendation:
  Either rename the section to reflect that it is only the latest user turn, or add an explicit latest-avatar-reply line when available.

## Architecture Review

The EPIC respects the intended modular monolith boundaries.

- API/Application/Domain/Infrastructure separation remains intact.
- Prompt assembly stays in the GM domain instead of leaking into controllers or adapters.
- Runtime wiring remains in the application layer.
- Provider/model resolution continues through the existing LLM abstraction.
- The GM remains async and non-blocking, consistent with `PRINCIPLES.md` and `ARCHITECTURE.md`.

The main architectural benefit of the EPIC is clearer ownership of the prompt path. The main residual risk is not boundary violation; it is that the GM runtime contract is still documented in more than one shape, and one of those shapes is stale.

## Test Review

Strong tests:

- `apps/core/src/domain/game-master/gm-prompt.service.test.ts`
  - proves section ordering and preservation of validation-sensitive output rules
- `apps/core/src/domain/game-master/gm-input-renderer.test.ts`
  - proves discussion/experience separation and empty-section omission
- `apps/core/src/application/use-cases/run-game-master/run-game-master.memory-input.use-case.test.ts`
  - proves bounded recent exchanges and layered memory propagation
- `apps/core/src/application/use-cases/run-game-master/run-game-master.typed-retrieval.use-case.test.ts`
  - proves typed retrieval context reaches the GM request
- `apps/core/src/application/use-cases/run-game-master/run-game-master.use-case.test.ts`
  - proves the use case sends the refined prompt path and persists state/notes

Weak tests:

- The GM prompt tests are too exact about non-contract prose.
- The primary wiring test uses `buildGameMasterSystemPrompt()` as its oracle, which weakens independence.

Missing tests:

- One in-process integration test for the composed GM path
- One test proving the refined prompt path through real GM event persistence with non-empty retrieval/persona content
- One test around the explicit “latest exchange” presentation if that behavior is considered part of scope

Implementation-coupled tests:

- `apps/core/src/application/use-cases/run-game-master/run-game-master.use-case.test.ts:247`
  - `expect(request.systemPrompt).toBe(buildGameMasterSystemPrompt())`
- Multiple exact sentence assertions in `gm-prompt.service.test.ts` go beyond contract-critical wording

## Documentation Gaps

- `docs/GAME_MASTER_CONTRACT.md` must be updated.
  - The documented `GameMasterInput` snippet is stale.
  - The doc mixes runtime input contract details with compatibility mirrors from context/event surfaces.
- `docs/PROJECT_STATUS.md` currently overstates doc accuracy for EPIC 8.3 because the GM contract doc is not fully synchronized.

## Path to A

Minimal steps needed to reach A:

1. Sync `docs/GAME_MASTER_CONTRACT.md` to the exact runtime `GameMasterInput` shape.
2. Add one in-process integration test covering the real refined GM prompt path and resulting state/event persistence.
3. Reduce wording-coupled test assertions to contract-focused invariants.
4. Add a safe prompt version/fingerprint to GM observability metadata.
5. Clarify the “Current Turn” section so the latest exchange is explicit, or narrow the documentation claim accordingly.

## Final Recommendation

**Close with debt**

The EPIC is functionally delivered and the repository is healthy, but the documentation drift and test/observability confidence gaps should be tracked before treating this as an A-grade foundation for future prompt iterations.
