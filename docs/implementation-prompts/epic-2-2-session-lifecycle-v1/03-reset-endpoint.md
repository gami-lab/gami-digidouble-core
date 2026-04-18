# 03 — ResetSessionUseCase + DELETE /v1/conversations/:sessionId

## Context

Sessions accumulate messages. Developers and operators need the ability to wipe runtime state
and start a conversation fresh without creating a new session record. This is also the
foundation for the replay and recovery tools in EPIC 3.3.

The reset operation:

- **deletes all messages** for the session
- **keeps the `Session` record** (the session ID remains valid; the session is not removed)
- returns counts of what was deleted

This operation requires a new method on `IMessageRepository` that does not currently exist:
`deleteBySessionId`.

---

## Scope

**In scope:**

- Add `deleteBySessionId(sessionId: string): Promise<number>` to `IMessageRepository` port
- Implement `deleteBySessionId` in `InMemoryMessageRepository`
- `ResetSessionUseCase` in `application/use-cases/reset-session/`
- `DELETE /v1/conversations/:sessionId` route added to `api/routes/conversations.ts`
- Unit tests for the use case
- API tests (`inject()`) for the route
- Stack-e2e test cases added to `conversations.stack-e2e.test.ts`

**Out of scope:**

- Deleting session memory (EPIC 4.2 — Memory Layer; `deleted.sessionMemory` returns `false` for now)
- Deleting events (EPIC 3.2 — Session Inspector; `deleted.events` returns `0` for now)
- Audit log entry for reset action (EPIC 3.3 — Replay & Recovery)
- Archiving or closing session status on reset (session stays `active` unless caller explicitly closes it)

---

## Relevant Docs

- `docs/API_CONTRACT.md` — §6 Reset Session (endpoint, response shape)
- `docs/DATA_MODEL.md` — §4 Session, §5 Message
- `apps/core/src/application/ports/IMessageRepository.ts` — current port definition
- `apps/core/src/infrastructure/db/in-memory-message.repository.ts` — implementation to update

---

## Implementation Guidance

### Port update — `IMessageRepository`

Add:

```ts
deleteBySessionId(sessionId: string): Promise<number>
```

Returns the count of messages deleted. This count flows into the API response.

The `DeleteBySessionId` method is **not** in `FindMessagesOptions` — it is a top-level method
on the interface. Update the port file directly.

### `InMemoryMessageRepository.deleteBySessionId`

Filter out all messages matching `sessionId`, record the count, update the internal array,
and return the count.

Because `InMemoryMessageRepository` uses a mutable array (`private readonly messages: Message[]`)
internally, the delete must mutate the array in place using `splice` or replace the array reference
using `filter`. Be careful: `readonly` on the field means the reference cannot be reassigned, but
the array contents can be mutated via `splice`. Use `splice` with an index scan, or use a pattern
that works within the `readonly` constraint.

### `ResetSessionUseCase`

**Types (`reset-session.types.ts`):**

```ts
export interface ResetSessionInput {
  sessionId: string
}

export interface ResetSessionOutput {
  sessionId: string
  deleted: {
    messages: number
    sessionMemory: boolean
    events: number
  }
}
```

**Use case (`reset-session.use-case.ts`):**

Constructor dependencies: `ISessionRepository`, `IMessageRepository`

`execute(input)`:

1. Load session via `sessionRepository.findById(input.sessionId)`
2. If `null` → throw `DomainError('SESSION_NOT_FOUND', 'Session not found')`
3. Delete all messages for the session: `count = await messageRepository.deleteBySessionId(input.sessionId)`
4. Return `{ sessionId: input.sessionId, deleted: { messages: count, sessionMemory: false, events: 0 } }`

The session record is not modified. `sessionMemory: false` and `events: 0` are hardcoded in Phase A
with a comment noting the deferred implementations.

### Route addition to `api/routes/conversations.ts`

Add `DELETE '/:sessionId'` to the existing `conversationsRoute` plugin.

- Auth: `authenticateApiKey` preHandler
- Params schema: `{ sessionId: string }`
- On success: 200 → `ok(output)` (wraps `ResetSessionOutput` in `ApiResponse`)
- Error mapping:
  - `401` → `UNAUTHORIZED`
  - `404` → `SESSION_NOT_FOUND` (from `DomainError`)
  - `500` → `INTERNAL_ERROR`

**Note:** The HTTP verb is `DELETE`, but the operation does not delete the session entity —
it only deletes the session's messages. This is intentional: "reset" in the product sense
means wiping state, not removing the session.

### Stack-e2e additions to `conversations.stack-e2e.test.ts`

Add a new `describe` block: `Stack E2E — DELETE /v1/conversations/:sessionId`.

Cases:

- No API key → 401
- Wrong API key → 401
- Unknown `sessionId` → 404 with `error.code === 'SESSION_NOT_FOUND'`
- Happy path:
  1. Create session via `POST /v1/conversations/start` → get `sessionId`
  2. `DELETE /v1/conversations/:sessionId` → 200
  3. `data.sessionId` matches the created session
  4. `data.deleted.messages` is a number (0 for a freshly created session with no messages)
  5. `data.deleted.sessionMemory` is `false`
  6. `data.deleted.events` is `0`

---

## Constraints

- `deleteBySessionId` must return a count, not void — this is part of the API contract
- `InMemoryMessageRepository` internal `messages` field is `readonly` — mutate via splice or
  similar; do not attempt to reassign the array reference
- `ResetSessionUseCase` must not call `sessionRepository.delete()` — it is a data wipe, not
  a session deletion
- `sessionMemory: false` and `events: 0` should be accompanied by a
  `// TODO(EPIC-4.2): delete session memory` and `// TODO(EPIC-3.3): count and delete events`
  comment respectively
- No `any`; TypeScript strict mode

---

## Deliverables

- `apps/core/src/application/ports/IMessageRepository.ts` — `deleteBySessionId` added
- `apps/core/src/infrastructure/db/in-memory-message.repository.ts` — `deleteBySessionId` implemented
- `apps/core/src/application/use-cases/reset-session/reset-session.types.ts`
- `apps/core/src/application/use-cases/reset-session/reset-session.use-case.ts`
- `apps/core/src/application/use-cases/reset-session/reset-session.use-case.test.ts`
- `apps/core/src/api/routes/conversations.ts` — reset route added
- `apps/core/src/api/routes/conversations.test.ts` — reset route test cases added
- `apps/core/src/api/routes/conversations.stack-e2e.test.ts` — reset stack-e2e cases added

---

## Mandatory Final Step — Documentation Update

After implementation:

- `docs/PROJECT_STATUS.md` — note Prompt 03 complete; record new files
- `docs/API_CONTRACT.md` — verify §6 Reset Session matches response shape as implemented;
  add inline note that `sessionMemory` and `events` are hardcoded to `false`/`0` until their
  respective EPICs are implemented
- `docs/DATA_MODEL.md` — note that `deleteBySessionId` was added to the `IMessageRepository`
  port; no schema change, no new entity

---

## Acceptance Criteria

- [ ] `DELETE /v1/conversations/:sessionId` returns 200 with correct deletion counts
- [ ] Returns 404 with `SESSION_NOT_FOUND` for unknown session
- [ ] Returns 401 for missing/wrong API key
- [ ] Calling history after reset returns an empty `messages` array
- [ ] Session record still exists after reset (a subsequent `GET /history` returns 200, not 404)
- [ ] `IMessageRepository.deleteBySessionId` port method is defined and implemented in `InMemoryMessageRepository`
- [ ] Use case unit tests pass (happy path, session not found, messages count correct)
- [ ] API tests (`inject()`) cover 200, 401, 404
- [ ] Stack-e2e cases pass (auth, 404, happy path with correct envelope fields)
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` all pass
