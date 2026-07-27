# Code Audit — EPIC 8.5: Improve Game Master Prompt

## Scope audited

This audit covers the implementation described in:

- `docs/implementation-prompts/epic-8-5-improve-gm-prompt/README.md`

The review was aligned with:

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
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/MEMORY_SYSTEM_SPEC.md`

The implementation, tests, shared contracts, mappers, persistence paths, and observability paths were inspected. The mandatory workspace commands were executed from the repository root.

## Executive Summary

EPIC 8.5 is substantially implemented. The Game Master now performs an asynchronous post-analysis call, emits structured dialogue and retrieval guidance, supports dynamic routing/unlock instructions, persists next-turn orchestration, and keeps Avatar response generation on the critical path. The implementation also contains useful deterministic coverage for prompt structure, routing normalization, retrieval-plan consumption, stale-plan suppression, persistence failures, and platform-owned avatar switching.

The implementation is not ready for an A-grade close. The most important failure is in the memory contradiction requirement: a test named for excluding contradicted Avatar claims actually expects the contradicted claim to remain in candidate facts, and the current contradiction policy does not recognize the test's natural-language contradiction. This is false confidence around a core data-integrity behavior. In addition, invalid-output tracing sends the raw LLM request, including rendered user content and prompts, into a diagnostic trace despite the project contract prohibiting raw prompts and raw user content in diagnostics. The obsolete `topicsCovered` field also remains in current shared/admin state projections even though memory compaction is intended to own that data.

The mandatory quality gates pass. Coverage is high, but coverage does not compensate for the incorrect memory assertion or for the unavailable integration/E2E environment.

## Final Grade

**C — acceptable but meaningful weaknesses**

The EPIC delivers most requested behavior and has a solid foundation, but the memory-safety DoD is not proven and the current diagnostic path violates the observability/privacy contract. These are fixable, but they should be addressed before treating the EPIC as fully closed.

## Build Health

- lint: **PASS** — `pnpm lint`
- typecheck: **PASS** — `pnpm typecheck`
- tests: **PASS** — `pnpm test`; 140 core test files and 878 core tests passed, with the workspace packages also passing
- coverage: **PASS** — `pnpm test:coverage`; core reported 87.56% statements, 84.66% branches, 96.69% functions, and 87.56% lines
- integration/E2E additional check: **INCOMPLETE/FAIL** — `pnpm test:integration-e2e` produced no test output and hung until interrupted; the command exited with code 1. This is an environment/runner confidence gap, not a failure of the mandatory unit command.

## Feature Confidence Matrix

| Feature                                     | Expected Behavior                                                                                                                                      | Evidence                                                                                                     | Confidence (High/Medium/Low) | Notes                                                                                                                                                                                         |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Asynchronous GM post-analysis               | Avatar response is not blocked by GM analysis; GM runs after the turn and persists guidance for a later turn                                           | `send-message.use-case.ts`, `run-game-master.use-case.ts`, async scheduling tests and event tests            | High                         | The critical-path separation is clear and covered at the application boundary.                                                                                                                |
| Explicit dialogue control                   | GM emits one of the documented modes with explicit `askFollowUp`; Avatar receives the guidance                                                         | `gm-output-parser.ts`, `gm-prompt.service.ts`, `send-message.use-case.ts`, parser/prompt/Avatar prompt tests | Medium                       | Contract and prompt propagation are tested; there is limited consumer-level proof of the resulting conversation behavior because LLM writing is intentionally not tested.                     |
| First-class retrieval planning              | Retrieval plan is consumed on the next relevant turn, combined with the latest user message, and mandatory retrieval failure prevents fabricated facts | `send-message.use-case.ts`, retrieval-plan query tests, stale-plan tests, insufficient-evidence prompt tests | Medium                       | Strong deterministic boundary coverage exists, but the available integration/E2E command could not be completed.                                                                              |
| Dynamic routing and unlocks                 | Routing schema is emitted only when meaningful; invalid/unavailable targets do not cause invalid switches; platform owns the actual handoff            | `gm-prompt.service.ts`, normalization/use-case tests, avatar-switch integration test                         | Medium                       | The handoff test explicitly invokes the platform switch use case after GM output, which matches the architecture. The integration tier is not runnable in the current check.                  |
| Memory ownership and contradiction handling | Compaction owns summary/topics/unresolved/candidate facts and contradicted Avatar claims are not automatically persisted                               | `memory-maintenance.service.ts`, `memory-contradiction.policy.ts`, memory maintenance tests                  | Low                          | Ownership is represented in prompts and persistence code, but the central contradiction regression test expects the prohibited claim to remain and the natural-language case is not filtered. |
| Director Notes and next-turn state          | Non-empty notes and structured orchestration are persisted for the next relevant turn                                                                  | `gm-output-parser.ts`, `run-game-master.use-case.ts`, state/persistence tests                                | High                         | Required-note validation and persistence/error paths are directly tested.                                                                                                                     |
| Operational diagnostics                     | Events and traces are safe, bounded, and useful for debugging without exposing raw prompts or user content                                             | `run-game-master.events.ts`, parser logging, adapter trace metadata, event tests                             | Low                          | Normal events are bounded, but the invalid-output trace and parser error log include raw request/response material.                                                                           |

## Strengths

- The implementation follows the intended API → Application → Domain → Infrastructure direction. Prompt assembly, parsing, and deterministic normalization are kept out of API handlers.
- Provider access is routed through the internal LLM/model abstraction rather than leaking a vendor SDK into domain logic.
- The Avatar remains the synchronous user-facing actor while Game Master work is scheduled asynchronously.
- The prompt has explicit sections and versioning, and dynamic routing reduces schema/prompt noise for single-avatar or no-unlock scenarios.
- Retrieval planning is represented as structured state rather than an untyped prompt-only convention. The next-turn consumer checks avatar and turn freshness and suppresses stale plans.
- Routing validation is defensive: unavailable or invalid targets normalize to a safe stay decision, and the platform switch use case remains responsible for the lifecycle handoff.
- Persistence failure handling is materially better than a best-effort silent write: GM state and notes persistence failures emit structured error events and rethrow.
- The test suite is deterministic and behavior-oriented in several important areas, especially stale-plan suppression, retrieval failure guidance, parser contracts, dynamic prompt modes, and persistence failure events.
- The implementation preserves compatibility migration paths for legacy persisted GM state while avoiding use of obsolete state in core GM decision logic.

## Findings

### Contradicted Avatar claims are not reliably excluded from memory

- Severity: **Critical**
- Category: Functional completeness / Test quality / Data integrity
- Problem: The EPIC DoD requires contradicted Avatar claims not to be automatically persisted. The contradiction policy relies on exact value substring matching and does not recognize the natural-language example in the regression test. More importantly, the test titled `keeps contradicted Avatar claims out of candidate facts and preserves the unresolved thread` supplies `mona_current_location = with grandfather` after an Avatar message saying Mona stayed `with her grandfather`, then asserts that the Mona candidate fact is retained. That assertion confirms the prohibited behavior instead of preventing it.
- Why it matters: Memory is durable state. Persisting an unsupported or contradicted claim can contaminate future context and make later Avatar responses confidently wrong. A green test run currently gives false confidence on the EPIC's explicit safety requirement.
- Evidence: `apps/core/src/application/services/memory-maintenance.service.test.ts:288-342`; `apps/core/src/application/services/memory-contradiction.policy.ts`. The policy searches for the exact normalized fact value in prior Avatar messages, so `with grandfather` does not match `with her grandfather`.
- Recommendation: Correct the regression assertion so the contradicted Mona fact is absent while the unresolved thread remains. Strengthen the policy boundary around entity/value matching or require compaction output to carry provenance/support classification that can be checked deterministically. Add direct policy tests for exact contradiction, paraphrase, later user verification, and unresolved-thread preservation.

### Invalid-output diagnostics expose raw prompts and user content

- Severity: **High**
- Category: Observability / Privacy / Contract compliance
- Problem: The invalid Game Master output trace passes the full LLM request as trace input and the raw LLM response as trace output. The request contains the system prompt and rendered user/recent conversation content. The parser also writes raw invalid content and the parse error to `console.error`.
- Why it matters: The Game Master contract explicitly requires diagnostics to avoid raw prompts, raw user content, secrets, and unbounded transcripts. This creates an avoidable privacy and retention risk and makes operator tooling dependent on high-volume, sensitive payloads.
- Evidence: `apps/core/src/application/services/run-game-master.events.ts:41-54` passes `llmRequest` and `llmResponse.content` to `gm.invalid_output`; `apps/core/src/domain/game-master/gm-output-parser.ts:40-42` logs raw content. The safe event payload path in the same events module demonstrates that bounded structural diagnostics are already available.
- Recommendation: Emit only bounded metadata for parse failures: trigger reason, model/provider abstraction identifiers, prompt version, content length, parse error class, and a redacted/truncated error fingerprint if needed. Ensure the shared observability adapter applies the same policy to invalid traces and replace raw console logging with the structured logger.

### Obsolete `topicsCovered` remains a current shared/admin GM contract

- Severity: **Medium**
- Category: Structural maintainability / Contract ownership
- Problem: The EPIC moves summary, covered topics, unresolved threads, and candidate facts under memory compaction ownership, but `topicsCovered` remains present in the shared `GmStateSummary`, GM session event before/after payloads, runtime inspection context, and session-context mappers. The domain type labels the field as compatibility-only, but the field is still visible as a current GM state field across multiple consumers.
- Why it matters: A future engineer can reasonably continue writing or consuming the field as authoritative GM state. Every added or renamed field now has multiple projection/mapping sites, increasing drift risk and preserving an ownership boundary the EPIC intended to remove.
- Evidence: `packages/shared/src/runtime-inspector-types.ts:48-52,96-118`; `apps/core/src/application/services/runtime-inspector-event-context.ts:49-53`; `apps/core/src/api/routes/mappers/session-context.mapper.ts:60-65`; `apps/core/src/application/use-cases/inspect-session/inspect-session.use-case.ts:42-45`; `apps/core/src/application/use-cases/get-session-context/get-session-context.use-case.ts:262-272`.
- Recommendation: Keep legacy database read compatibility in an explicit adapter, but remove `topicsCovered` from current shared/admin GM projections or clearly expose it under a legacy compatibility shape. Update API/runtime inspection contracts and tests so memory-owned topics are read from working memory only.

### The Game Master application use case remains an oversized coordinator

- Severity: **Medium**
- Category: Architecture / Maintainability
- Problem: `run-game-master.use-case.ts` is approximately 780 lines and disables the max-lines lint rule. It coordinates trigger decisions, context selection, retrieval, model resolution, prompt construction, LLM invocation, parsing, routing and unlock validation, state reduction, persistence, and event construction.
- Why it matters: These responsibilities are all in the application layer, so the layer boundary is not violated outright, but the change and failure blast radius is large. A prompt change, routing change, persistence change, or diagnostics change can require editing and retesting the same high-coupling coordinator.
- Evidence: `apps/core/src/application/use-cases/run-game-master/run-game-master.use-case.ts`, including the file-level max-lines disable and the separate orchestration, routing, persistence, and event concerns.
- Recommendation: Incrementally extract cohesive, concrete collaborators for context/retrieval loading, output decision application, and result persistence/diagnostics. Keep the use case as the orchestration boundary and avoid introducing a generic workflow framework.

### Integration confidence is lower than the green unit result suggests

- Severity: **Medium**
- Category: Test strategy / Operational readiness
- Problem: The mandatory unit suite and coverage run pass, but the available integration/E2E command hangs without producing test output and exits only after interruption. Some repository integration tests are gated by database availability, and the avatar-switch integration test is not part of the default `pnpm test` command.
- Why it matters: The EPIC changes persistence, next-turn state, retrieval threading, and cross-use-case handoff. Those are precisely the areas where in-memory/unit confidence can miss schema, serialization, transaction, or wiring defects.
- Evidence: `pnpm test:integration-e2e` did not complete in the audit environment; `apps/core/src/infrastructure/db/repositories/postgres-gm-state.repository.integration.test.ts` guards execution on database availability; `apps/core/src/application/use-cases/run-game-master/run-game-master.avatar-switch.integration.test.ts` covers the handoff but is outside the default test run.
- Recommendation: Make the integration test command deterministic in CI and document its required services. Include at least one persistence-backed test for the current next-turn/retrieval contract and one black-box send-message → async GM → next-turn consumption flow in the release gate.

## Architecture Review

The implementation is directionally aligned with the modular monolith. API mappers and handlers do not own Game Master policy; application use cases coordinate domain services and ports; prompt parsing and normalization are isolated; and LLM access remains behind the internal abstraction. The platform-owned avatar switch handoff is represented separately from the Game Master suggestion, which matches the documented lifecycle.

The principal architecture concern is not a direct layer violation but concentration of policy in the Game Master application coordinator. Its dependency list has been improved through an options object, but the use case still owns too many unrelated decisions. This is manageable short-term and should be addressed before more orchestration features accumulate.

The shared `topicsCovered` projections are an ownership-boundary leak. The field is retained for compatibility, which is defensible at the persistence edge, but it should not remain indistinguishable from current authoritative GM state in shared runtime inspection contracts.

The next-turn orchestration shape is coherent and typed. Retrieval plans, dialogue control, notes, routing, and progression are represented explicitly, and freshness/consumption is tracked. The main remaining risk is that multiple projection and persistence shapes mirror related fields without a single clearly authoritative public contract.

## Test Review

Strong tests:

- Parser tests cover valid modes, explicit follow-up behavior, required non-empty Director Notes, invalid routing normalization, and compatibility with obsolete output fields.
- Prompt tests cover dynamic routing modes, single-avatar/no-unlock behavior, structured instructions, prompt sizing, and current-turn rendering.
- Send-message tests cover retrieval query composition, matching plan consumption once, stale/other-avatar plan suppression, and mandatory retrieval failure guidance.
- Game Master use-case tests cover asynchronous result persistence, routing/unlock behavior, state reduction, events, and persistence failures.
- The avatar-switch integration test proves the important architectural split: GM records the target and the platform switch use case performs conversation/session handoff.

Weak or implementation-coupled tests:

- Several prompt tests necessarily assert structural text fragments. They are useful contract tests, but they do not prove that an actual Avatar response follows every mode.
- Some use-case tests rely heavily on mocks and call assertions. Those are appropriate for adapter isolation, but they should not be treated as proof of end-to-end behavior.
- The high coverage percentage is not evidence of memory correctness; the contradicted-claim test is the clearest example of a green but semantically wrong assertion.

Missing or insufficient tests:

- A direct contradiction-policy suite covering natural-language paraphrases, user correction/verification, contradictory facts from multiple turns, and unresolved-thread preservation.
- A black-box persistence-backed test for the current next-turn orchestration and retrieval-plan JSON contract.
- A completed integration/E2E run for the asynchronous flow, including response completion before GM work and subsequent plan consumption.
- A diagnostics contract test that asserts invalid-output traces and logs contain no raw prompts, raw user messages, or unbounded model output.
- Consumer-level assertions for runtime inspection that verify memory-owned topics are used rather than the legacy GM `topicsCovered` field.

## Documentation Gaps

- `docs/PROJECT_STATUS.md` describes the EPIC as having regression coverage for the Mona contradiction scenario, but the current test assertion does not prove exclusion of the contradicted claim. The status should be corrected after the test is fixed.
- `docs/GAME_MASTER_CONTRACT.md` prohibits raw prompt/user content in diagnostics, while the invalid-output trace and parser logging paths violate that contract.
- `docs/API_CONTRACT.md` and the shared runtime inspector types still expose `topicsCovered` as a current GM state field. The compatibility intent should be explicit and the authoritative memory-owned shape should be documented.
- `docs/MEMORY_SYSTEM_SPEC.md` should remain the source of truth for contradiction semantics and should be reflected directly in deterministic policy tests.

## Path to A

1. Fix the contradiction regression test and the policy so the documented natural-language contradiction cannot persist an unsupported Avatar claim; add direct policy tests. Verify with the focused memory suite and full test suite.
2. Remove raw prompts, raw user content, and unbounded model output from invalid-output traces and parser logs. Add a diagnostics redaction contract test.
3. Resolve the `topicsCovered` ownership boundary by isolating legacy persistence compatibility from current shared/admin contracts, then update the API/runtime documentation and consumer tests.
4. Make the integration/E2E command runnable and add release-gate coverage for persistence-backed next-turn consumption and the asynchronous handoff flow.
5. If additional EPIC 8.5 work is planned, split the large GM coordinator before adding more policy responsibilities.

## Final Recommendation

- **Rework before close**

The EPIC can be closed after the critical memory contradiction behavior and diagnostic-safety issues are corrected and verified. The remaining coordinator size and compatibility projection debt can be tracked as follow-up if the team explicitly accepts it, but the current false-confidence test and raw diagnostic data path should not be carried forward as closed-EPIC quality.

## Remediation Outcome

### Changes Made

- Strengthened contradiction detection so natural-language Avatar claims such as “with her
  grandfather” are matched against compact fact values such as “with grandfather”.
- Corrected the Mona regression test to prove the contradicted candidate fact is excluded while the
  unresolved thread remains.
- Added direct contradiction-policy tests for natural-language contradiction, later user support,
  and verified canonical context.
- Removed raw invalid GM output, full prompt requests, and parser payloads from diagnostics. Invalid
  output traces now contain only bounded failure metadata, response length, latency, and token
  counts.
- Removed `topicsCovered` from current shared GM state summaries, runtime event summaries, admin
  inspection responses, and GM context projections. Legacy persisted columns remain readable only
  through compatibility state handling.
- Split the GM application coordinator into focused context-loading, routing-validation, and
  result-persistence modules, and reduced the main use case below the lint complexity/size limits.
- Added a behavior-level diagnostic redaction test and updated console/admin contract fixtures.
- Synchronized `API_CONTRACT.md`, `ARCHITECTURE.md`, `DATA_MODEL.md`, `TEST_STRATEGY.md`,
  `TEST_COVERAGE_PLAN.md`, `PROJECT_STATUS.md`, and `EPICS.md`.

### Findings Resolved

- **Contradicted Avatar claims:** Resolved. The durable working-memory path now rejects the
  contradicted Mona claim, preserves the unresolved thread, and has focused policy coverage.
- **Raw invalid-output diagnostics:** Resolved. The trace and parser failure paths no longer carry
  raw prompts, user messages, or model response content.
- **Legacy `topicsCovered` contract drift:** Resolved for current consumers. The field remains only
  in the persisted/domain compatibility shape and is not emitted through current shared/admin
  projections.
- **Oversized GM coordinator:** Resolved. Context loading, routing validation, and result
  persistence have explicit focused boundaries; the main use case is now 451 lines and passes
  lint without a file-level size suppression.
- **EPIC behavior confidence:** Resolved for the EPIC path. The full workspace suite passes, and the
  composed GM runtime and platform-owned avatar handoff integration tests pass directly.

### Findings Deferred

- The aggregate integration/E2E command still requires the repository's external service
  environment and did not complete in this audit shell. The two EPIC-specific integration tests
  pass directly; Postgres-backed coverage remains a CI/stack execution responsibility rather than
  an unresolved EPIC code defect.
- The contradiction matcher is intentionally bounded and deterministic; deep semantic paraphrase
  detection remains an LLM/data-contract concern and is not promoted into speculative policy logic.

### Build Gates

- lint: **PASS** — `pnpm lint`
- typecheck: **PASS** — `pnpm typecheck`
- tests: **PASS** — `pnpm test`; 141 core test files and 882 core tests passed, with all workspace packages passing
- coverage: **PASS** — `pnpm test:coverage`; core reported 87.55% statements, 84.87% branches, 96.60% functions, and 87.55% lines
- EPIC integration tests: **PASS** — composed GM runtime and platform-owned avatar handoff tests

### Final Feature Confidence

- Asynchronous single-call GM post-analysis: **High** — full unit coverage plus composed runtime
  integration coverage.
- Dialogue-control and retrieval-plan contract propagation: **High** — parser, prompt, next-turn
  consumer, stale-plan, and insufficient-evidence tests pass.
- Routing, unlocking, and platform-owned handoff: **High** — deterministic validation and focused
  integration handoff coverage pass.
- Memory ownership and contradiction filtering: **High** — corrected consumer persistence assertion
  plus direct policy tests for contradiction, user support, and verified context.
- Safe diagnostics and current shared/admin contracts: **High** — redaction behavior and consumer
  projection tests pass.

### Final Grade

**A — safe foundation with strong behavioral proof**

### Remaining Risks

- Full Postgres/HTTP integration execution should remain part of CI with its documented service
  prerequisites. This audit environment could not complete the aggregate command.
- No test attempts to judge LLM writing quality; tests continue to verify contracts, state,
  persistence, routing, retrieval safety, and diagnostics as required by the test strategy.
