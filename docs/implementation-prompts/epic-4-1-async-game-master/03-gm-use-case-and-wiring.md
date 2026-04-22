# 03 — GM Use Case and Wiring

## Context

Triggers exist (prompt 02) and state is persisted (prompt 01). This prompt assembles the full `RunGameMasterUseCase` and wires it into `SendMessageUseCase` at the `// TODO(EPIC-4.1)` injection point.

After this prompt, every Avatar turn fires the GM in the background: it evaluates triggers, calls the LLM if a trigger fires, updates state, stores guidance notes on the session, and makes those notes available to the Avatar's next system prompt.

## Scope

**In scope:**

- `RunGameMasterUseCase` — full implementation
- State reducer — pure function that applies `GameMasterOutput.stateUpdate` to a `GameMasterState`
- Guidance notes storage on the session (use `sessions.config` JSONB or a dedicated column — see guidance below)
- GM system prompt assembly — a focused, minimal prompt directing the GM LLM role
- `SendMessageUseCase` updated to:
  1. Inject stored GM guidance notes into the Avatar's assembled system prompt
  2. Fire `RunGameMasterUseCase` non-blocking after avatar message is persisted (replace the TODO comment)
- `ServerAdapters` wired with `gmStateRepository` for production

**Out of scope:**

- Event log emission (prompt 04 — add the `TODO(EPIC-4.1): emit GM event` comment here)
- `nextAvatarId` / avatar transition routing (EPIC 4.4)
- Memory injection from EPIC 4.2

## Relevant Docs

- `docs/GAME_MASTER_CONTRACT.md` — sections 4, 5, 6, 8, 12
- `apps/core/src/application/use-cases/send-message/send-message.use-case.ts` — injection point
- `apps/core/src/domain/avatar/persona-prompt.service.ts` — how system prompt is assembled today
- `apps/core/src/application/ports/ILlmAdapter.ts` — `complete()` signature

## Implementation Guidance

### Guidance notes storage

The simplest approach for MVP: store GM guidance notes as a field inside `sessions.config` JSONB.

Add `gmNotes?: string` to the `SessionConfig` type (or define one if it does not exist). The `PostgresSessionRepository.update()` already supports `config` updates — extend it to support updating `gmNotes` specifically.

Alternatively, if `sessions.config` does not yet have a typed structure, add a `gm_notes TEXT` column to the sessions table in `init.sql`. Follow YAGNI — pick the simplest option that does not require a schema change if config JSONB is already writable.

> **Decision rule:** if `sessions.config` is already a writable JSONB column, store notes there. If not, add `gm_notes TEXT` to the sessions table. Pick one and be consistent — document your choice.

### `RunGameMasterUseCase`

`apps/core/src/application/use-cases/run-game-master/run-game-master.use-case.ts`

Constructor receives:

- `gmStateRepository: IGmStateRepository`
- `sessionRepository: ISessionRepository`
- `avatarRepository: IAvatarRepository`
- `llm: ILlmAdapter`
- `observability: IObservabilityAdapter`

`execute(input: RunGameMasterInput)`:

Input type:

```ts
export type RunGameMasterInput = {
  sessionId: string
  scenarioId: string
  avatarId: string
  userMessageText: string
  turnIndex: number
  correlationId: string
}
```

Execution flow:

1. Load GM state from repository (`findBySessionId`). If null, initialise a default state:

   ```ts
   { progression: '', topicsCovered: [], interactionCount: 0 }
   ```

2. Call `evaluateTriggers(state, policy)` — policy comes from `scenario.config.policy` if present, else use defaults.

3. **If no trigger:** increment `interactionCount`, persist updated state, leave guidance notes unchanged.
   - Add `// TODO(EPIC-4.1-events): emit gm_skipped event` comment here.
   - Return early.

4. **If trigger fires:** call the LLM with a GM-specific system prompt and the observation input:
   - System prompt: a minimal directive describing the GM role, that it should return structured JSON in the `GameMasterOutput` shape
   - User message: a JSON representation of the key fields from `GameMasterInput` (session context, state, available avatars, user text)
   - Parse the LLM response as `GameMasterOutput` — wrap JSON.parse in try/catch; on failure log to stderr and treat as no-trigger
5. Apply the state reducer to produce the next state:
   ```ts
   function reduceGmState(
     current: GameMasterState,
     update: GameMasterOutput['stateUpdate'],
   ): GameMasterState
   ```
   Pure function. Rules from `GAME_MASTER_CONTRACT.md` section 9:
   - `interactionCount += 1` always
   - if `progression === 'increase'`: append `' [advanced]'` or use a meaningful signal — store the new progression value
   - if `topicCovered` is set: push to `topicsCovered`
   - if `stateUpdate.activeAvatarId` is set: update `currentAvatarId`
6. Persist updated state via `gmStateRepository.save()`.

7. If `output.context?.notes` is non-empty: update the session's GM notes storage.
   - Add `// TODO(EPIC-4.1-events): emit gm_triggered event` comment here.

8. Update `session.activeAvatarId` if `output.stateUpdate.activeAvatarId` differs from `state.currentAvatarId`.

### GM system prompt

`apps/core/src/domain/game-master/gm-prompt.service.ts`

Keep it short. The GM is not a chatbot — it makes structured decisions. The prompt should:

- Describe the GM's role as a silent director
- Instruct it to return valid JSON matching `GameMasterOutput`
- Tell it to keep `context.notes` concise (one sentence max for MVP)
- Specify that it may only use the provided available avatars list

Do not hard-code scenario content in the prompt.

### `SendMessageUseCase` changes

Two changes:

**1. Inject GM notes into the Avatar's system prompt:**

After loading the session, load the current GM notes from `session.config.gmNotes` (or equivalent). If notes are present, append them to the assembled persona prompt:

```ts
const systemPrompt = assemblePersonaPrompt(avatar, { gmNotes: session.gmNotes })
```

Update `assemblePersonaPrompt` to accept an optional `opts?: { gmNotes?: string }` and append a `\n\nDirector notes: ${gmNotes}` section when present.

**2. Fire GM non-blocking after avatar message is persisted:**

Replace the `// TODO(EPIC-4.1): trigger GM observation` comment with:

```ts
void runGameMasterUseCase
  .execute({
    sessionId: session.sessionId,
    scenarioId: session.scenarioId,
    avatarId: input.avatarId,
    userMessageText: input.userMessage,
    turnIndex: session.interactionCount ?? 0,
    correlationId: requestId,
  })
  .catch((err: unknown) => {
    console.error('[GM] Background execution failed:', err)
  })
```

Errors in the GM background task must never throw to the caller.

`SendMessageUseCase` must receive `RunGameMasterUseCase` as a constructor dependency. It should default to `null` / no-op in the test factory so existing tests are unaffected.

### `ServerAdapters` extension

Add `runGameMasterUseCase?: RunGameMasterUseCase` (optional) to `ServerAdapters`. When absent, the `SendMessageUseCase` skips the GM fire entirely (safe default for tests and null-provider environments).

## Constraints

- GM errors must never propagate to the HTTP response — catch all errors in the void-fire wrapper
- The GM LLM call uses the same `ILlmAdapter` as the Avatar — no new provider needed
- `assemblePersonaPrompt` must remain backward-compatible (new optional parameter)
- Do not add `RunGameMasterUseCase` as a required parameter — use optional injection to preserve all existing tests
- YAGNI: do not implement `nextAvatarId` routing here — that is EPIC 4.4

## Deliverables

- `apps/core/src/application/use-cases/run-game-master/run-game-master.use-case.ts`
- `apps/core/src/application/use-cases/run-game-master/run-game-master.types.ts`
- `apps/core/src/domain/game-master/gm-prompt.service.ts`
- `apps/core/src/domain/game-master/gm-state-reducer.ts` (state reducer pure function)
- `apps/core/src/domain/avatar/persona-prompt.service.ts` — `gmNotes` option added
- `apps/core/src/application/use-cases/send-message/send-message.use-case.ts` — GM injection wired
- `apps/core/src/api/server.ts` — `ServerAdapters` extended
- `apps/core/src/index.ts` — `RunGameMasterUseCase` constructed and wired for production

## Mandatory Final Step — Documentation Update

After implementation:

- `docs/GAME_MASTER_CONTRACT.md` — section 12 updated with the actual GM system prompt structure and the `RunGameMasterUseCase` execution flow
- `docs/PROJECT_STATUS.md` — note that GM use case is wired

## Acceptance Criteria

- [ ] `RunGameMasterUseCase.execute()` runs the trigger engine, conditionally calls LLM, reduces state, persists state
- [ ] GM errors are caught and logged — never propagate to the HTTP response
- [ ] GM guidance notes are stored per-session and injected into the next avatar system prompt
- [ ] `SendMessageUseCase` fires the GM non-blocking after every avatar message (when `runGameMasterUseCase` is provided)
- [ ] All existing `SendMessageUseCase` unit tests still pass unmodified
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` pass
