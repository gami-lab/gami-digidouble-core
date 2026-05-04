# Prompt 05 — Tests, Hardening, and Doc Sync

## Objective

Complete the EPIC 4.5 delivery with:

1. Stack-e2e tests for both new endpoints
2. Hardening fixes for any identified gaps
3. Documentation updates: `PROJECT_STATUS.md`, `API_CONTRACT.md`, `DATA_MODEL.md`

---

## Prerequisite Reading

- `docs/TEST_STRATEGY.md` — stack-e2e tier, what to test at this level
- `docs/TEST_COVERAGE_PLAN.md` — per-module coverage expectations
- `docs/API_CONTRACT.md` §4.1 and §4.2 — confirm the implementation matches the contracts
  (no divergence should exist; update only if there was an intentional deviation with justification)
- `apps/core/vitest.stack-e2e.config.ts` — how stack-e2e tests are configured

After reading, confirm both new routes are working in the live stack (docker-compose) before
writing the stack-e2e tests.

---

## Step 1 — Stack-E2E: Snapshot Endpoint

Create `apps/core/src/api/routes/get-runtime-state.stack-e2e.test.ts`.

### Required test cases

| Test                               | Expected                                                                                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| No `x-api-key`                     | `401` `UNAUTHORIZED`                                                                                                                 |
| Wrong API key                      | `401` `UNAUTHORIZED`                                                                                                                 |
| Unknown `sessionId`                | `404` `NOT_FOUND`                                                                                                                    |
| Valid session (happy path)         | `200`, `data.runtimeState.sessionId` matches, `canSendMessage` is boolean, `isProcessing` is boolean, `updatedAt` is ISO 8601 string |
| `error` field is `null` on success |                                                                                                                                      |

### Stack-e2e contract

- Use the live stack (real Postgres + Redis) — follow the pattern from existing `*.stack-e2e.test.ts` files
- Do not hard-code specific `runtimeState` values that depend on session state; assert structural shape only
- Session fixture: create a real session via `POST /v1/sessions` in a `beforeAll` or `beforeEach`

---

## Step 2 — Stack-E2E: SSE Endpoint

Create `apps/core/src/api/routes/stream-runtime-events.stack-e2e.test.ts`.

### Required test cases

| Test                                       | Expected                                                 |
| ------------------------------------------ | -------------------------------------------------------- |
| No `x-api-key`                             | `401` `UNAUTHORIZED`                                     |
| Wrong API key                              | `401` `UNAUTHORIZED`                                     |
| Unknown `sessionId`                        | `404` `NOT_FOUND`                                        |
| Valid session, connect and receive headers | `200`, `Content-Type: text/event-stream`                 |
| First frame is keepalive comment           | Response body starts with `': keepalive'` or contains it |

### Notes on SSE testing at stack-e2e level

SSE connections stay open indefinitely. Use a time-bounded read:

- Open a raw HTTP request to the stream endpoint with a short timeout (e.g., 500ms)
- Assert response headers and the initial keepalive frame in the first chunk
- Close the connection after asserting — do not wait for live events
- A `TODO` comment is acceptable for full live event delivery testing (requires real GM run)

Use `node:http` or `node:https` to make a raw GET request if `fetch`/`inject()` does not
support streaming easily. Follow patterns from any existing streaming tests in the codebase.

---

## Step 3 — Hardening Checklist

Review each item and fix any gaps before doc sync:

### Publisher resource safety

- [ ] When a client disconnects from the SSE route, the `unsubscribe()` function is always called
      (verify `request.raw.on('close', ...)` is registered before `reply.hijack()`)
- [ ] `InMemorySessionEventPublisher` `subscribe()` does not leak `Set` entries after unsubscribe
      (unit test the set size post-unsubscribe)
- [ ] `setProcessing(sessionId, false)` is called in the `finally` block even when the GM throws

### Type safety

- [ ] `RuntimeEvent.eventId` is generated with a consistent prefix (e.g., `rev_`) — no empty IDs
- [ ] `RuntimeEvent.occurredAt` is always a valid ISO 8601 string — no `undefined` or `null`
- [ ] `RuntimeState.updatedAt` is always populated — no missing timestamp

### Edge cases

- [ ] `GetRuntimeStateUseCase` returns `canSendMessage: false` when session status is `'closed'`
- [ ] `GetRuntimeStateUseCase` returns `canSendMessage: false` when session has no active conversation
- [ ] SSE route returns `404` (not a streaming error) for unknown sessions, before setting SSE headers
- [ ] `emitRuntimeEvent` private helper silently ignores errors (try/catch + `console.warn`)

---

## Step 4 — Exclude Stack-E2E Files from Default Unit Test Config

Verify that `apps/core/vitest.config.ts` has explicit `exclude` entries for:

```
src/**/*.stack-e2e.test.ts
```

If the two new stack-e2e files are not already excluded, add them. Check `coverage.exclude`
as well.

> This is mandatory — without explicit excludes, the default `src/**/*.test.ts` glob will pick
> up the stack-e2e files and fail when the live stack is not running.

---

## Step 5 — Update `docs/PROJECT_STATUS.md`

Add a new section under the current latest epic entry. Follow the exact same format (h3 heading,
bullet-point list, quality gate confirmation line):

```markdown
### EPIC 4.5 — Player Runtime State & World Events: **complete** (YYYY-MM-DD)

- Added `RuntimeEvent` and `RuntimeState` to `@gami/shared` (`packages/shared/src/runtime-types.ts`)
- Defined `ISessionEventPublisher` port with `emit`, `subscribe`, `getLastEvent`, `isProcessing`, `setProcessing`
- Implemented `InMemorySessionEventPublisher` (in-process session-scoped pub/sub, `Map`-based)
- Implemented `GetRuntimeStateUseCase` — derives `canSendMessage`, `isProcessing`, `pendingEvent` from live session/conversation state
- Added `GET /v1/sessions/{sessionId}/runtime-state` — REST snapshot endpoint returning `ApiResponse<RuntimeState>`
- Added `GET /v1/sessions/{sessionId}/events/stream` — SSE stream endpoint; session-scoped, no cross-session leakage, clean teardown on disconnect
- Wired `RunGameMasterUseCase` to emit `runtime.processing_started`, `runtime.processing_finished`, `runtime.avatar_unlocked`, `runtime.avatar_suggested`, `runtime.choice_required` via publisher; GM remains fully async and non-blocking
- Stack-e2e coverage added for both endpoints (auth, 404, happy path)
- Quality gates confirmed: `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm --filter @gami/core test:coverage` pass
```

---

## Step 6 — Verify `docs/API_CONTRACT.md` Is Up to Date

The API contract already defines §4.1 and §4.2 with the correct shapes. Confirm:

- `RuntimeEvent` type in "Core Types" matches the implementation exactly
- `RuntimeState` type in "Core Types" matches the implementation exactly
- `GET /v1/sessions/{sessionId}/events/stream` SSE format (§4.1) matches the Fastify frame format
- `GET /v1/sessions/{sessionId}/runtime-state` response shape (§4.2) matches `GetRuntimeStateOutput`

If there are any divergences (deliberate or accidental), update the contract and document the reason.

---

## Step 7 — Verify `docs/DATA_MODEL.md` Is Up to Date

`DATA_MODEL.md` §4 "Session" already contains this note:

> **Derived runtime state (EPIC 4.5)**
> `session_runtime_state` is derived at read time from session/conversation status plus async
> world-processing signals. It is **not** a persisted table in Phase A.

Confirm this note remains accurate after implementation. If the note needs clarification (e.g., the
`InMemorySessionEventPublisher` is process-scoped, not DB-backed), update accordingly.

---

## Step 8 — Final Quality Gates

```bash
pnpm --filter @gami/shared typecheck
pnpm --filter @gami/core typecheck
pnpm lint
pnpm test
pnpm --filter @gami/core test:coverage
```

All must pass. Coverage must not regress from the pre-EPIC baseline.

---

## Commit

```
test(epic-4-5): add stack-e2e tests, hardening, and doc sync [EPIC-4.5]
```
