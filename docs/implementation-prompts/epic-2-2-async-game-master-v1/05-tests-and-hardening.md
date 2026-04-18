# 05 — Tests, Hardening, and Coverage Gate

## Context

Good GM code that isn't tested is a liability — the engine's async game director is exactly the
kind of component where silent regressions are catastrophic. This prompt hardens EPIC 2.2 from
"implemented" to "production-ready":

- Unit tests for the new domain logic
- Unit tests for the new application use case
- API integration test confirming the GM fires non-blocking
- Verification that the coverage gate stays green

All tests must be deterministic. No real LLM calls. No real database connections.

---

## Scope

**In scope:**

- Unit tests for `gm-state.reducer.ts` and `gm-trigger.ts` (Prompt 01 deliverables)
- Unit tests for `GameMasterService` (Prompt 02 deliverable)
- Unit tests for `InMemoryGmStateRepository` (Prompt 03 deliverable)
- Unit tests for `TriggerGmObservationUseCase` (Prompt 04 deliverable)
- Integration test confirming `POST /v1/conversations/:sessionId/messages` returns HTTP 200 and
  GM does not block the response
- `assemblePersonaPrompt` unit tests: GM directive injection (when present, absent)
- Run `pnpm test:coverage` and ensure overall branch coverage ≥ 80%
- Fix any compilation errors surfaced by `pnpm typecheck`
- Fix any linting errors surfaced by `pnpm lint`

**Out of scope:**

- AI quality regression tests (separate suite, out of scope for Phase A unit testing)
- PostgreSQL repository tests (infrastructure layer; in-memory repository is tested here)

---

## Relevant Docs

- `docs/TEST_STRATEGY.md` — testing layers, determinism rules, what to mock and what not to
- `docs/TEST_COVERAGE_PLAN.md` — GM module checklist (trigger conditions, state reducer,
  duplicate topic handling, progression update rules)
- `docs/PRINCIPALS.md` — Principle 10 (correctness > cleverness)
- `apps/core/vitest.config.ts` — coverage thresholds

---

## Test Inventory

### 1. `gm-trigger.unit.test.ts`

File: `apps/core/src/domain/game-master/gm-trigger.unit.test.ts`

Cases:

- Returns `null` when `turnIndex < GM_TURN_THRESHOLD` and no topic repeat and not stalled
- Returns `'turn_threshold'` when `interactionCount % GM_TURN_THRESHOLD === 0` and
  `interactionCount > 0` (turn threshold wins priority)
- Returns `null` when `interactionCount === 0` (first turn — never trigger)
- Returns `'topic_repeat'` when the same topic has appeared 3+ times in `topicsCovered` and
  turn threshold has not fired
- Returns `'progression_stalled'` when `progression` has not changed for 2+ consecutive
  `topicsCovered` entries and neither higher-priority trigger has fired
- Priority: `turn_threshold > topic_repeat > progression_stalled` — when multiple conditions
  simultaneously hold, returns the highest-priority one

### 2. `gm-state.reducer.unit.test.ts`

File: `apps/core/src/domain/game-master/gm-state.reducer.unit.test.ts`

Cases:

- Returns a new object identity (pure function, no mutation)
- `interactionCount` incremented by `stateUpdate.interactionIncrement`
- `topicsCovered` extended with `stateUpdate.newTopics`
- `progression` updated to `stateUpdate.progression` when provided
- `progression` unchanged when `stateUpdate.progression` is absent
- Fields not touched by the reducer remain unchanged (e.g., `avatarId`)
- `pendingDirective` cleared if present and no new directive set (safe default)

### 3. `game-master.service.unit.test.ts`

File: `apps/core/src/infrastructure/llm/` ... no — `GameMasterService` is domain. File should be:
`apps/core/src/domain/game-master/game-master.service.unit.test.ts`

Cases:

- `run()` calls `ILlmAdapter.complete()` with a system prompt and resolved messages
- `run()` returns parsed `GameMasterOutput` when LLM returns valid JSON
- `run()` throws `GameMasterError` when LLM returns invalid JSON
- `run()` throws `GameMasterError` when LLM response is missing required fields
  (`avatarId`, `conversationMode`, `stateUpdate.interactionIncrement`)
- `run()` propagates `ILlmAdapter` rejection as `GameMasterError`
- Prompt does not include raw conversation history (no user message text in `systemPrompt`)

### 4. `in-memory-gm-state.repository.unit.test.ts`

File: `apps/core/src/infrastructure/db/in-memory-gm-state.repository.unit.test.ts`

Cases:

- `findBySessionId` returns `null` when no state saved
- `save` followed by `findBySessionId` returns an equal object
- Returned object from `findBySessionId` is a deep copy — mutating it does not affect the stored state
- Saving with updated state overwrites the previous entry for the same `sessionId`
- States for different `sessionId`s are independent

### 5. `trigger-gm-observation.use-case.unit.test.ts`

File: `apps/core/src/application/use-cases/trigger-gm-observation/trigger-gm-observation.use-case.unit.test.ts`

Cases:

- When `evaluateTriggerReason` returns `null`: `GameMasterService.run` is NOT called, `gm_skipped`
  event is emitted via observability, `triggered: false` returned
- When `evaluateTriggerReason` returns a trigger reason: `GameMasterService.run` IS called,
  `applyGmStateUpdate` called, new state persisted, `gm_triggered` event emitted, `triggered: true` returned
- When active and GM returns a `context.notes` directive: `pendingDirective` stored in persisted state
- When `GameMasterService.run` throws: error is re-thrown (the swallowing happens at the call site in
  `SendMessageUseCase.triggerGmNonBlocking`, not inside the use case)
- `save` is called on the repository in all non-throwing branches

Use a `makeTriggerGmDeps()` helper that returns `{ gmRepo, gmService, observability }` with
`vi.fn()` mocks. Use `makeGmState()` fixture from Prompt 01.

### 6. `persona-prompt.unit.test.ts` — new cases

Add to the existing test file:

- `assemblePersonaPrompt(config, '...')` — output contains `[Director's note: ...]` block
- `assemblePersonaPrompt(config, '')` — output does NOT contain `Director's note`
- `assemblePersonaPrompt(config, undefined)` — output does NOT contain `Director's note`
- Directive injection appears after the persona body and before the style rule

### 7. API integration test — GM non-blocking

File: `apps/core/src/api/routes/messages.integration.test.ts`
(add cases to existing file if it exists, or create a new companion file)

Cases:

- `POST /v1/conversations/:sessionId/messages` returns `HTTP 200` with avatar content even when
  `TriggerGmObservationUseCase` is configured with a slow/delayed mock
- When `triggerGmObservation` is configured to reject, `POST` still returns `HTTP 200`
- After the request resolves, the `gmStateRepository.save` was eventually called (use a
  deferred mock to advance micro-tasks and verify)

Use `vi.useFakeTimers()` if needed to advance promises; ensure clean-up in `afterEach`.

### 8. Stack E2E — verify `messages.stack-e2e.test.ts` still passes

EPIC 2.2 modifies the `POST /v1/conversations/:sessionId/messages` endpoint (GM wiring). The
existing `messages.stack-e2e.test.ts` exercises auth, schema validation, and resource-not-found
paths — all of which must remain green after EPIC 2.2 changes.

Do NOT create a new stack-e2e file for EPIC 2.2 (no new endpoint is introduced). Do verify that
the existing stack-e2e suite still passes against the Docker stack:

```sh
APP_URL=http://localhost:3000 pnpm test:stack-e2e
```

If any always-on stack-e2e test fails after the EPIC 2.2 changes, fix the regression before
marking the EPIC complete.

---

## Coverage Gate

After implementing all tests, run:

```sh
pnpm test:coverage
```

The vitest coverage threshold is defined in `apps/core/vitest.config.ts`. Verify:

- Overall branch coverage ≥ 80%
- The `domain/game-master/` module specifically reaches ≥ 85% branch coverage
- The `application/use-cases/trigger-gm-observation/` module reaches 100% statement coverage

If coverage drops below threshold, do NOT lower the threshold. Add the missing test cases instead.

---

## Hardening Checklist

Before marking EPIC 2.2 complete, every item below must pass:

```sh
pnpm lint          # zero errors, zero warnings
pnpm typecheck     # zero errors in strict mode
pnpm test          # all tests pass
pnpm test:coverage # coverage thresholds met
```

Also verify manually:

- [ ] No `any` types anywhere in the new code
- [ ] No direct provider SDK imports in domain or application layer
- [ ] No `TODO` comments left from EPIC 2.2 (search for `TODO(EPIC-2.2)`)
- [ ] `GameMasterService` never called directly from an API handler
- [ ] `pendingDirective` is cleared from state after being consumed (not re-injected on subsequent turns)

---

## Acceptance Criteria

- [ ] All 35+ test cases above pass (counts are estimates; more cases are always welcome)
- [ ] `gm_skipped` branch is exercised and tested
- [ ] GM error-swallowing is exercised in the `SendMessageUseCase` test
- [ ] Coverage gate remains green
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` all pass clean
- [ ] `messages.stack-e2e.test.ts` still passes against the Docker stack (auth, validation, 404 cases unaffected by EPIC 2.2 changes)
