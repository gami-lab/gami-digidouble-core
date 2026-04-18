# 02 — GameMasterService: LLM-Backed GM Decision

## Context

With the GM domain types, reducer, and trigger logic in place (Prompt 01), the next step is the
service that executes the actual Game Master decision: given a `GameMasterInput`, call the LLM
through the `ILlmAdapter` port and parse the response into a validated `GameMasterOutput`.

The `GameMasterService` lives in the **domain** layer. It calls the LLM via an injected port — no
direct provider SDK imports. It owns the GM prompt and the output parsing/validation logic.

---

## Scope

**In scope:**

- `GameMasterService` class in `domain/game-master/game-master.service.ts`
  - `run(input: GameMasterInput): Promise<GameMasterOutput>`
  - Constructs the GM system prompt from the input
  - Calls `ILlmAdapter.complete()` with a structured JSON-requesting prompt
  - Parses and validates the raw LLM response into a `GameMasterOutput`
  - Throws a typed `GameMasterError` if parsing fails or the response is structurally invalid
- `GameMasterError` error class (in `domain/game-master/game-master.error.ts` or inline)
- Unit tests for `GameMasterService` using a mocked `ILlmAdapter`

**Out of scope:**

- State persistence (Prompt 03)
- Trigger decision logic (already in Prompt 01 — `evaluateTriggerReason`)
- Wiring into the use case (Prompt 04)
- Any LLM integration tests (use the `NullLlmAdapter` pattern)

---

## Relevant Docs

- `docs/GAME_MASTER_CONTRACT.md` — §4 Input, §5 Output, §8 Core Decisions, §10 What GM Does NOT Do, §11 Example
- `docs/ARCHITECTURE.md` — Domain Layer rules; Ports/adapters; no vendor coupling in domain
- `docs/TECH_STACK.md` — LLM abstraction requirements
- `docs/TEST_STRATEGY.md` — Unit tests for domain; mock only at infrastructure boundaries; consumer-contract assertions
- `apps/core/src/application/ports/ILlmAdapter.ts` — `LlmRequest`, `LlmResponse`, `ILlmAdapter`
- `apps/core/src/domain/game-master/game-master.types.ts` — `GameMasterInput`, `GameMasterOutput`

---

## Implementation Guidance

### `GameMasterService`

Constructor receives one dependency: `ILlmAdapter`.

```ts
class GameMasterService {
  constructor(private readonly llm: ILlmAdapter) {}
  async run(input: GameMasterInput): Promise<GameMasterOutput>
}
```

**Prompt construction (`buildGmPrompt`):**

The system prompt should instruct the LLM to act as a lightweight background director. Include:

- its role: background orchestrator, not the speaker
- the current session state (progression, topics covered, interaction count)
- the scenario context (description)
- available avatars
- what it must decide (which avatar, whether to continue or switch, optional brief notes)
- the **exact JSON schema** it must return, matching `GameMasterOutput`
- explicit instruction to return only valid JSON, no prose

The user message should contain the latest user message text (from `input.userMessage.text`).

Keep the prompt focused and short — the GM makes lightweight decisions.

**Structured output parsing (`parseGmOutput`):**

The LLM response (`LlmResponse.content`) is expected to be raw JSON. Parse it with `JSON.parse`.
Validate the required fields (`avatarId`, `conversationMode`, `stateUpdate.interactionIncrement`).

If parsing fails or required fields are missing, throw `GameMasterError`.

Do not use any external JSON schema library — plain TypeScript type narrowing is sufficient for
the MVP output shape.

**`GameMasterError`:**

```ts
class GameMasterError extends Error {
  constructor(
    message: string,
    public readonly raw?: string,
  ) {
    super(message)
    this.name = 'GameMasterError'
  }
}
```

### Unit tests (`game-master.service.test.ts`)

Use a mock `ILlmAdapter` (same pattern as `send-message.use-case.test.ts`).

Test cases must include:

- Happy path: valid JSON response from LLM → returns correct `GameMasterOutput`
- `avatarId` returned matches the available avatar in input context
- `conversationMode` defaults to `'continue'` when omitted
- `context.notes` is optional — present when LLM includes it, absent when not
- Malformed JSON response → throws `GameMasterError`
- Missing required field (`avatarId`) → throws `GameMasterError`
- The LLM is called with a `systemPrompt` containing the scenario's `description`
- The LLM is called with a `messages` array containing the user message text

---

## Constraints

- `ILlmAdapter` is the only infrastructure dependency — injected, never imported directly
- No `any` — parse defensively and type-narrow explicitly
- Do not call `JSON.parse` without a try/catch
- The GM prompt must not include raw conversation history — the Avatar owns its own context
- The GM system prompt and user message must both be non-empty strings
- TypeScript strict mode

---

## Deliverables

- `apps/core/src/domain/game-master/game-master.service.ts` — `GameMasterService`, `buildGmPrompt`, `parseGmOutput`
- `apps/core/src/domain/game-master/game-master.error.ts` — `GameMasterError`
- `apps/core/src/domain/game-master/game-master.service.test.ts` — unit tests

---

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md` — mark Prompt 02 of EPIC 2.2 as done
- Verify `docs/GAME_MASTER_CONTRACT.md §5` still matches the `GameMasterOutput` shape being parsed.
  If the prompt format or parsing rules needed deviation, document it.
- No other docs should need changes at this stage.

---

## Acceptance Criteria

- [ ] `GameMasterService.run()` calls `ILlmAdapter.complete()` exactly once per invocation
- [ ] The `systemPrompt` passed to the LLM includes the scenario description and available avatars
- [ ] The user message passed to the LLM contains the `input.userMessage.text`
- [ ] Valid LLM response produces a correctly typed `GameMasterOutput`
- [ ] Malformed JSON response throws `GameMasterError`
- [ ] Missing required `avatarId` field throws `GameMasterError`
- [ ] `GameMasterService` has no direct imports from `infrastructure/`
- [ ] Unit tests are deterministic (mocked LLM, no real calls)
- [ ] `pnpm lint` and `pnpm typecheck` pass
