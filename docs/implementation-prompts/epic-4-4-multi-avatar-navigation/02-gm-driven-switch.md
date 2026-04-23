# 02 — GM-Driven Avatar Switch

## Context

`RunGameMasterUseCase.handleTriggeredTurn()` currently parses `GameMasterOutput.conversationMode` and `nextAvatarId` but does nothing with them. A `// conversationMode: 'new' — deferred` comment marks the deferral point.

This prompt activates that path. When the LLM output says `conversationMode: 'new'` and supplies a valid `nextAvatarId`, the use case must:

1. Close the currently active conversation for the session
2. Create a new conversation bound to `nextAvatarId`
3. Update `session.activeAvatarId`
4. Carry handoff notes into `session.gmNotes` for the next avatar turn

This must remain non-blocking and must not affect the user response already delivered. All failures are swallowed and logged, consistent with the existing GM error-handling pattern.

---

## Scope

### In scope

- Inject `IConversationRepository` into `RunGameMasterUseCase` (optional dependency, consistent with existing optional deps)
- Add `findActiveBySessionId(sessionId)` to `IConversationRepository` port
- Implement the GM-driven switch path in `handleTriggeredTurn()`
- Use `evaluateTransitionRules()` to build the eligible-transitions context passed into `GameMasterInput`
- Validate that the LLM's `nextAvatarId` is permitted (when rules exist) — treat non-eligible `nextAvatarId` as a no-op (log and skip)
- Unit tests for the new codepath

### Out of scope

- The manual switch endpoint (Prompt 03)
- Read endpoints (Prompt 04)
- In-memory repository implementation details beyond what the test needs

---

## Relevant Docs

- `docs/GAME_MASTER_CONTRACT.md` — Section 3 (turn pipeline), Section 5 (GM output fields), Section 14 (event types)
- `docs/ARCHITECTURE.md` — Application layer depends on ports only; no infrastructure imports in use cases
- `docs/TEST_STRATEGY.md` — Unit tests mock all repositories

---

## Implementation Guidance

### Port extension — `IConversationRepository`

Add one method:

```ts
/**
 * Returns the most recently created conversation with status 'active' for a session,
 * or null if none is found.
 */
findActiveBySessionId(sessionId: string): Promise<Conversation | null>
```

Implement in:

- `InMemoryConversationRepository` — filter map values by `sessionId` and `status === 'active'`, return the one with the latest `startedAt`, or `null`
- `PostgresConversationRepository` — `SELECT ... WHERE session_id = $1 AND status = 'active' ORDER BY started_at DESC LIMIT 1`

### `RunGameMasterUseCase` changes

**Constructor:** add optional `conversationRepository?: IConversationRepository` as the 8th parameter. Consistent with `scenarioRepository` and `eventLogRepository`.

**In `handleTriggeredTurn()`:**

Before building `GameMasterInput`, call `evaluateTransitionRules()` using:

- `currentState.currentAvatarId` — the active avatar
- `currentState` — for topic/progression state
- `scenarioContext.avatarTransitionRules ?? []` — from the loaded scenario config
- map `triggerReason` to `'progression' | 'topic_repeat' | null` for the engine call

Pass the resulting eligible transitions into `GameMasterInput.context`:

```ts
context: {
  experience: { ... },
  availableAvatars: [...],
  policy: scenarioContext.policy,
  // NEW:
  eligibleTransitions: eligibleTransitions.map(t => ({
    toAvatarId: t.toAvatarId,
    reason: t.reason,
  })),
}
```

Update `GameMasterInput` type in `game-master.types.ts` to include `eligibleTransitions?`.

**After LLM output is parsed** (in `handleTriggeredTurn`, after `reduceGmState`):

Add a `performAvatarSwitch()` helper (private method) called when:

- `output.conversationMode === 'new'`
- `output.nextAvatarId` is a non-empty string
- `this.conversationRepository` is present

```ts
private async performAvatarSwitch(
  input: RunGameMasterInput,
  output: GameMasterOutput,
  eligibleTransitions: EligibleTransition[],
): Promise<void>
```

Inside `performAvatarSwitch()`:

1. If `eligibleTransitions.length > 0` (rules exist), validate that `output.nextAvatarId` is in the eligible set. If not → log a warning and return early (no switch).
2. `findActiveConversation = await this.conversationRepository.findActiveBySessionId(input.sessionId)`
3. If found: `await this.conversationRepository.update(findActiveConversation.conversationId, { status: 'closed', endedAt: now })`
4. `await this.conversationRepository.create({ sessionId: input.sessionId, avatarId: output.nextAvatarId, startedBy: 'gm', reason: output.transitionReason ?? 'gm_directed', handoffFromConversationId: findActiveConversation?.conversationId })`
5. `await this.sessionRepository.update(input.sessionId, { activeAvatarId: output.nextAvatarId })`
6. If `output.context?.notes` is present: update `gmNotes` with the handoff note (this may already happen in the surrounding code — avoid double-write)

All of the above in `performAvatarSwitch` must be wrapped in try/catch to prevent any failure from propagating out of the GM async path.

### Update `buildGameMasterSystemPrompt()`

Add a sentence to the system prompt informing the LLM about eligible transitions when they exist. Something like:

> When `eligibleTransitions` is non-empty in the input, `nextAvatarId` must be one of the listed `toAvatarId` values if a transition is appropriate. When empty, set `nextAvatarId` to null and `conversationMode` to `"continue"`.

### Unit Tests

Add to `run-game-master.use-case.test.ts`:

1. **`conversationMode: 'new'` with valid `nextAvatarId`** — `conversationRepository.create` is called with correct params; `sessionRepository.update` sets new `activeAvatarId`; old conversation is closed
2. **`conversationMode: 'new'` but `conversationRepository` absent** — no crash, no switch (graceful no-op)
3. **`conversationMode: 'new'` with `nextAvatarId` not in eligible set** — switch is skipped; no conversation created
4. **`conversationMode: 'continue'`** — `conversationRepository.create` is NOT called
5. **`performAvatarSwitch` throws internally** — error is swallowed; no propagation out of the use case
6. **Eligible transitions are passed in `GameMasterInput.context`** — verify the assembled input contains the mapped `eligibleTransitions` array

---

## Constraints

- `conversationRepository` is optional — all existing tests that don't provide it must still pass unmodified.
- The switch path is inside the GM's async non-blocking path; failures caught here must NOT propagate to the user response.
- Do not modify the `GameMasterOutput` type — `nextAvatarId` and `conversationMode` already carry the needed data.
- Do not break the existing event emission or state-save flow; `performAvatarSwitch` is an addendum after those writes.

---

## Deliverables

- `apps/core/src/application/ports/IConversationRepository.ts` — `findActiveBySessionId` added
- `apps/core/src/infrastructure/db/in-memory-conversation.repository.ts` — `findActiveBySessionId` implemented
- `apps/core/src/infrastructure/db/repositories/postgres-conversation.repository.ts` — `findActiveBySessionId` implemented
- `apps/core/src/domain/game-master/game-master.types.ts` — `GameMasterInput.context.eligibleTransitions` field added
- `apps/core/src/application/use-cases/run-game-master/run-game-master.use-case.ts` — switch path activated, `performAvatarSwitch()` helper added
- `apps/core/src/domain/game-master/gm-prompt.service.ts` — eligible transitions referenced in system prompt
- Tests updated / added

---

## Mandatory Final Step — Documentation Update

After implementation:

- `docs/GAME_MASTER_CONTRACT.md` — remove the "deferred" note for `conversationMode: 'new'`; add a short description of the avatar-switch flow that the GM now triggers (full doc update owned by Prompt 05)
- Verify no test regression: `pnpm --filter @gami/core test`

---

## Acceptance Criteria

- [ ] `IConversationRepository.findActiveBySessionId()` exists with in-memory and Postgres implementations
- [ ] `RunGameMasterUseCase` calls `performAvatarSwitch()` when `conversationMode === 'new'` and `nextAvatarId` is set
- [ ] Eligible transitions from `evaluateTransitionRules()` are passed into `GameMasterInput.context`
- [ ] `nextAvatarId` not in eligible set is silently skipped when rules exist; no error thrown
- [ ] All 6 new unit tests pass
- [ ] All previously passing tests still pass
- [ ] `pnpm lint` and `pnpm typecheck` pass with zero errors
