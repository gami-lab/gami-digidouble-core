# 03 — SendMessage Use Case

## Context

`SendRawMessageUseCase` (EPIC 1.2) is a stateless, sessionless MVP that proves the LLM loop works. It has no avatar identity, no session context, no message history.

EPIC 2.1 requires replacing it with `SendMessageUseCase` — the real conversation use case that:

- loads a real avatar config and uses its persona to build the system prompt
- loads the session to validate it is active
- persists user and avatar messages
- passes accumulated conversation history to the LLM so the avatar can sustain multi-turn exchanges
- fires observability trace as in EPIC 1.2

`SendRawMessageUseCase` is kept for now — it is still wired to `POST /v1/exchange` (the raw debug endpoint). Do not remove it.

## Scope

**In scope:**

- `SendMessageInput` / `SendMessageOutput` DTOs
- `SendMessageUseCase` application-layer use case class
- Wiring: reads avatar config via `IAvatarRepository`, session via `ISessionRepository`, messages via `IMessageRepository`
- Uses `PersonaPromptService` (from Prompt 02) to assemble the system prompt
- Builds message history: retrieve up to N recent messages from the session and pass them as the LLM `messages` array in chronological order; N is a constant for now (e.g. 20 — configurable later)
- Persists user message before LLM call, avatar message after
- Non-blocking observability trace (same pattern as `SendRawMessageUseCase`)
- Error surface: surface `LlmError` as-is; let session/avatar not-found become a domain error

**Out of scope:**

- Context assembly from memory or knowledge (EPIC 4.2)
- Game Master observation trigger (EPIC 2.2 — leave a clear `// TODO(EPIC-2.2): trigger GM observation` comment after avatar message is stored)
- Streaming (EPIC 3.3)
- Token budget enforcement (EPIC 4.2)
- Automatic session creation (session must already exist — caller is responsible)

## Relevant Docs

- `docs/ARCHITECTURE.md` — Application layer rules; use case owns workflow coordination
- `docs/API_CONTRACT.md` — `SendMessageResponse` shape; `Message` type; session summary
- `docs/DATA_MODEL.md` — Session, Message entities; `role` enum: `'user' | 'avatar' | 'system'`
- `docs/PRINCIPLES.md` — "Avatar answers first; GM async" — never block avatar response on GM
- `docs/TEST_STRATEGY.md` — Application layer tests use `vi.fn()` mocks at module level

## Implementation Guidance

### Location

```
src/application/use-cases/send-message/
  send-message.types.ts
  send-message.use-case.ts
```

### DTOs

**Input:**

```ts
type SendMessageInput = {
  sessionId: string
  avatarId: string
  userMessage: string
}
```

**Output:**

```ts
type SendMessageOutput = {
  requestId: string
  sessionId: string
  userMessage: {
    messageId: string
    content: string
    createdAt: string
  }
  avatarMessage: {
    messageId: string
    content: string
    createdAt: string
    model: string
    inputTokens: number
    outputTokens: number
    latencyMs: number
  }
}
```

### Use Case Flow

```
1. Validate sessionId and avatarId are non-empty strings
2. Load session via ISessionRepository.findById(sessionId)
   → if null: throw domain error NOT_FOUND
   → if status !== 'active': throw domain error (session closed/archived)
3. Load avatar via IAvatarRepository.findById(avatarId)
   → if null: throw domain error NOT_FOUND
4. Assemble system prompt via assemblePersonaPrompt(avatarConfig)
5. Load recent message history via IMessageRepository.findBySessionId(sessionId, { limit: 20 })
   → map to LLM message format: { role: 'user' | 'assistant', content: string }
   → avatar messages map to role 'assistant'
6. Persist user message via IMessageRepository.save({ role: 'user', content, ... })
7. Call ILlmAdapter.complete({ systemPrompt, messages: [...history, userMessage] })
8. Persist avatar message via IMessageRepository.save({ role: 'avatar', content: response.content, metadata: {...} })
9. // TODO(EPIC-2.2): trigger async GM observation here (non-blocking)
10. Fire non-blocking observability trace (same pattern as SendRawMessageUseCase)
11. Return SendMessageOutput
```

### Ports required

The use case constructor must accept:

- `ISessionRepository` — `findById`
- `IAvatarRepository` — `findById`
- `IMessageRepository` — `findBySessionId` (with limit), `save`
- `ILlmAdapter`
- `IObservabilityAdapter`

### `IMessageRepository` port extension

The existing `IMessageRepository` port may need a `findBySessionId(sessionId: string, options?: { limit?: number }): Promise<Message[]>` method added. Add it to `application/ports/IMessageRepository.ts`.

### Message ID generation

Use `crypto.randomUUID()` prefixed with `msg_` for message IDs. Use ISO timestamp for `createdAt`.

### Domain error type

Define or reuse a lightweight domain error class. It should carry a `code` (aligned with API error codes from `packages/shared`) and `message`. Keep it simple: a plain class extending `Error` with a `code` field. Place it in `src/domain/errors.ts` if it doesn't exist yet.

## Constraints

- Application layer only imports from `application/ports/` and `domain/` — no infrastructure imports
- No direct LLM provider SDK imports
- Observability failure must never propagate to the caller — catch and log to stderr
- `LlmError` must propagate unmodified — the API layer handles it
- History must be sorted chronologically (oldest first) — LLMs need temporal order
- `max-lines-per-function` ≤ 50 — split the `execute()` method into private helpers if needed (e.g., `#buildLlmMessages()`, `#persistUserMessage()`)

## Deliverables

- `src/application/use-cases/send-message/send-message.types.ts`
- `src/application/use-cases/send-message/send-message.use-case.ts`
- Updated `src/application/ports/IMessageRepository.ts` with `findBySessionId`
- `src/domain/errors.ts` (or equivalent) with a `DomainError` class
- Unit tests: `send-message.use-case.test.ts` — module-level `vi.fn()` mocks, no live LLM

## Mandatory Final Step — Documentation Update

After implementation, verify:

- `docs/PROJECT_STATUS.md` — EPIC 2.1 / Prompt 03 noted
- `docs/DATA_MODEL.md` — confirm message persistence model is still aligned
- `docs/API_CONTRACT.md` — confirm `SendMessageResponse` shape matches the DTO

## Acceptance Criteria

- [ ] `SendMessageUseCase.execute()` exists and follows the flow described above
- [ ] Session not found → `DomainError` with appropriate code
- [ ] Session closed/archived → `DomainError`
- [ ] Avatar not found → `DomainError`
- [ ] User message persisted before LLM call
- [ ] Avatar message persisted after LLM call with full metadata (model, tokens, latency)
- [ ] Conversation history (up to 20 messages) passed to LLM in chronological order
- [ ] Observability trace fires non-blocking; failure does not propagate
- [ ] `LlmError` propagates to caller
- [ ] `// TODO(EPIC-2.2)` comment present after avatar message is stored
- [ ] Unit tests cover: happy path, session not found, avatar not found, closed session, LLM error, observability failure swallowed, history ordering
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` all pass
