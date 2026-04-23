# 04 — Session Avatar Endpoints (Available Avatars + Transition History)

## Context

Operators and clients need two session-scoped read endpoints:

1. **Available avatars** — which avatars belong to this session's scenario, and which one is currently active
2. **Transition history** — the ordered record of avatar switches that have occurred in this session, derived from the conversation chain

Both are derived from existing data (no new tables required). They address the DoD items:

- "operators can inspect why a transition happened"
- "available avatar list by scenario/session"

Both endpoints are read-only with no side effects.

---

## Scope

### In scope

- `GET /v1/sessions/:sessionId/available-avatars`
- `GET /v1/sessions/:sessionId/avatar-transitions`
- Both use cases (`GetAvailableAvatarsUseCase`, `GetAvatarTransitionsUseCase`)
- Stack-e2e coverage for both (auth, 404, happy path)

### Out of scope

- Filtering available avatars by transition rule eligibility (too advanced for Phase A)
- Avatar names resolved in transition records — avatarId is sufficient for Phase A
- Pagination

---

## Relevant Docs

- `docs/API_CONTRACT.md` — session endpoints pattern, `ApiResponse<T>` envelope
- `docs/DATA_MODEL.md` — Conversation fields: `startedBy`, `reason`, `handoffFromConversationId`, `avatarId`, `startedAt`
- `docs/TEST_STRATEGY.md` — stack-e2e tests must cover auth, validation, resource-not-found

---

## Implementation Guidance

### Endpoint 1: `GET /v1/sessions/:sessionId/available-avatars`

#### Use Case — `application/use-cases/get-available-avatars/`

Constructor dependencies: `sessionRepository`, `avatarRepository`.

Logic:

1. Load session by `sessionId` → `DomainError('NOT_FOUND', ...)` if missing.
2. Call `avatarRepository.listByScenarioId(session.scenarioId)`.
3. Return output with the avatar list and the `currentAvatarId`.

Output shape:

```ts
type GetAvailableAvatarsOutput = {
  sessionId: string
  currentAvatarId: string | null
  avatars: AvatarSummary[]
}
```

`AvatarSummary` is the existing shape from `API_CONTRACT.md`.

#### Route

Add inside `sessionsRoute`:

**`GET /:sessionId/available-avatars`**

- `200 OK` → `ApiResponse<GetAvailableAvatarsOutput>`
- `401` → `UNAUTHORIZED`
- `404` → `NOT_FOUND` (session missing)
- `500` → `INTERNAL_ERROR`

---

### Endpoint 2: `GET /v1/sessions/:sessionId/avatar-transitions`

#### Use Case — `application/use-cases/get-avatar-transitions/`

Constructor dependencies: `sessionRepository`, `conversationRepository`.

Logic:

1. Load session by `sessionId` → `DomainError('NOT_FOUND', ...)` if missing.
2. `conversations = await conversationRepository.listBySessionId(sessionId)` — returns all conversations ordered by `startedAt ASC`.
3. Build transition records from the conversation list:
   - Each conversation that has `handoffFromConversationId != null` represents a transition event.
   - The first conversation (no previous) represents the session-start placement.
   - Map each conversation to an `AvatarTransitionRecord`.

**`AvatarTransitionRecord` shape:**

```ts
type AvatarTransitionRecord = {
  toConversationId: string
  toAvatarId: string
  fromConversationId: string | null // null for the first conversation
  fromAvatarId: string | null // null for the first conversation
  reason: string | null // conversation.reason
  startedBy: 'user' | 'gm' | 'system' | null
  transitionedAt: string // conversation.startedAt
}
```

For the first conversation (`handoffFromConversationId` is null):

- `fromConversationId: null`, `fromAvatarId: null`
- `reason: 'session_start'` (override), `startedBy: conversation.startedBy ?? null`

For subsequent conversations:

- Find the previous conversation by its `conversationId === current.handoffFromConversationId`
- If the previous conversation is not found in the list (data inconsistency): `fromAvatarId: null`

Return all records, ordered by `transitionedAt ASC`.

Output:

```ts
type GetAvatarTransitionsOutput = {
  sessionId: string
  transitions: AvatarTransitionRecord[]
}
```

#### Route

Add inside `sessionsRoute`:

**`GET /:sessionId/avatar-transitions`**

- `200 OK` → `ApiResponse<GetAvatarTransitionsOutput>`
- `401` → `UNAUTHORIZED`
- `404` → `NOT_FOUND` (session missing)
- `500` → `INTERNAL_ERROR`

---

### Stack-E2E Tests — `api/routes/sessions.stack-e2e.test.ts`

Extend the existing file (created in Prompt 03).

#### For `GET /:sessionId/available-avatars`

1. **No API key** → 401
2. **Wrong API key** → 401
3. **Unknown `sessionId`** → 404
4. **Happy path** — create scenario + 2 avatars + session → response includes both avatars, `currentAvatarId` reflects `session.activeAvatarId`

#### For `GET /:sessionId/avatar-transitions`

1. **No API key** → 401
2. **Wrong API key** → 401
3. **Unknown `sessionId`** → 404
4. **Session with no conversations** → 200, `transitions: []`
5. **Session after manual switch** — create scenario + 2 avatars + session + start conversation (avatar A) + switch to avatar B → `transitions` has 2 records: `session_start` entry and a `manual_switch` entry

For cases 4 and 5, seed through the API.

---

## Constraints

- Both use cases are read-only. They never write any state.
- `GetAvatarTransitionsUseCase` must not make N+1 lookups — one `listBySessionId` call is sufficient; derive the full chain in memory from the returned list.
- `listBySessionId` must return conversations ordered `startedAt ASC` — verify the existing `PostgresConversationRepository` implementation returns them in this order. If not, add an `ORDER BY started_at ASC` clause now (or accept that the in-memory version sorts before returning).
- Do not add `listByScenarioId` pagination now — the scenario's avatar count is small for Phase A.

---

## Deliverables

- `apps/core/src/application/use-cases/get-available-avatars/get-available-avatars.types.ts`
- `apps/core/src/application/use-cases/get-available-avatars/get-available-avatars.use-case.ts`
- `apps/core/src/application/use-cases/get-available-avatars/get-available-avatars.use-case.test.ts`
- `apps/core/src/application/use-cases/get-avatar-transitions/get-avatar-transitions.types.ts`
- `apps/core/src/application/use-cases/get-avatar-transitions/get-avatar-transitions.use-case.ts`
- `apps/core/src/application/use-cases/get-avatar-transitions/get-avatar-transitions.use-case.test.ts`
- `apps/core/src/api/routes/sessions.ts` — two new GET handlers added
- `apps/core/src/api/routes/sessions.stack-e2e.test.ts` — extended

---

## Mandatory Final Step — Documentation Update

After implementation:

- `docs/API_CONTRACT.md` — add `GET /v1/sessions/{sessionId}/available-avatars` and `GET /v1/sessions/{sessionId}/avatar-transitions` contracts with full shapes and error mappings. (Full doc sync in Prompt 05.)
- Verify `pnpm --filter @gami/core test` passes.

---

## Acceptance Criteria

- [ ] `GET /v1/sessions/:sessionId/available-avatars` returns `currentAvatarId` + avatar list, 404 on unknown session
- [ ] `GET /v1/sessions/:sessionId/avatar-transitions` returns ordered transition chain, 404 on unknown session, empty array when no conversations
- [ ] Transition records correctly identify `fromAvatarId` from previous conversation
- [ ] First conversation in a session produces a `session_start` reason record
- [ ] Stack-e2e covers auth (401), 404, and happy paths for both endpoints
- [ ] All existing tests still pass
- [ ] `pnpm lint` and `pnpm typecheck` pass with zero errors
