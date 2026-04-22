# 05 — Tests and Hardening

## Context

All four implementation prompts are done. This prompt adds the full test coverage that makes the GM system reliable and refactorable. Focus is on determinism and correctness — not AI behavior quality.

## Scope

**In scope:**

- Complete unit tests for `evaluateTriggers` (all trigger paths and combinations)
- Complete unit tests for the state reducer (`reduceGmState`)
- Unit tests for `RunGameMasterUseCase` — trigger/no-trigger/LLM-error/parse-error paths
- Unit tests for event emission — `gm_triggered` and `gm_skipped` shape verification
- Integration test for `PostgresGmStateRepository`
- Integration test for `PostgresEventLogRepository`
- Hardening: ensure GM LLM JSON parse failure is gracefully handled

**Out of scope:**

- Real LLM calls (use `NullLlmAdapter` or mocked adapter)
- Stack E2E tests (GM runs in background — no HTTP endpoint added in this EPIC)
- AI quality evaluation

## Relevant Docs

- `docs/TEST_STRATEGY.md` — unit vs integration test conventions
- `apps/core/src/infrastructure/db/test-helpers.ts` — `createTestSql`, `truncateAllTables`, `DB_AVAILABLE`
- Existing integration tests in `apps/core/src/infrastructure/db/repositories/` — pattern to follow

## Implementation Guidance

### Trigger engine tests

`apps/core/src/domain/game-master/trigger-engine.test.ts`

Cover every evaluatable path:

- `turn_threshold`: `interactionCount = 5` with default policy → returns `'turn_threshold'`
- `turn_threshold`: `interactionCount = 4` → returns `null`
- `turn_threshold`: `interactionCount = 10` (double threshold) → returns `'turn_threshold'`
- `turn_threshold`: custom `turnThreshold = 3`, `interactionCount = 3` → fires
- `topic_repeat`: `topicsCovered = ['a', 'a', 'a']` (3 repeats, default threshold) → `'topic_repeat'`
- `topic_repeat`: `topicsCovered = ['a', 'a', 'b', 'b']` (2 each, threshold 3) → `null`
- `progression_stalled`: `interactionCount = 8`, `progression = ''` → `'progression_stalled'`
- `progression_stalled`: `interactionCount = 8`, `progression = 'some progress'` → `null`
- `progression_stalled`: `interactionCount = 7` → `null`
- **Priority order**: when both `turn_threshold` and `topic_repeat` conditions are met, returns `'turn_threshold'` (checked first)
- Zero state: `{ progression: '', topicsCovered: [], interactionCount: 0 }` → `null` (no thresholds reached)

### State reducer tests

`apps/core/src/domain/game-master/gm-state-reducer.test.ts`

- `interactionCount` always increments by 1
- `progression === 'increase'`: progression field updated (whatever signal represents advancement)
- `topicCovered` set: appended to `topicsCovered` array
- `activeAvatarId` set: updates `currentAvatarId`
- All fields `undefined` in `stateUpdate`: only `interactionCount` changes
- Input state is not mutated (verify by checking original object reference after call)

### `RunGameMasterUseCase` unit tests

`apps/core/src/application/use-cases/run-game-master/run-game-master.use-case.test.ts`

Use `InMemoryGmStateRepository`, `InMemoryEventLogRepository`, `InMemorySessionRepository`, `InMemoryAvatarRepository`, `NullLlmAdapter`, and `NullObservabilityAdapter`.

Test cases:

**No-trigger path (interactionCount not at threshold):**

- State is loaded (or initialised if null)
- `interactionCount` incremented
- State persisted
- LLM is NOT called
- `gm_skipped` event emitted with correct fields

**Trigger path (force a `turn_threshold` trigger by setting `interactionCount = 4`, threshold 5):**

- Use a mock LLM adapter that returns a valid JSON `GameMasterOutput`
- LLM IS called once
- State is updated with reducer
- `gm_triggered` event emitted with `decision` and `stateAfter`
- If `output.context.notes` is present: session GM notes are updated

**LLM error (trigger fires, LLM throws `LlmError`):**

- Error is caught
- State is still incremented and persisted
- Event is NOT emitted (or a `gm_skipped`-equivalent is emitted) — document the chosen behavior
- No exception propagates from `execute()`

**JSON parse error (LLM returns non-JSON or wrong shape):**

- Parse fails silently
- Treated as no-trigger result
- No exception propagates

**Event payload security:**

- `gm_triggered` payload does not include `userMessageText`
- `gm_triggered` payload does not include the raw system prompt

### Mock LLM adapter for GM output

Create an ad-hoc test adapter that returns a hardcoded JSON string as the LLM `content`:

```ts
const validGmOutput: GameMasterOutput = {
  avatarId: 'avatar-1',
  conversationMode: 'continue',
  stateUpdate: { progression: 'none', interactionIncrement: 1 },
}

class GmOutputLlmAdapter implements ILlmAdapter {
  async complete(_req: LlmRequest): Promise<LlmResponse> {
    return {
      content: JSON.stringify(validGmOutput),
      model: 'null',
      latencyMs: 0,
    }
  }
}
```

### Integration tests

`apps/core/src/infrastructure/db/repositories/postgres-gm-state.repository.integration.test.ts`

- `findBySessionId` returns `null` when no state exists for session
- `save` inserts a new state row
- second `save` with same `sessionId` upserts (updates in place)
- All `GameMasterState` fields round-trip correctly through DB

`apps/core/src/infrastructure/db/repositories/postgres-event-log.repository.integration.test.ts`

- `append` inserts a row successfully
- Row is retrievable via raw SQL (`SELECT * FROM event_log WHERE correlation_id = $1`)
- `payload` JSONB field stores and retrieves nested objects correctly
- `sessionId = null` is valid (nullable FK)

### `SendMessageUseCase` regression check

Run the full existing `send-message.use-case.test.ts` suite. All tests must pass without modification. If any test breaks, the GM injection is not backward-compatible — fix the wiring.

## Constraints

- All unit tests must use no real DB connections
- Integration tests must use `DB_AVAILABLE` guard (`describe.skipIf(!DB_AVAILABLE)`)
- Coverage floor (≥80%) must be maintained — new code must stay above threshold
- Do not modify existing `send-message.use-case.test.ts` — add tests only if needed in a separate describe block

## Deliverables

- `apps/core/src/domain/game-master/trigger-engine.test.ts` — comprehensive
- `apps/core/src/domain/game-master/gm-state-reducer.test.ts`
- `apps/core/src/application/use-cases/run-game-master/run-game-master.use-case.test.ts`
- `apps/core/src/infrastructure/db/repositories/postgres-gm-state.repository.integration.test.ts`
- `apps/core/src/infrastructure/db/repositories/postgres-event-log.repository.integration.test.ts`

## Mandatory Final Step — Documentation Update

After implementation:

- `docs/TEST_STRATEGY.md` — verify that GM unit test categories (trigger engine, state reducer, async use case) are described
- `docs/PROJECT_STATUS.md` — update test count and passing suite summary

## Acceptance Criteria

- [ ] All trigger paths covered: threshold, topic repeat, stalled, no-trigger, zero state
- [ ] State reducer tested for all `stateUpdate` fields including non-mutation
- [ ] Use case covered: no-trigger, trigger+LLM success, LLM error, JSON parse error
- [ ] Event payload verified to exclude sensitive fields
- [ ] `PostgresGmStateRepository` integration test passes (upsert verified)
- [ ] `PostgresEventLogRepository` integration test passes
- [ ] All existing `send-message.use-case.test.ts` tests still pass
- [ ] Coverage floor (≥80%) maintained
- [ ] `pnpm test` passes, `pnpm test:integration-e2e` passes
