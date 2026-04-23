# Code Audit — EPIC 4.1: Async Game Master v1

**Auditor:** GitHub Copilot  
**Date:** 2026-05-08  
**Scope:** All code produced under EPIC 4.1 (prompts 01–05)

---

## Scope Audited

| Prompt | Deliverable                   | Files Reviewed                                                                                                                                                                                                                                                                                                                                        |
| ------ | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01     | GM state persistence          | `domain/game-master/game-master.types.ts`, `application/ports/IGmStateRepository.ts`, `infrastructure/db/in-memory-gm-state.repository.ts`, `infrastructure/db/repositories/postgres-gm-state.repository.ts`, `infra/postgres/init.sql`                                                                                                               |
| 02     | Trigger engine                | `domain/game-master/trigger-engine.ts`, `domain/game-master/trigger-engine.test.ts`                                                                                                                                                                                                                                                                   |
| 03     | RunGameMasterUseCase + wiring | `domain/game-master/gm-state-reducer.ts`, `domain/game-master/gm-prompt.service.ts`, `application/use-cases/run-game-master/run-game-master.use-case.ts`, `application/use-cases/run-game-master/run-game-master.types.ts`, `application/use-cases/send-message/send-message.use-case.ts`, `api/routes/conversations.ts`, `api/server.ts`, `index.ts` |
| 04     | Event log + observability     | `application/ports/IEventLogRepository.ts`, `infrastructure/db/in-memory-event-log.repository.ts`, `infrastructure/db/repositories/postgres-event-log.repository.ts`                                                                                                                                                                                  |
| 05     | Tests + hardening             | `domain/game-master/gm-state-reducer.test.ts`, `application/use-cases/run-game-master/run-game-master.use-case.test.ts`, `infrastructure/db/repositories/postgres-gm-state.repository.integration.test.ts`, `infrastructure/db/repositories/postgres-event-log.repository.integration.test.ts`                                                        |

---

## Executive Summary

EPIC 4.1 is a **strong, well-structured implementation** that faithfully follows the GAME_MASTER_CONTRACT.md specification and the project's 4-layer architecture. The Director/Actor model is correctly realised: the Avatar always answers first; the Game Master fires non-blocking after the avatar message is persisted.

All 9 targeted files in the domain and application layers carry clean, type-safe, purposeful code. The trigger engine and state reducer are pure functions at 100% coverage. The orchestration use case handles all failure modes (LLM error, invalid JSON output, missing event log) without propagating errors into the user response path.

Two gaps prevent a clean Grade A: (1) branch coverage for `RunGameMasterUseCase` sits at 59%, leaving several error-recovery branches structurally untested; (2) the GM system prompt does not embed the `GameMasterOutput` JSON schema, creating a real-world reliability risk for LLM compliance. Neither is a blocking defect, but both should be addressed before extending this module.

---

## Final Grade

**B+**

| Dimension                | Score | Notes                                                                    |
| ------------------------ | ----- | ------------------------------------------------------------------------ |
| Architecture adherence   | A     | Strict 4-layer, no shortcuts                                             |
| Functional correctness   | A     | All DoD items verified                                                   |
| Non-blocking design      | A     | `void .execute().catch()` pattern is correct                             |
| Domain logic quality     | A     | Trigger engine and reducer are exemplary                                 |
| Test coverage — domain   | A     | 100% stmts/branches on trigger-engine, gm-state-reducer                  |
| Test coverage — use case | C+    | 88% stmts but only 59% branches                                          |
| GM prompt reliability    | B-    | No schema embedded; relies on `safeParseGameMasterOutput` fallback       |
| Infrastructure quality   | A-    | Solid PostgreSQL UPSERT; minor: no read path in event log                |
| Documentation alignment  | B+    | GAME_MASTER_CONTRACT Section 4 policy shape diverges from implementation |

---

## Build Health

| Check                     | Status                                      | Detail                                                                               |
| ------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------ |
| `@gami/core` lint         | ✅ PASS                                     | Zero warnings or errors                                                              |
| `@gami/core` typecheck    | ✅ PASS                                     | Strict mode, zero errors                                                             |
| `@gami/console` lint      | ❌ FAIL (pre-existing)                      | `Cannot find module 'vitest'` in `session-state.test.ts`; not introduced by EPIC 4.1 |
| `@gami/console` typecheck | ❌ FAIL (pre-existing)                      | Same cause as above                                                                  |
| Unit tests                | ✅ 187 / 187                                | All 35 test files pass                                                               |
| Overall coverage          | 91.44% stmts / 82.23% branches / 98.06% fns | See per-file breakdown below                                                         |

### Per-file coverage (EPIC 4.1 files)

| File                                | Stmts            | Branches   | Fns   |
| ----------------------------------- | ---------------- | ---------- | ----- |
| `trigger-engine.ts`                 | 100%             | 100%       | 100%  |
| `gm-state-reducer.ts`               | 100%             | 100%       | 100%  |
| `gm-prompt.service.ts`              | 100%             | 100%       | 100%  |
| `run-game-master.use-case.ts`       | 88.17%           | **59.09%** | 91.3% |
| `in-memory-gm-state.repository.ts`  | 100%             | 100%       | 100%  |
| `in-memory-event-log.repository.ts` | 100%             | 100%       | 100%  |
| `postgres-gm-state.repository.ts`   | integration only | —          | —     |
| `postgres-event-log.repository.ts`  | integration only | —          | —     |

---

## Definition of Done — Verification

| DoD Item                                             | Status                  | Evidence                                                                             |
| ---------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------ |
| `gm_states` table in `init.sql`                      | ✅                      | `infra/postgres/init.sql` — UPSERT-friendly schema with all required columns         |
| `gm_states` in `TRUNCATE` list (`test-helpers.ts`)   | ✅                      | Confirmed in truncation helper                                                       |
| `Session.activeAvatarId` field added to type + DB    | ✅                      | `session.types.ts` and `init.sql` both updated                                       |
| Trigger engine: `turn_threshold`                     | ✅                      | `trigger-engine.ts:22–38`; 5+ tests                                                  |
| Trigger engine: `topic_repeat`                       | ✅                      | `trigger-engine.ts:40–46`; 3+ tests                                                  |
| Trigger engine: `progression_stalled`                | ✅                      | `trigger-engine.ts:48–56`; 4+ tests                                                  |
| `RunGameMasterUseCase` fires non-blocking            | ✅                      | `send-message.use-case.ts`: `void this.runGameMasterUseCase.execute(...).catch(...)` |
| Trigger engine called inside use case                | ✅                      | `run-game-master.use-case.ts:43`                                                     |
| LLM called on trigger, state reduced, notes stored   | ✅                      | Lines 58–135                                                                         |
| No trigger → state increment + `gm_skipped` event    | ✅                      | `handleSkippedTurn()`                                                                |
| GM notes injected into Avatar system prompt          | ✅                      | `persona-prompt.service.ts`: `Director notes: ${opts.gmNotes}`                       |
| Every GM run emits `GameMasterEvent`                 | ✅                      | Both triggered and skipped paths                                                     |
| Unit tests: trigger logic, reducer, use case, events | ✅                      | 30 unit tests across 4 describe blocks                                               |
| `pnpm lint` (@gami/core)                             | ✅                      | Clean                                                                                |
| `pnpm typecheck` (@gami/core)                        | ✅                      | Clean                                                                                |
| `pnpm test`                                          | ✅                      | 187/187 pass                                                                         |
| `docs/GAME_MASTER_CONTRACT.md` updated               | ✅                      | Section 8 reflects implemented trigger defaults                                      |
| `docs/DATA_MODEL.md` updated                         | ✅ (per PROJECT_STATUS) | `gm_states` and `event_log` documented                                               |
| `docs/PROJECT_STATUS.md` updated                     | ✅                      | EPIC 4.1 marked Complete                                                             |

---

## Feature Confidence Matrix

| Feature                                        | Confidence | Notes                                                                                                   |
| ---------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------- |
| Non-blocking GM execution                      | High       | Pattern is correct and tested                                                                           |
| Trigger evaluation (all 3 types)               | High       | 100% coverage, all edge cases                                                                           |
| State reduction and immutability               | High       | 100% coverage, mutation test included                                                                   |
| LLM error recovery                             | High       | Caught, state still incremented, event emitted                                                          |
| Invalid JSON recovery                          | High       | `safeParseGameMasterOutput` handles both `JSON.parse` failure and shape mismatch                        |
| GM notes injection in Avatar prompt            | High       | Tested in `persona-prompt.service.test.ts`                                                              |
| Event log emission (triggered)                 | High       | Shape and content tested                                                                                |
| Event log emission (skipped)                   | High       | Shape and content tested                                                                                |
| Event log emission (LLM error path)            | High       | Tested by `RunGameMasterUseCase — LLM error handling`                                                   |
| GM state Postgres round-trip                   | High       | 5 integration tests with full field coverage                                                            |
| Event log Postgres round-trip                  | High       | 6 integration tests including FK + JSONB                                                                |
| Policy overrides from scenario config          | Medium     | `extractScenarioPolicy` logic is exercised but branch coverage is incomplete                            |
| LLM produces valid `GameMasterOutput`          | Medium     | Schema not embedded in system prompt; relies entirely on parser fallback                                |
| `conversationMode` and `nextAvatarId` handling | Medium     | `conversationMode` is parsed but not acted upon in current code — no conversation start logic triggered |
| `emitEventSafe` error swallowing               | Low        | The inner `catch` branch (event log write failure) has no test                                          |

---

## Strengths

1. **Architecture purity.** All 4 layer boundaries are respected without exception. Domain types, ports, and infrastructure implementations are cleanly separated. No business logic leaks into repositories; no infrastructure code in domain.

2. **Non-blocking design is correct.** `SendMessageUseCase` fires GM via `void this.runGameMasterUseCase.execute(...).catch(...)`. The `.catch()` guard ensures the main response path is never disrupted. The GM error is logged to stderr with relevant context (sessionId, correlationId).

3. **Trigger engine is exemplary.** `evaluateTriggers()` is a pure function with no side effects, no dependencies, and deterministic behaviour. Default constants are named and exported. Custom policy overrides are cleanly parameterised. Priority ordering (`turn_threshold` > `topic_repeat` > `progression_stalled`) is enforced and tested.

4. **State reducer is immutable and safe.** `reduceGmState()` creates new arrays and objects; the input state is never mutated. A dedicated test verifies immutability of array references. Progression string manipulation is robust (no duplicate `[advanced]` markers).

5. **Privacy-first event payload.** Tests explicitly assert that `userMessageText` and the raw system prompt do not appear in event payloads. This matches the GAME_MASTER_CONTRACT.md requirement ("Never include prompt content or raw user message in the diagnostic payload").

6. **Graceful multi-level error handling.** Three distinct failure modes (LLM network error, malformed JSON, invalid shape) are all handled without bubbling. Each correctly: increments state, emits a `gm_skipped` event, and fires an observability trace.

7. **Full production wiring.** `index.ts` instantiates `PostgresGmStateRepository`, `PostgresEventLogRepository`, `PostgresScenarioRepository`, and `RunGameMasterUseCase` with all dependencies. The `SendMessageUseCase` receives `runGameMasterUseCase` automatically. In-memory fallbacks are provided in `createServer()` for test environments.

8. **Upsert semantics in Postgres.** `PostgresGmStateRepository.save()` uses `ON CONFLICT (session_id) DO UPDATE SET ...`, ensuring idempotency. Integration tests verify the upsert; the row count remains 1 after two successive saves.

---

## Findings

### F1 — Branch coverage gap in `RunGameMasterUseCase` (Medium)

**Branch coverage: 59.09%** — uncovered lines include 272, 401, and 427–456.

Key untested branches:

- `emitEventSafe()` inner catch block (event log write fails silently) — no test verifies that a failed `eventLogRepository.append()` does not propagate
- `traceSafe()` inner catch block (observability write fails silently) — same
- `extractScenarioPolicy()` sub-branches: the scenario exists but has no `policy` key; the policy candidate has some valid and some invalid values; `toValidPositiveInteger()` receiving a float or negative integer
- `handleTriggeredTurn()`: the branch where `stateUpdate.activeAvatarId` is provided but equals `currentState.currentAvatarId` (no session update should fire)

The domain-level tests achieve 88% of statements but the untested branches are all in defensive/error-recovery code, which is exactly where silent failures hide in production.

**Recommendation:** Add targeted unit tests for `emitEventSafe` failure (mock `eventLogRepository.append` to throw), `traceSafe` failure (mock `observability.trace` to throw), the `activeAvatarId === currentAvatarId` no-op branch, and `extractScenarioPolicy` with malformed values.

### F2 — GM system prompt does not embed `GameMasterOutput` schema (Medium)

`gm-prompt.service.ts` tells the LLM to "output valid JSON only" and "match the GameMasterOutput contract exactly", but never shows the contract. In practice, the LLM must infer the schema from the user-turn JSON input alone (which includes `state` and `context` but not the expected output shape).

This creates a real production risk: if the LLM returns a plausible but non-conformant JSON (e.g., `progressionUpdate` instead of `progression`, or omitting `interactionIncrement`), `safeParseGameMasterOutput` will silently degrade the turn as a `gm_skipped`. Over time this leads to GM being effectively disabled without any alerting.

**Recommendation:** Embed a compact JSON schema example directly in the system prompt — not the full TypeScript type, but a minimal annotated example showing required fields and their accepted values. The GAME_MASTER_CONTRACT.md Section 11 example JSON is a good template.

### F3 — `GAME_MASTER_CONTRACT.md` Section 4 `policy` shape diverges from implementation (Low)

The contract's Section 4 shows a rich `policy` object with `transitionRules`, `pacing`, `allowedActions`, `constraints`. The implementation uses a flat `TriggerPolicy` with `turnThreshold`, `maxTopicRepeatCount`, `maxTurnsWithoutProgression`. Section 8 of the same document does describe the implemented shape correctly, creating internal inconsistency.

**Recommendation:** Update Section 4 of `GAME_MASTER_CONTRACT.md` to show the implemented `TriggerPolicy` interface instead of the legacy shape.

### F4 — `IEventLogRepository` has no read path (Low, deferred)

The port only exposes `append()`. There is no `findBySessionId()` or equivalent query method. The admin inspection endpoint referenced in the contract (`GET /v1/admin/sessions/{sessionId}/events`) does not yet exist. This is an acceptable Phase A deferral but should be tracked.

**Recommendation:** Track as a Phase B item. When the admin endpoint is built, a `findBySessionId(sessionId: string, opts?: { limit?: number }): Promise<StoredEvent[]>` method will be needed on both the port and the Postgres implementation.

### F5 — `conversationMode` field parsed but not acted upon (Low)

`GameMasterOutput.conversationMode` is validated (`'new' | 'continue'`) and included in the event payload, but the use case does not currently start a new conversation when `conversationMode === 'new'`. This is noted as in-scope for a future EPIC (conversation lifecycle management), but it means the `new` value is effectively a no-op at runtime.

**Recommendation:** Add a comment in `handleTriggeredTurn()` near the `conversationMode` parsing noting the deferred handling.

### F6 — Console app pre-existing lint/typecheck failures (Low, pre-existing)

`@gami/console` fails both lint and typecheck due to `Cannot find module 'vitest'` in `session-state.test.ts`. This was present before EPIC 4.1 and is not caused by it, but it means `pnpm lint` and `pnpm typecheck` at workspace level return non-zero exit codes.

**Recommendation:** Fix the `@gami/console` tsconfig to include vitest types, or install `@types/vitest` in that package' devDependencies.

---

## Architecture Review

The implementation is textbook-compliant with the 4-layer architecture defined in `ARCHITECTURE.md`.

- **API layer** (`conversations.ts`): receives `RunGameMasterUseCase` as an injected option and passes it straight to `SendMessageUseCase`. No GM logic here.
- **Application layer** (`run-game-master.use-case.ts`): orchestrates all GM activity. Calls domain functions, depends on ports (not concrete implementations).
- **Domain layer** (`trigger-engine.ts`, `gm-state-reducer.ts`, `gm-prompt.service.ts`): pure functions with no external dependencies.
- **Infrastructure layer** (`postgres-gm-state.repository.ts`, `postgres-event-log.repository.ts`): SQL-only, no domain logic.

The optional dependency pattern (`scenarioRepository?: IScenarioRepository`, `eventLogRepository?: IEventLogRepository`) is well-designed: the use case degrades gracefully when these are absent (e.g., in unit tests that don't need them).

One design note: `RunGameMasterUseCase` has 7 constructor parameters. This is acceptable for a Phase A orchestrator, but if dependencies grow further a configuration object or builder pattern should be considered.

---

## Test Review

### Coverage summary

| Test type              | Files                                                                                                   | Tests | All pass?              |
| ---------------------- | ------------------------------------------------------------------------------------------------------- | ----- | ---------------------- |
| Unit — domain          | `trigger-engine.test.ts`, `gm-state-reducer.test.ts`                                                    | 23    | ✅                     |
| Unit — use case        | `run-game-master.use-case.test.ts`                                                                      | 7     | ✅                     |
| Integration — Postgres | `postgres-gm-state.repository.integration.test.ts`, `postgres-event-log.repository.integration.test.ts` | ~11   | ✅ (when DB available) |

### What is well-tested

- All 3 trigger types with default and custom thresholds
- Trigger priority ordering and zero-state base case
- State reducer: all 4 state fields, immutability, edge cases (duplicate `[advanced]`, empty `topicCovered`)
- Use case: no-trigger path, triggered full path, invalid JSON fallback
- Event payload: shape, field presence, privacy (user message not leaked)
- LLM error recovery: state still incremented, `gm_skipped` emitted with correct `triggerReason`
- Postgres GM state: insert, upsert, round-trip of all fields, null `currentAvatarId` → `undefined`
- Postgres event log: append, JSONB payload, nullable session FK, valid FK with real session

### What is missing

1. `emitEventSafe` catch path (event log write failure does not propagate)
2. `traceSafe` catch path (observability write failure does not propagate)
3. `extractScenarioPolicy` branches (valid/invalid policy values from scenario config)
4. `handleTriggeredTurn` → `activeAvatarId` unchanged branch (no session update)
5. `loadScenarioContext` → scenario not found path (scenarioRepository returns null)

---

## Documentation Gaps

| Gap                                                                          | Severity | Location                      |
| ---------------------------------------------------------------------------- | -------- | ----------------------------- |
| Section 4 `context.policy` in GAME_MASTER_CONTRACT.md shows old rich shape   | Low      | `GAME_MASTER_CONTRACT.md:§4`  |
| GM system prompt does not reference the output schema contract               | Medium   | `gm-prompt.service.ts`        |
| `conversationMode: 'new'` deferred handling not noted in code                | Low      | `run-game-master.use-case.ts` |
| `IEventLogRepository` read path deferred to Phase B — not documented as such | Low      | `IEventLogRepository.ts`      |

---

## Path to A

To reach Grade A, the following must be addressed in order of priority:

1. **Branch coverage on `RunGameMasterUseCase`** — add 4–5 targeted unit tests for defensive branches (`emitEventSafe` failure, `traceSafe` failure, unchanged `activeAvatarId`, `scenarioRepository` null return, policy extraction edge cases). Expected branch coverage lift: 59% → 85%+.

2. **GM system prompt schema** — add a compact example JSON block to `buildGameMasterSystemPrompt()` showing required fields and valid values. This reduces the rate of `safeParseGameMasterOutput` fallback in production and makes LLM compliance observable.

3. **Console app lint fix** — install `vitest` types in `@gami/console` devDependencies so that workspace-level `pnpm lint` and `pnpm typecheck` return clean exit codes.

4. **GAME_MASTER_CONTRACT.md Section 4** — update the `context.policy` type to match the implemented `TriggerPolicy` interface.

None of these require structural changes. The implementation foundation is solid.

---

## Final Recommendation

**Merge with targeted follow-up.** EPIC 4.1 delivers complete, correct, and well-structured async Game Master infrastructure. The non-blocking design, trigger engine, state reducer, and event log are production-ready. The branch coverage gap and GM prompt thinness are the only items worth addressing before building on this module in a subsequent EPIC. Both can be resolved in a single focused hardening pass without changing any interfaces or schemas.
