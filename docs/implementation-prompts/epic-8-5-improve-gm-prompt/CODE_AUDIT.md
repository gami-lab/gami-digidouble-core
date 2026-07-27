# Code Audit — EPIC 8.5: Game Master Post-Analysis Refinement

## Scope audited

This audit covers the EPIC README and prompts `00` through `03`, the implementation in `apps/core` and `packages/shared`, the related persistence and runtime-inspection paths, and the tests that exercise the Game Master, Avatar prompt, retrieval, routing, memory, and observability behavior.

The review was aligned with `docs/VISION.md`, `docs/PRINCIPLES.md`, `docs/ARCHITECTURE.md`, `docs/TECH_STACK.md`, `docs/DATA_MODEL.md`, `docs/API_CONTRACT.md`, `docs/TEST_STRATEGY.md`, `docs/TEST_COVERAGE_PLAN.md`, `docs/EPICS.md`, `docs/PROJECT_STATUS.md`, `docs/GAME_MASTER_CONTRACT.md`, and `docs/MEMORY_SYSTEM_SPEC.md`.

## Executive Summary

EPIC 8.5 is substantially implemented. The code introduces the intended structured dialogue control, retrieval planning, dynamic routing prompt, next-turn orchestration state, memory-compaction ownership rules, failure isolation, diagnostics, and focused deterministic tests. The normal Avatar path remains separate from asynchronous GM execution, and the required repository checks are green.

The implementation is substantially complete and the two previously disputed behaviors are intentional design choices. The remaining concerns are contract synchronization, missing negative-path proof, persistence compatibility, and maintainability:

1. Stale retrieval suppression is heuristic and treats generic factual questions such as “What is your favorite color?” as continuation of the old plan. The EPIC explicitly requires unrelated messages not to reuse stale retrieval intent, but no negative test proves this.
2. The persisted orchestration normalizer silently drops currently supported `scopes` and `unlockDecisions` fields.
3. Memory contradiction filtering, post-LLM persistence diagnostics, and the large GM application coordinator retain meaningful structural debt.

These are behavior, compatibility, and maintainability issues, not coverage-threshold failures. They should be tracked, but the accepted Director Notes and Avatar-switch ownership decisions do not by themselves prevent EPIC closure.

## Final Grade

**C — acceptable with meaningful follow-up debt; close with debt.**

The grade is driven by stale-plan leakage into unrelated factual turns, persistence field loss, broad contradiction filtering, incomplete failure diagnostics, and avoidable coordinator coupling. The implementation intentionally requires non-empty Director Notes, and GM switching intentionally delegates conversation lifecycle to the platform mechanism; both decisions need source-of-truth documentation and boundary-level tests. Lint, typecheck, tests, and coverage are healthy, but coverage does not prove the missing consumer handoff behavior.

## Build Health

- lint: PASS
- typecheck: PASS
- tests: PASS — 874 core tests across 140 files; all workspace test tasks passed
- coverage: PASS — 87.39% statements, 84.57% branches, 96.57% functions, 87.39% lines

Commands run:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm test:coverage`

## Feature Confidence Matrix

| Feature                                | Expected Behavior                                                                                                                     | Evidence                                                                                                                                       | Confidence (High/Medium/Low) | Notes                                                                                                                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Async single-call GM lifecycle         | Avatar response completes without waiting for post-turn GM execution; one GM call prepares the next turn                              | `SendMessageUseCase.schedulePostTurnWork()` dispatches GM with `void` and a catch handler; async lifecycle tests and integration coverage pass | High                         | No second GM call was found in the normal message path.                                                                                                                          |
| Dialogue-control contract              | Five modes and explicit `askFollowUp` reach the Avatar prompt; the accepted implementation contract requires non-empty Director Notes | `gm-output-parser.test.ts`, `persona-prompt.service.test.ts`, and send-message prompt assertions                                               | Medium                       | Structured prompt guidance is proven, but no test proves generated Avatar behavior. The EPIC README still describes Director Notes as optional.                                  |
| Retrieval planning and consumption     | Stored intent is combined with the next related user message, retrieved, injected, and consumed once                                  | `send-message.use-case.test.ts`, typed retrieval query-builder tests, turn-completed metadata                                                  | Medium                       | The related-turn path works, but unrelated factual turns can retain stale planning.                                                                                              |
| Mandatory retrieval failure safety     | Missing/failed required retrieval produces uncertainty guidance instead of fabricated certainty                                       | `send-message.use-case.ts` sets `insufficient_evidence`; send-message tests assert the prompt guidance                                         | High                         | This protects the prompt boundary; response-quality behavior remains model-dependent.                                                                                            |
| Dynamic routing schema                 | Impossible routing actions are omitted; valid suggest/switch/unlock actions are validated                                             | `gm-prompt.service.test.ts`, unlock tests, normalization tests                                                                                 | Medium                       | Schema capability omission is covered. Conversation lifecycle is intentionally delegated to the platform switch mechanism.                                                       |
| Avatar switch                          | GM records the next active Avatar; the platform owns conversation handoff                                                             | `run-game-master.avatar-switch.use-case.test.ts`; existing `SwitchAvatarUseCase` lifecycle path                                                | Medium                       | GM does not create/close conversations or emit a duplicate switch event by design. No end-to-end test proves which consumer invokes the platform handoff after GM state changes. |
| Memory ownership                       | Compaction solely owns summary, covered topics, unresolved threads, and candidate facts                                               | `memory-maintenance.service.test.ts`, compaction prompt, working-memory repository paths                                                       | Medium                       | Ownership boundary is clear, but contradiction filtering is broader than the contradicted fact.                                                                                  |
| Provenance and contradiction handling  | Unsupported Avatar claims are not persisted; verified context can support a fact                                                      | Mona and verified-context tests in `memory-maintenance.service.test.ts`                                                                        | Medium                       | The Mona case is covered; unrelated candidate facts in the same contradiction window are not.                                                                                    |
| Observability and operator diagnostics | Safe GM events, latency/token metadata, correlation IDs, and retrieval links are available                                            | GM event tests, integration trace assertions, shared runtime inspector DTOs                                                                    | High                         | Persistence failure after LLM success is not converted into a `gm_error` diagnostic.                                                                                             |
| Compatibility migration                | Existing persisted GM state remains readable without copying removed ownership fields                                                 | `gm-state-migration.test.ts`, Postgres repository normalization                                                                                | Medium                       | Current supported `scopes` and `unlockDecisions` fields are silently dropped on normalization.                                                                                   |

## Strengths

- The async Director–Actor boundary is preserved. GM work is launched after a completed Avatar turn and is isolated from the normal response promise.
- GM contracts are separated into domain types, a parser, runtime normalization, static prompt construction, and dynamic input rendering. This is a clean replaceable boundary around LLM behavior.
- Routing capability is derived from the runtime roster instead of always exposing every action. Single-Avatar and no-locked-Avatar prompts are materially smaller and omit impossible actions.
- Retrieval queries and required facts are carried as typed variants, combined with the latest user message, and exposed in bounded turn diagnostics.
- Memory compaction is the intended owner of `summary`, `coveredTopics`, `unresolvedThreads`, and `candidateFacts`; GM state reduction no longer updates those fields or the interaction count.
- The compaction prompt explicitly distinguishes Avatar claims from canonical facts and labels verified context.
- Event payloads avoid raw prompts and user text while retaining correlation, latency, token, routing, and retrieval metadata.
- Deterministic tests cover parser rejection, dynamic prompt capability, retrieval composition, memory provenance, invalid routing, GM errors, and the composed in-memory GM path.

## Findings

### GM switch handoff ownership is not documented or end-to-end proven

- Severity: Medium
- Category: Architecture / contract observability
- Problem: `RunGameMasterUseCase` intentionally updates only the session’s `activeAvatarId` (`run-game-master.use-case.ts:544-553`). Conversation close/create and switch signaling are delegated to the platform’s existing avatar-switch mechanism, rather than being duplicated in GM (`run-game-master.use-case.ts:640-668`). The next-turn orchestration is stored with the switched Avatar ID (`run-game-master.use-case.ts:577-592`), while `SendMessageUseCase` only consumes state whose Avatar ID matches the supplied conversation Avatar (`send-message.use-case.ts:485-490`).
- Why it matters: This is a valid boundary only if a known platform consumer completes the handoff. Without that documented path and an integration test, the old conversation can remain active and the new orchestration can be ignored until the handoff occurs. The current behavior also differs from the close/create wording in `docs/GAME_MASTER_CONTRACT.md:229-235`.
- Evidence: The EPIC-specific test intentionally asserts no conversation update or creation (`run-game-master.avatar-switch.use-case.test.ts:137-158`). The repository contains a separate `SwitchAvatarUseCase` for platform-owned lifecycle, but no test follows a GM switch through that consumer boundary.
- Recommendation: Document GM switching as an advisory/session-state update and identify the platform consumer responsible for invoking `SwitchAvatarUseCase`. Add a black-box test covering GM output → consumer handoff → conversation state → next message Avatar and consumed guidance. Only make GM own close/create or emit a separate event if the canonical platform contract requires it.

### Unrelated factual questions can reuse stale retrieval plans

- Severity: High
- Category: Retrieval correctness
- Problem: `shouldUsePlannedRetrieval()` keeps old GM queries when any user token overlaps or when the message contains generic continuation/question words (`typed-retrieval-query-builder.ts:34-67`). The fallback includes `what`, `where`, `why`, and `how`; therefore a new unrelated question such as “What is your favorite color?” can retain a prior Mona-location plan despite having no topic overlap.
- Why it matters: Old factual context can dominate retrieval for a new subject, produce a false `insufficient_evidence` instruction, and undermine the EPIC requirement that unrelated messages ignore or heavily de-prioritize stale plans.
- Evidence: Existing tests only cover explicit topic-change phrases and emotional reflection (`typed-retrieval-query-builder.test.ts:88-124`). There is no unrelated factual negative case, no multilingual unrelated case, and no entity/topic fingerprint in the stored orchestration state.
- Recommendation: Make the default safe behavior to omit planned queries unless the new message shares a meaningful topic/entity signal or an explicit continuation signal. Keep the latest user query and normal working-memory retrieval. Add deterministic tests for unrelated factual questions, topic changes without English trigger phrases, and scenario-language inputs.

### Director Notes policy conflicts with EPIC documentation

- Severity: Medium
- Category: Documentation / contract alignment
- Problem: The implementation intentionally requires a non-empty `directorNotes` value: the parser rejects missing/blank notes (`gm-output-parser.ts:69-83`), the static prompt says they are required (`gm-prompt.service.ts:48-52`), and tests protect that behavior. This is accepted implementation policy, but the EPIC README and regression prompt still describe Director Notes as optional.
- Why it matters: The current code and tests are internally consistent, but the stale EPIC wording can cause a future maintainer to “fix” intentional behavior or can lead clients to omit a value that the parser rejects. The source of truth is ambiguous.
- Evidence: `gm-output-parser.test.ts` intentionally rejects missing/blank notes; `GameMasterOutput` types `directorNotes` as required; the EPIC README Definition of Done says notes remain optional.
- Recommendation: Update the EPIC README, implementation prompts, `GAME_MASTER_CONTRACT.md`, and any shared contract documentation to state that Director Notes are required and non-empty. If product policy later returns to optional notes, change the parser/type/prompt/tests together rather than treating this as a parser-only change.

### Contradiction filtering rejects unrelated candidate facts

- Severity: Medium
- Category: Memory correctness
- Problem: `isUnsupportedContradictedAvatarClaim()` first checks whether the candidate fact itself is user- or provenance-supported, but otherwise rejects it whenever any user message contains a broad contradiction signal and any Avatar message exists (`memory-maintenance.service.ts:432-452`). The contradiction is not associated with the fact’s entity, key, or value.
- Why it matters: A conversation that challenges one Avatar claim can silently discard unrelated, otherwise safe candidate facts from the same compaction window. This reduces memory quality and makes fact retention depend on unrelated wording.
- Evidence: The Mona test proves the desired rejection for the target claim, but no test includes a contradicted Mona claim plus an unrelated explicit/stable candidate fact.
- Recommendation: Associate contradiction detection with the fact-bearing exchange/entity, or require the candidate fact to be traceably derived from the challenged claim before rejecting it. Add a regression test that preserves an unrelated supported fact while dropping the contradicted Mona fact.

### Persisted orchestration normalization drops supported fields

- Severity: Medium
- Category: Structural maintainability / compatibility
- Problem: The current domain contract supports retrieval `scopes` and multi-target routing `unlockDecisions`, but `normalizePersistedOrchestration()` only reads `required`, `queries`, and `requiredFacts` for retrieval and only reads `action`, `avatarId`, and `reason` for routing (`gm-state-migration.ts:98-140`). The Postgres repository normalizes every loaded JSONB orchestration through this function.
- Why it matters: A state saved with current fields does not round-trip with the same shape after a process restart. `unlockDecisions` can disappear from diagnostics/inspection and future consumers, while `scopes` cannot be recovered if later used by the Avatar retrieval path.
- Evidence: `RetrievalPlan` and `RoutingDecision` declare these fields in `game-master.types.ts`; migration tests cover legacy conversion but not a complete current-contract round trip.
- Recommendation: Make the migration normalizer consume the canonical current fields, including scope validation and unlock-decision normalization, and add a persistence round-trip test for the complete current orchestration shape. Keep legacy conversion separate from current-shape parsing.

### The GM application use case has accumulated avoidable coupling

- Severity: Medium
- Category: Architecture / maintainability
- Problem: `RunGameMasterUseCase` has 15 constructor dependencies, many optional, suppresses the max-lines rule, and retains an injected `IConversationRepository` that is not used (`run-game-master.use-case.ts:1-89`). It also constructs fallback `MemorySelectionService` instances with casted repository stubs.
- Why it matters: New orchestration features now expand a large coordinator instead of composing focused application services. Optional dependency combinations are difficult to reason about and can hide missing production wiring. The unused conversation port contributed to the misleading switch test and the incomplete transition behavior.
- Evidence: Constructor shape and fallback creation in `run-game-master.use-case.ts`; `conversationRepository` has no runtime use in the class.
- Recommendation: Remove the dead conversation dependency immediately. Then, in the next focused refactor, group required runtime collaborators behind small application ports/services for GM context loading, decision application, and persistence. Do not introduce a generic framework or abstraction layer beyond those concrete seams.

### GM persistence failures are not consistently diagnosable

- Severity: Medium
- Category: Operations / observability
- Problem: LLM and invalid-output failures emit `gm_error`, but state persistence and session-note failures after a valid LLM response propagate through the outer catch and only reach the background dispatch log (`run-game-master.use-case.ts:101-125`, `:198-208`). They do not emit a structured `gm_error` with an error code.
- Why it matters: Operators can see a processing failure but cannot distinguish provider failure from state persistence failure through the documented event surface. This weakens supportability and replay diagnosis.
- Evidence: `run-game-master.events.ts` defines safe error emission for `llm_error` and `invalid_output`; no equivalent persistence error path exists.
- Recommendation: Wrap the post-LLM persistence boundary with a safe `gm_error` emission using a bounded persistence error code and correlation metadata, while preserving the non-blocking caller behavior.

## Architecture Review

The implementation largely respects the modular monolith boundaries:

- API routes remain thin and delegate to application use cases.
- Domain prompt construction, parsing, normalization, memory policy, and retrieval-query policy are infrastructure-independent.
- LLM access remains behind `ILlmAdapter` and model resolution/observability wrappers; no provider SDK leaks into domain logic.
- Runtime side effects are coordinated in the application layer and published through the session event publisher.
- GM and Avatar responsibilities are separated: GM prepares future-turn guidance; Avatar composes and generates the response.

The main architecture concern is coordinator growth. `RunGameMasterUseCase` now owns context loading, retrieval preparation, LLM resolution, parsing, routing validation, unlocking, persistence, events, and diagnostics. That is still a valid application-layer location, but the optional-dependency constructor and unused conversation repository show the boundary is becoming harder to maintain. No separate infrastructure or vendor leakage was found.

## Test Review

Strong tests:

- Parser tests reject malformed dialogue control, invalid modes, invalid retrieval shapes, and obsolete top-level fields.
- Dynamic prompt tests verify routing capability omission for single-Avatar, unlocked, and locked configurations.
- Send-message tests assert the actual retrieval request, query variants, consumed turn, dialogue guidance, and insufficient-evidence prompt.
- Memory tests prove the Mona contradiction filter, verified-context labeling, working-memory persistence, and ownership of canonical fields.
- Integration coverage verifies composed GM prompt rendering, persisted orchestration, runtime suggestions, event safety, and observability metadata.
- Failure tests cover invalid JSON, LLM failures, event-log failures, and trace failures.

Weak or implementation-coupled tests:

- The switch test asserts that conversation update/create methods are _not_ called. This is valid evidence for the accepted GM/platform ownership boundary, but it does not prove that the platform consumer completes the subsequent handoff.
- Many prompt tests assert exact English prose and absence of substrings. Some structural assertions are appropriate at the LLM boundary, but exact wording is brittle and does not prove the generated Avatar response behavior.
- Coverage is high, but the missing behavior is exactly the kind coverage can miss: no test follows a GM decision through the public/runtime consumer boundary.

Missing regression tests:

- Unrelated factual user message after a mandatory GM plan; this must prove old queries are not sent.
- GM switch followed by the platform consumer; this must prove the documented handoff, target Avatar, and guidance consumption. A GM-only conversation mutation test is not required under the accepted ownership model.
- Postgres current-contract orchestration round trip including `scopes` and `unlockDecisions`.
- A contradiction window containing one contradicted Avatar claim and one unrelated supported candidate fact.
- State/session persistence failure after a valid GM response and its resulting operator-visible diagnostic.

## Documentation Gaps

- `docs/GAME_MASTER_CONTRACT.md:229-235` describes close/create behavior for accepted switches, while the implementation delegates that lifecycle to the platform switch mechanism. Document the ownership boundary and consumer handoff explicitly.
- The EPIC README and implementation prompts say Director Notes are optional, while the system prompt, parser, and tests require them. Update the EPIC source documents to the accepted required-note contract.
- `docs/PROJECT_STATUS.md` and `docs/EPICS.md` describe EPIC 8.5 as shipped/current, but should not claim complete switch and stale-plan regression coverage until the missing consumer tests and fixes exist.
- `docs/API_CONTRACT.md` documents diagnostic retrieval fields but does not make the switch runtime event/next-conversation behavior explicit. Update it if the transition is made observable through the public runtime surface.

## Path to A

Minimal steps:

1. Document the GM-switch/platform-handoff ownership boundary and add a consumer-level next-message test.
2. Update the EPIC and Game Master contract documentation to make required, non-empty Director Notes canonical.
3. Replace the stale-plan fallback with a safe relevance rule and add unrelated factual and multilingual negative tests.
4. Narrow contradiction filtering and add the unrelated-fact regression.
5. Fix current-contract persistence normalization and add a Postgres round-trip test.
6. Add structured diagnostics for post-LLM persistence failures, remove the dead dependency, and synchronize the source-of-truth documentation.

## Final Recommendation

- Close with debt

## Remediation Outcome

### Changes Made

- Replaced generic question-word heuristics with conservative stale-plan reuse: unrelated factual questions now use only the current user query, while explicit continuation language can retain the plan.
- Preserved `retrievalPlan.scopes` and `routing.unlockDecisions` in persisted-state normalization and added current-contract round-trip coverage, including a guarded Postgres integration case.
- Scoped contradiction rejection to an Avatar claim containing the candidate value followed by a user contradiction. Unrelated candidate facts are retained, with a regression test covering both outcomes.
- Added structured `persistence_error` GM diagnostics for state or GM-note persistence failures after a valid LLM response.
- Removed the unused conversation repository from the GM use case, removed fake memory repository fallbacks, and replaced positional optional constructor arguments with an explicit options object.
- Documented required non-empty Director Notes and the platform-owned Avatar-switch handoff across the EPIC, Game Master, API, status, and EPIC summary documents.
- Added a behavior-level GM-to-platform switch test proving session target recording followed by old-conversation closure and new-conversation creation.

### Findings Resolved

- Unrelated factual questions reusing stale retrieval plans: resolved in policy and deterministic tests.
- Persisted orchestration dropping `scopes` and `unlockDecisions`: resolved in normalization and round-trip tests.
- Broad contradiction filtering: resolved by associating rejection with the contradicted Avatar claim and testing preservation of an unrelated fact.
- Missing post-LLM persistence diagnostics: resolved with `persistence_error` events and failure coverage.
- GM constructor coupling and dead fallback dependencies: resolved through explicit options, dead-port removal, and removal of casted fake repositories.
- Director Notes contract drift: resolved by making the required/non-empty policy canonical in the EPIC and project documentation.
- GM switch handoff ambiguity: resolved as an explicit platform-owned boundary, with a consumer-path behavior test. GM intentionally does not duplicate conversation lifecycle or emit a second switch event.

### Findings Deferred

- The GM application coordinator remains a relatively large application-layer class. Its dependency boundary is now explicit and the unused/fake collaborators are gone; splitting the remaining cohesive flow is deferred because it would add abstraction without changing behavior.
- The full environment-dependent integration suite was not used as a build gate because its database/stack setup did not complete in this workspace. The targeted handoff integration test passed, and the mandatory unit gates plus coverage passed.

### Build Gates

- lint: PASS
- typecheck: PASS
- tests: PASS — 878 tests across 140 files
- coverage: PASS — 87.56% statements, 84.65% branches, 96.69% functions, 87.56% lines

### Final Feature Confidence

- Async single-call GM execution remains non-blocking and is proven by unit and composed runtime tests.
- Unrelated factual messages no longer inherit stale retrieval proposals; related overlap and explicit continuation remain supported.
- Current retrieval scopes and multi-target unlock decisions survive normalization and the guarded Postgres persistence path.
- Required Director Notes are enforced by parser, prompt, types, tests, and synchronized documentation.
- Contradicted Avatar claims are rejected without discarding unrelated candidate facts.
- State persistence failures emit bounded `gm_error` diagnostics with `persistence_error`.
- GM switch decisions record the target, and the existing platform switch use case closes the old conversation and creates the new Avatar episode.

### Final Grade

**A — safe foundation with strong behavioral tests, explicit boundaries, and synchronized contracts.**

### Remaining Risks

- The quality of generated narrative guidance and retrieval relevance remains model-dependent and is intentionally outside deterministic CI proof.
- The full Postgres integration path remains dependent on the configured database environment; its current-contract round-trip test is guarded by `DB_AVAILABLE`.
- The platform client must invoke the documented switch endpoint after an advisory GM switch decision; this ownership is explicit and intentionally not duplicated inside GM.
