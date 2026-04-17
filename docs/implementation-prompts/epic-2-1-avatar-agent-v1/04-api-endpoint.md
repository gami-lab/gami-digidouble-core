# 04 — API Endpoint: POST /v1/conversations/{sessionId}/messages

## Context

`SendMessageUseCase` exists (Prompt 03) but has no HTTP entry point yet.

This prompt wires it to the public API contract: `POST /v1/conversations/{sessionId}/messages` as defined in `docs/API_CONTRACT.md` section 2.

This is the main conversation endpoint — the one external clients will call to send a user message and receive an avatar response. It replaces the raw `POST /v1/exchange` endpoint for real conversation flows (though `/v1/exchange` remains for debugging).

## Scope

**In scope:**

- Fastify route plugin: `POST /v1/conversations/:sessionId/messages`
- Request body validation: `message.content` required, non-empty, max 4000 chars
- `avatarId` accepted as a required body field for this Sprint (no scenario/default wiring yet)
- Auth: `authenticateApiKey` preHandler (already exists — reuse it)
- Use case wiring: instantiate `SendMessageUseCase` with injected adapters
- Response mapping: `SendMessageOutput` → `ApiResponse<SendMessageResponse>` envelope
- Error mapping:
  - `DomainError` with `NOT_FOUND` code → HTTP 404
  - `DomainError` with session-closed code → HTTP 409 (conflict)
  - `LlmError` → HTTP 502
  - Unhandled error → HTTP 500
- Register the route in `api/server.ts`

**Out of scope:**

- Streaming endpoint (`/messages/stream`) — EPIC 3.3
- `GET /v1/conversations/{sessionId}/history` — EPIC 3.2
- `POST /v1/conversations/start` — EPIC 3.2
- Avatar defaulting from scenario config (EPIC 4.2 — for now `avatarId` is a required request field)
- Rate limiting (Phase B)

## Relevant Docs

- `docs/API_CONTRACT.md` — Section 2 "Send Message" — request, response, error codes
- `docs/ARCHITECTURE.md` — API layer rules: no business logic; validation, auth, mapping only
- `docs/TECH_STACK.md` — Fastify patterns; `inject()` for testing

## Implementation Guidance

### Route file: `src/api/routes/messages.ts`

Create a Fastify plugin following the same pattern as `exchange.ts`.

**Route options interface:**

```ts
interface MessagesRouteOptions {
  llmAdapter?: ILlmAdapter
  observabilityAdapter?: IObservabilityAdapter
  avatarRepository?: IAvatarRepository
  sessionRepository?: ISessionRepository
  messageRepository?: IMessageRepository
}
```

**Body schema (Fastify JSON schema):**

```json
{
  "type": "object",
  "required": ["message", "avatarId"],
  "properties": {
    "avatarId": { "type": "string", "minLength": 1 },
    "message": {
      "type": "object",
      "required": ["content"],
      "properties": {
        "content": { "type": "string", "minLength": 1, "maxLength": 4000 }
      }
    }
  }
}
```

**Response shape** (align strictly with `API_CONTRACT.md` `SendMessageResponse`):

```ts
{
  session: { sessionId, userId, scenarioId, status, startedAt, lastActivityAt },
  userMessage: { messageId, sessionId, role, content, createdAt },
  avatarMessage: { messageId, sessionId, role, content, createdAt, metadata },
  debug: { requestId, model, latencyMs, inputTokens, outputTokens }
}
```

Note: the use case output (`SendMessageOutput`) is a simpler DTO. The route handler must map it to the full `SendMessageResponse` shape. Load the session from the repository again after the use case executes (or pass session data through the use case output) to populate the `session` field in the response.

**Error handler:**

```ts
if (err instanceof DomainError) {
  switch (err.code) {
    case 'NOT_FOUND': return reply.status(404).send(fail(...))
    case 'SESSION_CLOSED': return reply.status(409).send(fail(...))
  }
}
if (err instanceof LlmError) return reply.status(502).send(fail(...))
return reply.status(500).send(fail(...))
```

### Default adapters (non-test path)

When no adapter overrides are injected (production path), construct defaults using `createLlmAdapter(config)`, `createObservabilityAdapter(config)`, `new InMemoryAvatarRepository(...)` (placeholder until DB is wired in EPIC 3.x), and similarly for session/message repositories.

For Sprint 2: `InMemorySessionRepository` and `InMemoryMessageRepository` are acceptable as placeholders. They can be pre-seeded with test data for manual testing. The key is that the interfaces are respected — the repositories can be swapped without touching the route.

### Register the route in `api/server.ts`

```ts
server.register(messagesRoute, { prefix: '/v1/conversations' })
```

The route will then be accessible at `POST /v1/conversations/:sessionId/messages`.

### In-memory session and message repositories

If `InMemorySessionRepository` and `InMemoryMessageRepository` do not yet exist in `infrastructure/db/`, create them following the same pattern as `InMemoryAvatarRepository` from Prompt 01. They are needed for testing and for the non-test wiring path in Sprint 2.

## Constraints

- Route handler must not contain business logic — only: validate, auth, instantiate use case, call, map response, handle errors
- No direct LLM SDK imports in the route file
- `DomainError` and `LlmError` imports are acceptable in route handler error mapping — these are infrastructure edge concerns
- TypeScript strict: all body fields accessed via typed schema inference or explicit cast — no `any`
- Fastify body schema must prevent `minLength: 0` for `content` (empty avatar IDs are invalid)
- `max-lines-per-function` ≤ 50 — split handler into sub-functions if needed

## Deliverables

- `src/api/routes/messages.ts` — Fastify plugin with `POST /:sessionId/messages`
- Updated `src/api/server.ts` — route registered
- `InMemorySessionRepository` and `InMemoryMessageRepository` if not already present
- API test file: `src/api/routes/messages.test.ts` — Fastify `inject()` tests using `NullLlmAdapter` and in-memory repositories

## Mandatory Final Step — Documentation Update

After implementation, verify:

- `docs/API_CONTRACT.md` — confirm "Send Message" section matches the implementation exactly; update any discrepancies
- `docs/PROJECT_STATUS.md` — EPIC 2.1 / Prompt 04 noted

## Acceptance Criteria

- [ ] `POST /v1/conversations/:sessionId/messages` route exists and is registered
- [ ] Valid request with active session and known avatar → 200 with full `SendMessageResponse`
- [ ] Missing or wrong API key → 401
- [ ] Missing `message.content` or empty content → 400
- [ ] Unknown session → 404 via `DomainError`
- [ ] Closed session → 409 via `DomainError`
- [ ] `LlmError` → 502
- [ ] Unexpected error → 500
- [ ] Response envelope uses `ApiResponse<T>` shape (data / error / meta)
- [ ] Route handler contains no business logic
- [ ] API tests pass using `inject()` with no live LLM
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` all pass
