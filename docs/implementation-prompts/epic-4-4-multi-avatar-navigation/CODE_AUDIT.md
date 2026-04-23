# Code Audit — EPIC 4.4 Multi-Avatar Navigation v1

## Scope audited

- EPIC source of truth: `docs/implementation-prompts/epic-4-4-multi-avatar-navigation/README.md`
- Project alignment docs reviewed:
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
- Implementation reviewed across:
  - domain transition model
  - `RunGameMasterUseCase`
  - manual switch/read endpoints
  - relevant repositories
  - unit, integration, and stack-E2E coverage

## Executive Summary

EPIC 4.4 is mostly delivered: the transition domain model exists, GM-driven switching is activated, manual switching works, read endpoints exist, and the documentation was updated. The implementation generally respects the modular monolith boundaries: API handlers stay thin, application use cases orchestrate ports, and domain transition evaluation remains pure.

The main concerns are correctness and proof quality around GM-driven routing. Two behavior gaps materially reduce confidence: GM handoff notes are persisted but never cleared after the next avatar turn, and GM-driven switching does not validate `nextAvatarId` against actual scenario avatars when no transition rules are configured. In addition, a failed GM switch can leave persisted GM state out of sync with the real session/conversation state, and test coverage does not currently prove these higher-risk behaviors from a consumer-observable perspective.

## Final Grade

**C**

## Build Health

- lint: **FAIL** (`pnpm lint` failed in the audit environment because `turbo` could not write log/cache files under the read-only sandbox; direct package-level `eslint` runs for `packages/shared`, `apps/core`, and `apps/console` completed without reported lint errors)
- typecheck: **FAIL** (`pnpm typecheck` and direct `tsc --noEmit` invocations were blocked by `tsconfig.tsbuildinfo` writes in the read-only sandbox)
- tests: **FAIL** (`pnpm test` and direct Vitest runs were blocked by read-only temp/cache writes in this audit environment)
- coverage: **Unavailable** (`pnpm test:coverage` was blocked by the same filesystem restrictions)

## Feature Confidence Matrix

| Feature                            | Expected Behavior                                                                                                            | Evidence                                                                                                                                                                                            | Confidence (High/Medium/Low) | Notes                                                                                                                                |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Transition engine                  | Deterministically returns eligible transitions for progression/topic-repeat and never returns manual transitions             | `apps/core/src/domain/avatar/transition-engine.ts`, `apps/core/src/domain/avatar/transition-engine.test.ts`                                                                                         | High                         | Pure domain function, behavior-driven unit coverage is strong.                                                                       |
| GM-driven switch path              | On valid GM handoff, close current conversation, create next conversation, update active avatar, pass one-turn handoff notes | `apps/core/src/application/use-cases/run-game-master/run-game-master.use-case.ts`, `run-game-master.avatar-switch.use-case.test.ts`                                                                 | Low                          | Core path exists, but correctness gaps remain around note lifecycle, invalid avatar validation, and failure-state drift.             |
| Manual switch endpoint             | Validate session/avatar, close previous conversation, create handoff conversation, update session                            | `apps/core/src/application/use-cases/switch-avatar/switch-avatar.use-case.ts`, `switch-avatar.use-case.test.ts`, `api/routes/sessions.stack-e2e.test.ts`                                            | High                         | Stronger end-to-end evidence than GM path.                                                                                           |
| Available avatars endpoint         | Return current avatar and scenario avatars for the session                                                                   | `apps/core/src/application/use-cases/get-available-avatars/get-available-avatars.use-case.ts`, `get-available-avatars.use-case.test.ts`, `sessions.stack-e2e.test.ts`                               | Medium                       | Endpoint works, but it exposes all scenario avatars regardless of status; filtering semantics are under-specified and untested.      |
| Avatar transition history endpoint | Return transition chain ordered by time, with `session_start` on first conversation and handoff linkage afterwards           | `apps/core/src/application/use-cases/get-avatar-transitions/get-avatar-transitions.use-case.ts`, `get-avatar-transitions.use-case.test.ts`, `sessions.stack-e2e.test.ts`, `persistence.e2e.test.ts` | Medium                       | Happy-path coverage is good, but ordering is currently delegated to repository implementations rather than enforced in the use case. |
| Doc sync                           | API/data model/GM docs and project status reflect delivered EPIC scope                                                       | `docs/API_CONTRACT.md`, `docs/DATA_MODEL.md`, `docs/GAME_MASTER_CONTRACT.md`, `docs/PROJECT_STATUS.md`                                                                                              | High                         | Documentation updates for the advertised EPIC scope are present.                                                                     |

## Strengths

- The architecture is mostly clean and aligned with project rules: domain transition logic is pure, use cases depend on ports, and Fastify route handlers stay thin.
- Manual switch behavior is well implemented and relatively well proven with unit, stack-E2E, and Postgres-backed persistence tests.
- Transition history reuse of existing conversation metadata is a good KISS/YAGNI choice that avoids introducing a redundant table.
- The documentation sync for API, data model, GM contract, and project status is materially complete.
- The code is readable overall; responsibilities are easy to locate and the main EPIC flows are understandable.

## Findings

### GM handoff notes persist beyond the next avatar turn

- Severity: High
- Category: Functional correctness / state lifecycle
- Problem: GM guidance notes are stored in `sessions.gm_notes` and injected into the avatar system prompt, but there is no code path that clears them after that next turn.
- Why it matters: The EPIC and data model describe these notes as handoff guidance for the next avatar turn, not a permanent prompt mutation. Replaying stale director notes on every later turn can distort persona behavior and make handoffs non-deterministic.
- Evidence:
  - `RunGameMasterUseCase` persists notes into the session at `apps/core/src/application/use-cases/run-game-master/run-game-master.use-case.ts:302-304`.
  - `SendMessageUseCase` injects `session.gmNotes` into the avatar prompt at `apps/core/src/application/use-cases/send-message/send-message.use-case.ts:36-39`.
  - The same use case only updates `lastActivityAt` afterward and never clears `gmNotes` at `apps/core/src/application/use-cases/send-message/send-message.use-case.ts:52-54`.
  - Docs describe `gm_notes` as guidance for the next turn / next avatar system prompt at `docs/DATA_MODEL.md:195-208` and `docs/GAME_MASTER_CONTRACT.md:118`, `444-447`.
- Recommendation: Treat `gmNotes` as single-consumption handoff state. Clear it immediately after the avatar turn that consumes it, and add a consumer-level test proving the note is present on the first post-handoff turn and absent on the second.

### GM-driven switching accepts arbitrary `nextAvatarId` when no transition rules exist

- Severity: High
- Category: Functional correctness / deterministic routing
- Problem: `performAvatarSwitch()` validates `nextAvatarId` only when `eligibleTransitions.length > 0`. If a scenario has no transition rules, any non-empty `nextAvatarId` returned by the LLM is accepted without verifying that the avatar exists or belongs to the scenario.
- Why it matters: This puts core routing safety back into prompt compliance, which conflicts with the project principle that deterministic product behavior should not rely on prompt discipline alone. It can create conversations bound to nonexistent or wrong-scenario avatars.
- Evidence:
  - The only guard is `eligibleTransitions.length > 0` at `apps/core/src/application/use-cases/run-game-master/run-game-master.use-case.ts:261-270`.
  - The conversation is then created directly with `output.nextAvatarId` at `apps/core/src/application/use-cases/run-game-master/run-game-master.use-case.ts:286-294`.
  - The GM prompt explicitly instructs the model to keep `nextAvatarId` null and continue when no eligible transitions exist at `apps/core/src/domain/game-master/gm-prompt.service.ts:30-34`, but runtime enforcement is absent.
  - The EPIC prompt defines this as a validity check around `nextAvatarId`, not a prompt-only contract (`docs/implementation-prompts/epic-4-4-multi-avatar-navigation/02-gm-driven-switch.md`).
- Recommendation: Always validate `nextAvatarId` against actual scenario avatars, and additionally restrict it to eligible transitions when rules exist. Add a failing test for the “no rules + bogus avatarId” case before fixing it.

### GM state can diverge from session/conversation reality when a switch fails

- Severity: Medium
- Category: Consistency / observability
- Problem: GM state is reduced and saved before routing side effects occur. If the LLM output contains `stateUpdate.activeAvatarId` and the later conversation/session switch fails, the persisted GM state can claim a different active avatar than the session/conversation records.
- Why it matters: Future trigger evaluation uses GM state, operators are supposed to inspect the transition chain, and this mismatch makes the system harder to reason about and debug.
- Evidence:
  - `reduceGmState()` updates `currentAvatarId` from `stateUpdate.activeAvatarId` at `apps/core/src/domain/game-master/gm-state-reducer.ts:19-25`.
  - The reduced state is saved before routing updates at `apps/core/src/application/use-cases/run-game-master/run-game-master.use-case.ts:124-126`.
  - The switch path runs later and swallows failures at `apps/core/src/application/use-cases/run-game-master/run-game-master.use-case.ts:151`, `273-299`.
  - Existing tests cover swallowed errors, but not state/session divergence when `activeAvatarId` is included in `stateUpdate`.
- Recommendation: Either defer active-avatar state mutation until after a successful switch, or reconcile/rollback GM state on switch failure. Add a regression test that includes `stateUpdate.activeAvatarId` plus a simulated repository failure.

### “Available avatars” are not filtered to actually available avatars

- Severity: Medium
- Category: Functional semantics
- Problem: Both the available-avatars endpoint and the GM input context use `listByScenarioId()` without filtering by avatar status, so draft or archived avatars remain exposed as “available”.
- Why it matters: The endpoint name and routing purpose imply operable avatars. Exposing non-active avatars increases the chance of invalid routing decisions and operator confusion.
- Evidence:
  - `GetAvailableAvatarsUseCase` returns every avatar from `listByScenarioId()` at `apps/core/src/application/use-cases/get-available-avatars/get-available-avatars.use-case.ts:17-26`.
  - `RunGameMasterUseCase.buildGameMasterInput()` feeds all scenario avatars to the GM at `apps/core/src/application/use-cases/run-game-master/run-game-master.use-case.ts:222-246`.
  - Repository list methods do not filter by status in `apps/core/src/infrastructure/db/repositories/postgres-avatar.repository.ts` and `apps/core/src/infrastructure/db/in-memory-avatar.repository.ts`.
  - The coverage plan explicitly calls out “available-avatar filtering” at `docs/TEST_COVERAGE_PLAN.md:78-88`.
- Recommendation: Define “available” explicitly as active avatars for runtime flows, enforce that in the use case/repository contract, and add tests covering draft/archived avatars for both GM context assembly and `GET /available-avatars`.

### Transition ordering is guaranteed by repository convention, not by the use-case contract

- Severity: Medium
- Category: Contract robustness / test quality
- Problem: `GetAvatarTransitionsUseCase` maps whatever order `listBySessionId()` returns and does not sort transitions itself, even though the public API contract promises ascending chronological order.
- Why it matters: The consumer contract belongs at the application boundary. If another repository implementation stops sorting, the API contract breaks without any use-case-level protection.
- Evidence:
  - The use case directly maps repository output at `apps/core/src/application/use-cases/get-avatar-transitions/get-avatar-transitions.use-case.ts:23-32`.
  - The API contract requires `transitionedAt ASC` at `docs/API_CONTRACT.md:495-503`.
  - Current tests rely on repository fixtures that are already ordered and therefore do not protect the contract against an unordered repository.
- Recommendation: Sort conversations by `startedAt` inside the use case before deriving transitions, and add a unit test with intentionally unsorted repository output.

## Architecture Review

The EPIC largely respects the intended architecture. Domain routing rules are isolated in a pure function. API handlers in `apps/core/src/api/routes/sessions.ts` remain thin and delegate to application use cases. Infrastructure concerns stay behind repository ports, and there is no direct vendor leakage into domain logic.

The main architectural weakness is not layering but contract enforcement. Runtime correctness still depends too much on prompt compliance in the GM switch path, and some public contract guarantees are delegated to repository behavior rather than being enforced in the application layer. That is manageable debt, but it is real architecture drift relative to the project’s “structured control beats prompt sprawl” principle.

## Test Review

Strong tests:

- `apps/core/src/domain/avatar/transition-engine.test.ts` is a solid deterministic suite for the pure transition engine.
- `apps/core/src/application/use-cases/switch-avatar/switch-avatar.use-case.test.ts` covers the main branch logic for manual switching.
- `apps/core/src/api/routes/sessions.stack-e2e.test.ts` gives meaningful consumer-facing proof for manual switching and transition-history retrieval.
- `apps/core/src/infrastructure/db/repositories/persistence.e2e.test.ts` provides useful Postgres-backed evidence that transition linkage persists correctly.

Weak tests:

- `apps/core/src/application/use-cases/run-game-master/run-game-master.avatar-switch.use-case.test.ts` is heavily implementation-coupled. It mainly proves that specific repository methods were called, not that the user-visible handoff behavior remains correct over subsequent turns.
- The send-message tests prove note injection exists once, but not that handoff notes are consumed exactly once.
- The transition-history tests assume ordered repository output and therefore do not protect the API contract against ordering regressions.

Missing tests:

- No test for “GM sets notes, next avatar turn consumes them once, later turns do not”.
- No test for “no transition rules + invalid `nextAvatarId`” rejection.
- No test for GM switch failure causing or avoiding state/session divergence.
- No test for filtering out draft/archived avatars from runtime availability.

Implementation-coupled tests:

- The GM switch tests at `apps/core/src/application/use-cases/run-game-master/run-game-master.avatar-switch.use-case.test.ts` are the clearest example. They assert repository interaction shapes but do not prove the full externally observable behavior chain that an operator or client depends on.

## Documentation Gaps

- The main documentation targets for the EPIC were updated and are broadly aligned.
- No additional contract documents are missing for EPIC closure.
- After fixing the note lifecycle bug, the docs do not need to change; the implementation needs to catch up to the current docs.

## Path to A

Minimal steps needed to reach A:

1. Make GM handoff notes single-use and add a consumer-level regression test proving one-turn-only behavior.
2. Validate GM `nextAvatarId` against actual scenario avatars even when no transition rules exist, with explicit negative-path tests.
3. Prevent or reconcile GM state/session divergence when a switch fails.
4. Define and enforce active-avatar filtering for runtime availability and test it.
5. Move transition ordering enforcement into `GetAvatarTransitionsUseCase` and add an unsorted-input test.
6. Re-run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm test:coverage` in a writable environment and record green results.

## Final Recommendation

**Rework before close**

The EPIC is close, but I would not close it yet. The implementation is structurally decent and most scope is present, but the GM-driven routing path still has correctness gaps that undermine deterministic multi-avatar navigation, and the test suite does not yet prove the highest-risk behaviors strongly enough.

## Remediation Outcome

### Changes Made

- `apps/core/src/application/use-cases/send-message/send-message.use-case.ts`
  - GM handoff notes are now single-consumption: after the avatar turn runs, `gmNotes` is explicitly cleared (`gmNotes: null`) while updating session activity.
- `apps/core/src/application/ports/ISessionRepository.ts`
  - `SessionUpdate.gmNotes` now supports explicit `null` to clear persisted `gm_notes`.
- `apps/core/src/infrastructure/db/in-memory-session.repository.ts`
  - In-memory session update now handles `gmNotes: null` by removing the field, matching Postgres semantics.
- `apps/core/src/application/use-cases/run-game-master/run-game-master.use-case.ts`
  - GM switch path now validates `nextAvatarId` against active scenario avatars even when no transition rules are configured.
  - GM available-avatar context now includes only active avatars.
  - GM state is reconciled with routing outcome: `currentAvatarId` updates only after successful routing, preventing state/session divergence on switch failure.
- `apps/core/src/application/use-cases/get-available-avatars/get-available-avatars.use-case.ts`
  - Endpoint now returns only active avatars as available avatars.
- `apps/core/src/application/use-cases/get-avatar-transitions/get-avatar-transitions.use-case.ts`
  - Transition ordering is now enforced in the use case (`startedAt ASC`) regardless of repository ordering.
- Tests strengthened:
  - `apps/core/src/application/use-cases/send-message/send-message.use-case.test.ts`
    - Added regression tests for GM note consumption and clearing behavior.
  - `apps/core/src/application/use-cases/get-available-avatars/get-available-avatars.use-case.test.ts`
    - Added filtering test for draft/archived avatars.
  - `apps/core/src/application/use-cases/get-avatar-transitions/get-avatar-transitions.use-case.test.ts`
    - Added unsorted-repository regression test to prove use-case-level ordering guarantee.
  - `apps/core/src/application/use-cases/run-game-master/run-game-master.avatar-switch.hardening.use-case.test.ts`
    - Added focused hardening tests for switch failure consistency and active-avatar context filtering.
  - `apps/core/src/application/use-cases/run-game-master/run-game-master.avatar-switch.use-case.test.ts`
    - Retained core switch-path behavior tests; split for lint-compliant maintainability.
- Docs sync:
  - `docs/API_CONTRACT.md`
    - Documented that `GET /v1/sessions/{sessionId}/available-avatars` returns only active avatars.

### Findings Resolved

- ✅ GM handoff notes persist beyond next avatar turn
- ✅ GM-driven switching accepted arbitrary `nextAvatarId` without rules
- ✅ GM state/session divergence risk on switch failure
- ✅ Available avatars endpoint exposed non-active avatars
- ✅ Transition ordering depended on repository convention

### Findings Deferred

- None.

### Build Gates

- lint: PASS (`pnpm lint`)
- typecheck: PASS (`pnpm typecheck`)
- tests: PASS (`pnpm test`)
- coverage: PASS (`pnpm --filter @gami/core test:coverage`) — 92.85% stmts / 86.54% branches / 99.47% funcs

### Final Feature Confidence

- GM handoff notes lifecycle is now behaviorally proven as single-turn guidance.
- GM avatar switching now enforces active-scenario avatar validity at runtime, not prompt-only compliance.
- GM state consistency is preserved when routing side effects fail.
- Available avatar contracts are now explicit and enforced (active only).
- Transition history ordering is guaranteed at the use-case boundary and tested against unsorted repository input.

### Final Grade

A

### Remaining Risks

- GM avatar-switch tests still include some interaction-level assertions; current coverage is strong but can be further hardened over time with more API-level proofs for async GM side effects.
