# 03 — Manual Avatar Switch Endpoint

## Context

The GM-driven switch (Prompt 02) handles async orchestrated transitions. A separate explicit path is needed for **manual switching**: an operator or client instructs the system to immediately move to a different avatar, regardless of whether any trigger has fired.

The existing `POST /v1/sessions/:sessionId/conversations` already creates new conversations, but it does not enforce handoff semantics (close the previous conversation, record the handoff chain). The manual switch endpoint provides that contract explicitly.

This endpoint must validate session and avatar state, close the active conversation, create the new conversation with proper handoff metadata, and return the updated session + new conversation.

---

## Scope

### In scope

- `SwitchAvatarUseCase` application use case
- `POST /v1/sessions/:sessionId/switch-avatar` route handler
- `sessions.stack-e2e.test.ts` — extend with switch-avatar tests (auth, 400, 404, 409)
- Integration in `api/server.ts` and `sessions.ts`

### Out of scope

- Rule-based eligibility check for manual switch — manual intent always allowed when session + avatar are valid (operators decide)
- Transition history read endpoint (Prompt 04)
- Modifying existing `StartConversationUseCase` behavior

---

## Relevant Docs

- `docs/API_CONTRACT.md` — session endpoints, common error codes, `ApiResponse<T>` envelope
- `docs/DATA_MODEL.md` — Session, Conversation field definitions
- `docs/TEST_STRATEGY.md` — stack-e2e tests must cover auth, validation, and resource-not-found

---

## Implementation Guidance

### Use Case — `application/use-cases/switch-avatar/`

**Files to create:**

- `switch-avatar.types.ts`
- `switch-avatar.use-case.ts`

#### `SwitchAvatarInput`

```ts
type SwitchAvatarInput = {
  sessionId: string
  avatarId: string // the target avatar
  reason?: string // optional free-text reason label
}
```

#### `SwitchAvatarOutput`

```ts
type SwitchAvatarOutput = {
  session: SessionSummary
  conversation: ConversationSummary // the newly created conversation
  previousConversationId: string | null // null if no active conversation existed
}
```

#### `SwitchAvatarUseCase` logic

Constructor dependencies: `sessionRepository`, `avatarRepository`, `conversationRepository`.

1. Validate `sessionId` and `avatarId` are non-empty strings.
2. Load session → `DomainError('NOT_FOUND', ...)` if missing.
3. Check `session.status === 'active'` → `DomainError('CONFLICT', 'Session is not active.')` if not.
4. Load avatar by `avatarId` → `DomainError('NOT_FOUND', ...)` if missing.
5. Validate `avatar.scenarioId === session.scenarioId` → `DomainError('VALIDATION_ERROR', 'Avatar does not belong to the session scenario.')`.
6. Find current active conversation via `conversationRepository.findActiveBySessionId(sessionId)`.
7. If found: close it — `conversationRepository.update(prev.conversationId, { status: 'closed', endedAt: now })`.
8. Create new conversation: `conversationRepository.create({ sessionId, avatarId, startedBy: 'user', reason: input.reason ?? 'manual_switch', handoffFromConversationId: prev?.conversationId })`.
9. Update session: `sessionRepository.update(sessionId, { activeAvatarId: avatarId, lastActivityAt: now })`.
10. Load updated session and return `SwitchAvatarOutput`.

#### Note on switching to the same avatar

If `avatarId === session.activeAvatarId`, the use case should **still proceed** — it closes the current conversation and opens a new one. This creates a clean conversation break. A future EPIC can add an idempotency guard if needed.

### Route — `api/routes/sessions.ts`

Add a new handler inside the existing `sessionsRoute` plugin.

**Endpoint:** `POST /:sessionId/switch-avatar`

**Request body schema:**

```json
{
  "type": "object",
  "required": ["avatarId"],
  "properties": {
    "avatarId": { "type": "string", "minLength": 1 },
    "reason": { "type": "string", "maxLength": 200 }
  },
  "additionalProperties": false
}
```

**Responses:**

- `200 OK` → `ApiResponse<SwitchAvatarOutput>` (note: 200, not 201 — this is a state transition, not resource creation)
- `401` → `UNAUTHORIZED`
- `400` → `VALIDATION_ERROR`
- `404` → `NOT_FOUND`
- `409` → `CONFLICT`
- `500` → `INTERNAL_ERROR`

Wire `SwitchAvatarUseCase` through the existing `SessionsRouteOptions` (no new options needed — `conversationRepository` is already in the options bag).

### Stack-E2E Tests — `api/routes/sessions.stack-e2e.test.ts`

If this file does not already exist, create it. If it does, extend it with a `describe('POST /:sessionId/switch-avatar')` block.

Required test cases:

1. **No API key** → 401 `UNAUTHORIZED`
2. **Wrong API key** → 401 `UNAUTHORIZED`
3. **Missing `avatarId` in body** → 400 `VALIDATION_ERROR`
4. **Unknown `sessionId`** → 404 `NOT_FOUND`
5. **Happy path** — create scenario, create avatar, create session, start conversation, then switch to a second avatar → 200 with correct `SwitchAvatarOutput` shape

For case 5, the test must seed data through the API (real HTTP calls using `app.inject()`).

---

## Constraints

- No new repository ports needed — uses `IConversationRepository.findActiveBySessionId()` introduced in Prompt 02.
- `reason` field defaults to `'manual_switch'` in the use case when not supplied by the caller. Do not hard-code a specific string in the route layer.
- Do not modify `StartConversationUseCase` — the manual switch is a separate concern.
- The route handler must go through `mapDomainError` (existing helper in `sessions.ts`) — do not duplicate error mapping logic.

---

## Deliverables

- `apps/core/src/application/use-cases/switch-avatar/switch-avatar.types.ts`
- `apps/core/src/application/use-cases/switch-avatar/switch-avatar.use-case.ts`
- `apps/core/src/application/use-cases/switch-avatar/switch-avatar.use-case.test.ts`
- `apps/core/src/api/routes/sessions.ts` — new `switch-avatar` handler added
- `apps/core/src/api/routes/sessions.stack-e2e.test.ts` — created or extended

---

## Mandatory Final Step — Documentation Update

After implementation:

- `docs/API_CONTRACT.md` — add `POST /v1/sessions/{sessionId}/switch-avatar` contract (request, response, error mapping). Full doc update in Prompt 05, but add the entry now to avoid drift.
- Verify `pnpm --filter @gami/core test` passes.

---

## Acceptance Criteria

- [ ] `SwitchAvatarUseCase` validates session, avatar, scenario membership
- [ ] Closes previous active conversation and records `handoffFromConversationId`
- [ ] Updates `session.activeAvatarId` and `lastActivityAt`
- [ ] Returns `SwitchAvatarOutput` with new conversation + previous conversation ID
- [ ] Route returns `200 OK` on success, correct error codes on failure
- [ ] Stack-e2e covers auth (401 no-key, 401 wrong-key), 400, 404, and happy path 200
- [ ] All existing tests still pass
- [ ] `pnpm lint` and `pnpm typecheck` pass with zero errors
