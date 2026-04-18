# 04 — TriggerGmObservationUseCase, Directive Injection, and SendMessageUseCase Wiring

## Context

With the domain logic (Prompt 01), LLM service (Prompt 02), and state repository (Prompt 03) in
place, this prompt assembles them into the async observation flow.

Two integration points:

1. **`TriggerGmObservationUseCase`** — the application-layer use case that runs the full GM cycle:
   load state → evaluate trigger → run GM if triggered → apply reducer → persist state → emit event
2. **`SendMessageUseCase` wiring** — replace `// TODO(EPIC-2.2): trigger GM observation` with a
   non-blocking call to `TriggerGmObservationUseCase`
3. **GM directive injection** — when the GM has stored a `context.notes` directive, the Avatar
   must pick it up on the next turn by including it in the assembled persona prompt

The GM must never block the HTTP response. Failures must be swallowed and logged.

---

## Scope

**In scope:**

- `TriggerGmObservationUseCase` in `application/use-cases/trigger-gm-observation/`
  - Types file: `trigger-gm-observation.types.ts`
  - Use case file: `trigger-gm-observation.use-case.ts`
- Update `SendMessageUseCase` to call `TriggerGmObservationUseCase` non-blocking after avatar
  message is persisted (replacing the `TODO(EPIC-2.2)` comment)
- Update `assemblePersonaPrompt` in `domain/avatar/persona-prompt.service.ts` to accept an
  optional `gmDirective?: string` parameter and inject it after the persona sections (at the
  `EPIC 2.2 extension point` comment)
- Update `SendMessageUseCase` to load any pending GM directive from `IGmStateRepository` and
  pass it to `assemblePersonaPrompt` before the LLM call
- Wire `TriggerGmObservationUseCase` into `messages.ts` route (inject `gmStateRepository` and
  GM LLM adapter into the route options; construct the use case)

**Out of scope:**

- PostgreSQL implementation of `IGmStateRepository`
- Any streaming changes
- Any admin API endpoints (these belong to Sprint O)
- Changes to the `/v1/exchange` route (legacy `SendRawMessage`)

---

## Relevant Docs

- `docs/GAME_MASTER_CONTRACT.md` — §3 Turn Pipeline, §8 Core Decisions, §12 Implementation Guidance, §14 Diagnostic Trace
- `docs/ARCHITECTURE.md` — Application layer rules; async where valuable; Game Master module
- `docs/API_CONTRACT.md` — `POST /v1/conversations/:sessionId/messages` behavior section
- `apps/core/src/application/use-cases/send-message/send-message.use-case.ts` — current `TODO` location and non-blocking pattern (`traceNonBlocking`)
- `apps/core/src/domain/avatar/persona-prompt.service.ts` — extension point comment location
- `apps/core/src/domain/game-master/game-master.types.ts` — `GameMasterInput`, `GameMasterOutput`, `GameMasterEvent`, `TriggerReason`

---

## Implementation Guidance

### `TriggerGmObservationUseCase`

**Types (`trigger-gm-observation.types.ts`):**

```ts
export interface TriggerGmObservationInput {
  sessionId: string
  scenarioId: string
  userMessageText: string
  turnIndex: number
  /** Available avatars for the GM context. Minimal subset for MVP. */
  availableAvatars: Array<{ avatarId: string; name: string }>
}

export interface TriggerGmObservationOutput {
  triggered: boolean
  triggerReason?: TriggerReason
  updatedState: GameMasterState
  /** Directive to inject into next Avatar turn, if any. */
  directive?: string
}
```

**Use case (`trigger-gm-observation.use-case.ts`):**

Constructor dependencies:

- `IGmStateRepository`
- `GameMasterService`
- `IObservabilityAdapter`

`execute(input)` flow:

1. Load current GM state from repository → if `null`, initialize to a default state
   (`{ progression: '', topicsCovered: [], interactionCount: 0 }`)
2. Call `evaluateTriggerReason(state, input.turnIndex)` from Prompt 01
3. If `null` (no trigger):
   - Increment `interactionCount` via `applyGmStateUpdate` with a minimal no-op output
   - Persist updated state
   - Emit a `gm_skipped` event via observability
   - Return `{ triggered: false, updatedState }`
4. If triggered:
   - Build `GameMasterInput` from the use case input + loaded state
   - Call `GameMasterService.run(gmInput)`
   - Apply `applyGmStateUpdate(state, gmOutput)` → new state
   - If `gmOutput.context?.notes` is present, store it in the new state (add a
     `pendingDirective?: string` field to `GameMasterState` — see notes below)
   - Persist new state
   - Emit a `gm_triggered` event via observability (include all required fields from the contract)
   - Return `{ triggered: true, triggerReason, updatedState, directive: gmOutput.context?.notes }`

**`pendingDirective` on `GameMasterState`:**

Add `pendingDirective?: string` to `GameMasterState` in `game-master.types.ts`. This field
holds the GM's last `context.notes` until the Avatar consumes it. The field is cleared (set to
`undefined`) after the Avatar reads it (see directive injection below).

This is the simplest possible approach to GM→Avatar communication without a separate message
table.

### GM directive injection in `assemblePersonaPrompt`

Update `assemblePersonaPrompt(config: AvatarConfig, gmDirective?: string): string`.

If `gmDirective` is a non-empty string, append it as a section after the existing sections and
before `DEFAULT_STYLE_RULE`. Label it subtly so the Avatar understands it is guidance:

```
[Director's note: <gmDirective>]
```

The EPIC 2.2 extension point comment marks the location where this injection should occur.

### `SendMessageUseCase` updates

**Before the LLM call — load pending directive:**

After loading the avatar, read the GM state from `IGmStateRepository`. If
`state?.pendingDirective` is set, pass it to `assemblePersonaPrompt` and then clear it by
saving the state with `pendingDirective: undefined`. This means the directive is consumed
exactly once — on the next Avatar turn after the GM produced it.

This requires adding `IGmStateRepository` as a 6th constructor dependency to
`SendMessageUseCase`.

**After avatar message is persisted — trigger GM non-blocking:**

Replace `// TODO(EPIC-2.2): trigger GM observation` with a non-blocking call:

```ts
this.triggerGmNonBlocking(session, userMessage, turnIndex)
```

Implement `triggerGmNonBlocking` as a private method following the same `void promise.catch()`
pattern as `traceNonBlocking`. Compute `turnIndex` as the number of history messages before this
turn (use the `historyMessages.length` already computed earlier, plus 1 for the new user turn).

**`TriggerGmObservationUseCase` construction in route:**

Follow the same pattern as `SendMessageUseCase` construction in `messages.ts`. The GM needs its
own `ILlmAdapter` — in MVP, reuse the same adapter instance (no separate model assignment yet;
that is a Phase B concern). Add a `gmLlmAdapter?: ILlmAdapter` option to `MessagesRouteOptions`
that defaults to the same adapter used by the Avatar.

### Observability event details

The `gm_triggered` / `gm_skipped` event emitted via `IObservabilityAdapter.trace()` must include:

```ts
{
  requestId,           // same requestId as the parent SendMessage turn
  sessionId,
  event: 'gm_triggered' | 'gm_skipped',
  metadata: {
    triggerReason,
    turnIndex,
    interactionCount,
    latencyMs,         // GM LLM call latency (0 for skipped)
    inputTokens?,
    outputTokens?,
  }
}
```

Do not include prompt content or raw user message text in the event payload (contract requirement).

---

## Constraints

- GM must never block the HTTP response — use `void promise.catch(...)` pattern
- GM failures must be caught, logged via `console.error`, and swallowed
- `assemblePersonaPrompt` signature change is backward-compatible (`gmDirective` is optional)
- `SendMessageUseCase` gets a 6th constructor dependency — update all test factories accordingly
- The GM LLM adapter may be the same instance as the Avatar LLM adapter in MVP; do not couple them permanently
- No `any`; TypeScript strict mode

---

## Deliverables

- `apps/core/src/application/use-cases/trigger-gm-observation/trigger-gm-observation.types.ts`
- `apps/core/src/application/use-cases/trigger-gm-observation/trigger-gm-observation.use-case.ts`
- `apps/core/src/domain/game-master/game-master.types.ts` — `pendingDirective?: string` added to `GameMasterState`
- `apps/core/src/domain/avatar/persona-prompt.service.ts` — `gmDirective?` parameter + injection
- `apps/core/src/application/use-cases/send-message/send-message.use-case.ts` — directive load + non-blocking GM trigger
- `apps/core/src/api/routes/messages.ts` — `TriggerGmObservationUseCase` construction and wiring
- `apps/core/src/api/server.ts` — `gmStateRepository` in `ServerAdapters`

---

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md` — mark Prompt 04 of EPIC 2.2 as done; record the new use case and changed files
- `docs/API_CONTRACT.md` — update the behavior section for `POST /v1/conversations/:sessionId/messages` to state that the GM observation fires non-blocking after avatar message persistence; add note about GM directive injection on next turn
- `docs/GAME_MASTER_CONTRACT.md` — §3 Turn Pipeline should be confirmed accurate; add note about `pendingDirective` field and how directive consumption works
- `docs/DATA_MODEL.md` — `GameMasterState` description should be updated with `pendingDirective` field

---

## Acceptance Criteria

- [ ] `TriggerGmObservationUseCase.execute()` loads state, evaluates trigger, runs GM if triggered, applies reducer, persists state
- [ ] When no trigger fires, `gm_skipped` event is emitted and `triggered: false` is returned
- [ ] When trigger fires, `GameMasterService.run()` is called and `gm_triggered` event is emitted
- [ ] GM directive stored in `pendingDirective` is consumed exactly once — read before the LLM call and cleared after reading
- [ ] `assemblePersonaPrompt` injects `gmDirective` as `[Director's note: ...]` when non-empty
- [ ] `SendMessageUseCase` calls `triggerGmNonBlocking` and the GM runs after avatar message persistence
- [ ] GM failure does not affect HTTP response — errors are swallowed and logged
- [ ] The `TODO(EPIC-2.2)` comment is removed
- [ ] All existing tests still pass after the `SendMessageUseCase` constructor change
- [ ] `pnpm lint` and `pnpm typecheck` pass
