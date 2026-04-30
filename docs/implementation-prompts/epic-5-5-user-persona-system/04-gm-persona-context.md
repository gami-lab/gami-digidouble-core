# 04 — GM Persona Context

## Context

The avatar now receives persona context in its prompt (prompt 03). The Game Master also needs
to be aware of who the user is, so its routing decisions, pacing assessments, and guidance
notes can be persona-sensitive. This prompt threads `userPersona` from `SendMessageUseCase` into
`RunGameMasterInput` and from there into the `GameMasterInput` JSON that the LLM receives.

## Scope

**In scope:**

- Extend `RunGameMasterInput` with optional `userPersona?: UserPersona`
- Extend `GameMasterInput.context` with optional `userPersona?: UserPersona`
- Thread `userPersona` from `SendMessageUseCase` to `RunGameMasterUseCase.execute()` call
- Thread `userPersona` from `RunGameMasterUseCase` into the `GameMasterInput` struct it builds
  before calling the LLM
- Unit tests proving the GM LLM receives the persona in its input JSON

**Out of scope:**

- Loading the persona inside `RunGameMasterUseCase` (it must be passed in, not loaded)
- Changing GM output parsing, GM state reduction, or GM event emission
- Changing the Game Master system prompt text (only the input JSON is extended)

## Relevant Docs

- `docs/GAME_MASTER_CONTRACT.md` — GM input/output contract; what the GM receives and what it
  is allowed to use
- `docs/ARCHITECTURE.md` — GM is async and non-blocking; `SendMessageUseCase` fires and forgets
  the GM run

## Implementation Guidance

### Extend `RunGameMasterInput`

Location: `application/use-cases/run-game-master/run-game-master.types.ts`

Add:

```ts
export type RunGameMasterInput = {
  sessionId: string
  scenarioId: string
  avatarId: string
  userMessageText: string
  turnIndex: number
  correlationId: string
  userPersona?: UserPersona // <-- new optional field
}
```

### Extend `GameMasterInput`

Location: `domain/game-master/game-master.types.ts`

In `GameMasterInput.context`, add:

```ts
context: {
  experience: { ... }
  availableAvatars: [...]
  userPersona?: UserPersona   // <-- new optional field
}
```

This matches the design principle: the GM input is a serialized JSON struct — external callers
pass everything in; the GM never loads data autonomously.

### Thread in `RunGameMasterUseCase`

Inside `RunGameMasterUseCase`, locate the method that builds `GameMasterInput` (in
`buildGameMasterInput` or equivalent). Pass `input.userPersona` into
`context.userPersona` if present.

### Thread in `SendMessageUseCase`

The `SendMessageUseCase` already fires the GM asynchronously. It already loads `userPersona`
(from prompt 03). Extend the GM call arguments to include:

```ts
...(userPersona !== undefined ? { userPersona } : {})
```

No additional loading or computation — reuse the persona already loaded for avatar prompt assembly.

### Unit tests

#### `run-game-master.use-case.test.ts` additions

- When `RunGameMasterInput` carries `userPersona: { role: 'friend' }`, the `completeMock`
  receives a GM input JSON that contains `context.userPersona.role === 'friend'`
- When `RunGameMasterInput.userPersona` is absent, `context.userPersona` is undefined (no
  injection of empty object)

#### `send-message.use-case.test.ts` additions

- When `userRepository.findById` returns a user with persona `{ role: 'coach' }`, the
  `runGameMasterUseCase.execute` call receives `userPersona: { role: 'coach' }`
- When persona is absent, `runGameMasterUseCase.execute` is called without `userPersona`

## Constraints

- `RunGameMasterUseCase` must NOT add an `IUserRepository` dependency — persona is passed in.
- `GameMasterInput` is serialized as JSON and sent to the LLM — keep the field name simple
  (`userPersona`, not `user_persona` or `playerPersona`).
- The change to `GameMasterInput` is additive and backwards-compatible; all existing tests must
  still pass without modification.
- Do not modify any GM output parsing or state reduction code — only the input struct changes.

## Deliverables

- `apps/core/src/application/use-cases/run-game-master/run-game-master.types.ts` — updated
- `apps/core/src/domain/game-master/game-master.types.ts` — `GameMasterInput.context` updated
- `apps/core/src/application/use-cases/run-game-master/run-game-master.use-case.ts` — threads
  `userPersona` into `GameMasterInput`
- `apps/core/src/application/use-cases/run-game-master/run-game-master.use-case.test.ts` — new
  test cases
- `apps/core/src/application/use-cases/send-message/send-message.use-case.ts` — threads
  `userPersona` into GM call
- `apps/core/src/application/use-cases/send-message/send-message.use-case.test.ts` — new test
  cases

## Mandatory Pre-Implementation Check

Before coding:

1. Read `run-game-master.types.ts` in full — understand the current `RunGameMasterInput` shape.
2. Read `game-master.types.ts` — understand the current `GameMasterInput.context` shape; confirm
   there is no `userPersona` already present.
3. Read `run-game-master.use-case.ts` to find where `GameMasterInput` is assembled —
   specifically the `buildGameMasterInput` method or equivalent.
4. Read `send-message.use-case.ts` to find where `RunGameMasterUseCase.execute()` is called —
   this is where `userPersona` must be passed through.
5. Confirm all existing `run-game-master.use-case.test.ts` test cases still compile with the
   extended input type (adding optional field is non-breaking).

## Mandatory Final Step — Documentation Update

After implementation:

- Update `docs/GAME_MASTER_CONTRACT.md` to document the new `context.userPersona` field in the
  GM input contract — describe it as optional context about the user's role.
- Confirm `docs/API_CONTRACT.md` does not need changes (the endpoint shape is unchanged).
- `pnpm lint && pnpm typecheck && pnpm test` must pass.

## Acceptance Criteria

- [ ] `RunGameMasterInput` has optional `userPersona?: UserPersona`
- [ ] `GameMasterInput.context` has optional `userPersona?: UserPersona`
- [ ] `RunGameMasterUseCase` passes `userPersona` into the `GameMasterInput` it sends to the LLM
- [ ] `SendMessageUseCase` threads the already-loaded `userPersona` into the GM call
- [ ] Test proves the LLM completeMock receives `userPersona` in `context`
- [ ] All existing GM tests pass unchanged
- [ ] `docs/GAME_MASTER_CONTRACT.md` updated
- [ ] `pnpm lint && pnpm typecheck && pnpm test` pass
