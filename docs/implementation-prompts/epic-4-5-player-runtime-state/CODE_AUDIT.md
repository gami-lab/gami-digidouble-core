# Code Audit — EPIC 4.5: Player Runtime State & World Events

**Audited on:** 2026-05-05  
**Auditor:** Senior Staff Engineer / Architecture Reviewer  
**EPIC README:** `docs/implementation-prompts/epic-4-5-player-runtime-state/README.md`

---

## Quality Gate Results

| Gate              | Result  | Notes                                          |
| ----------------- | ------- | ---------------------------------------------- |
| `pnpm lint`       | ✅ PASS  | No ESLint violations in `@gami/core`           |
| `pnpm typecheck`  | ✅ PASS  | No TypeScript errors in `@gami/core`           |
| `pnpm test`       | ✅ PASS  | 390 tests · 67 test files                      |
| `pnpm test:coverage` | ✅ PASS  | Statements 90.28% · Branches 86.71% · Functions 97.05% · Lines 90.28% (all ≥ 80%) |

---

## Overall Grade: **B**

Solid implementation with clean architecture, passing quality gates, and well-organised tests for the main behaviors. Awarded **B** rather than A due to one functional completeness gap (a promised event type is never emitted), one in-process memory leak, and a route file approaching the ESLint line limit.

**No A** was awarded because the DoD explicitly requires that clients can receive `runtime.session_closed` frames, and no code path emits that event.

---

## 1. Functional Completeness

### What was delivered

| Feature | Status | Notes |
|---------|--------|-------|
| `RuntimeEvent` / `RuntimeState` in `@gami/shared` | ✅ Complete | `packages/shared/src/runtime-types.ts`, exported from `index.ts` |
| `ISessionEventPublisher` port | ✅ Complete | `application/ports/ISessionEventPublisher.ts` — all five methods present |
| `InMemorySessionEventPublisher` | ✅ Complete | `infrastructure/events/in-memory-session-event-publisher.ts` |
| `GetRuntimeStateUseCase` | ✅ Complete | Derives `canSendMessage`, `isProcessing`, `pendingEvent` correctly |
| `GET /v1/sessions/{sessionId}/runtime-state` | ✅ Complete | Returns `ApiResponse<RuntimeState>` as contracted |
| `GET /v1/sessions/{sessionId}/events/stream` | ✅ Complete | SSE with session isolation, keepalive frame, teardown on disconnect |
| GM emits `runtime.processing_started` | ✅ Complete | Set before work starts in `execute()` |
| GM emits `runtime.processing_finished` | ✅ Complete | Emitted in `finally` block — fires on both success and error paths |
| GM emits `runtime.avatar_unlocked` | ✅ Complete | Emitted when `unlockedAvatarIds.length > 0` |
| GM emits `runtime.avatar_suggested` | ✅ Complete | Emitted when `output.suggestedAvatarId !== undefined` |
| GM emits `runtime.choice_required` | ✅ Complete | Emitted when `recommendedChoices.length > 0` |
| **GM emits `runtime.session_closed`** | ❌ **Not implemented** | The type is defined in `RuntimeEvent.type` and listed in the DoD, but no code path emits it. The `EndConversationUseCase` does not accept or use the event publisher, and no other path emits this event. |
| Stack-e2e for both endpoints | ✅ Complete | Auth (401 ×2), 404, and happy-path covered per DoD |
| SSE teardown on client disconnect | ✅ Complete | `request.raw.on('close', unsubscribe)` |
| No cross-session leakage | ✅ Complete | Publisher is keyed by `sessionId` |
| GM non-blocking | ✅ Complete | `setProcessing` is fire-and-forget; event emission wrapped in try/catch |

### DoD gap: `runtime.session_closed`

The DoD states:

> Client can connect to SSE and receive `runtime.session_closed` frames in real time

`RuntimeEvent.type` includes `'runtime.session_closed'` in both `@gami/shared` and `docs/API_CONTRACT.md`. However:

- `EndConversationUseCase` (the natural emission site) has no reference to `ISessionEventPublisher`.
- `RunGameMasterUseCase` does not emit it.
- No other path emits it.

Clients connected to the SSE stream will never receive this frame. Any code that branches on this event type is dead code.

---

## 2. Architecture Quality

✅ All four layers respected:

- **API layer** — Two new route handlers (`registerGetRuntimeStateRoute`, `registerStreamRuntimeEventsRoute`) live inside `api/routes/sessions.ts`. No business logic in handlers; both delegate to use case or port immediately.
- **Application layer** — `GetRuntimeStateUseCase` in `application/use-cases/get-runtime-state/`. `ISessionEventPublisher` port in `application/ports/`. Correct placement.
- **Domain layer** — No new domain entities introduced (correct per EPIC spec: `RuntimeEvent`/`RuntimeState` are shared types, not domain entities).
- **Infrastructure layer** — `InMemorySessionEventPublisher` in `infrastructure/events/`. Correct placement.

✅ No vendor SDK imports in domain or application layers.

✅ The publisher is optional in `RunGameMasterUseCase` — existing behavior is preserved when the publisher is not injected. Optional chaining (`?.`) is used throughout.

✅ `InMemorySessionEventPublisher` is wired as a singleton at the `createServer` level and shared between `sessionsRoute` (SSE + snapshot) and `RunGameMasterUseCase`. The single instance ensures events emitted from the GM reach the correct SSE subscribers.

⚠️ **`sessions.ts` breadth** — at 493 lines, the file hosts session CRUD, conversation management, end-conversation, avatar switching, runtime state, and the SSE stream. It is 7 lines below the ESLint 500-line limit. The next meaningful addition will require extraction. The EPIC architecture plan (see README `## Architecture Placement`) placed the SSE route under `api/routes/sessions.ts`, so co-location was intentional, but the file has absorbed every session-scoped route over multiple EPICs. **Risk:** approaching the limit with one more route.

⚠️ **Exported route-function leakage** — `registerGetRuntimeStateRoute` and `registerStreamRuntimeEventsRoute` are exported from `sessions.ts`. This bypasses the private-by-convention module boundary and exists to allow direct unit testing of the individual route functions. The test file `get-runtime-state.test.ts` does not use these exports (it uses `createServer`), so the exports are actually unused and serve only as a style inconsistency. `stream-runtime-events.test.ts` similarly uses `createServer`. The exports should be removed or the files restructured.

---

## 3. Code Quality

### Strengths

- `InMemorySessionEventPublisher` is small (57 lines), single-purpose, and uses standard JavaScript `Map`/`Set` primitives — nothing exotic.
- `emitRuntimeEvent` in `RunGameMasterUseCase` is correctly wrapped in try/catch so a publisher failure cannot propagate to the GM flow.
- `processing_finished` is emitted in the `finally` block of `execute()`, ensuring it fires even when the GM throws. The `success` flag in the payload correctly reflects the error path.
- `correlationId` from the incoming request flows through all emitted events, enabling end-to-end trace linkage.
- `GetRuntimeStateUseCase` uses explicit spread conditionals (`...(x !== undefined ? { key: x } : {})`) rather than `undefined` field assignments — avoiding JSON serialisation ambiguity.

### Issues

**Memory leak — `lastEvents` Map grows indefinitely.**

`InMemorySessionEventPublisher.lastEvents` is a `Map<string, RuntimeEvent>`. An entry is created for every session that emits at least one event and is never removed. Over the server lifetime with many sessions, this is a bounded-but-unbounded leak: one entry per completed session, retained forever. For Phase A with modest session volume the impact is negligible, but it is structurally incorrect for a long-lived process.

The mitigation is to call `lastEvents.delete(sessionId)` when the subscriber set empties (i.e., when the last SSE client disconnects for that session). The `unsubscribe` lambda already has the right location:

```ts
return () => {
  handlersForSession?.delete(handler)
  if (handlersForSession !== undefined && handlersForSession.size === 0) {
    this.subscribers.delete(sessionId)
    // Add: this.lastEvents.delete(sessionId) — or keep it per policy
  }
}
```

Note: there is a deliberate design question here. `getLastEvent` is called by `GetRuntimeStateUseCase` to populate `pendingEvent`. If a client polls the snapshot endpoint after the SSE client has disconnected, the last event would be gone. Whether that's acceptable is a product decision, but the current behaviour of indefinite retention should be an explicit choice, not an oversight.

**SSE periodic keepalive is missing (tracked TODO).**

The route sends a single comment frame (`: keepalive\n\n`) on connect and then is silent. Without periodic keepalive frames, reverse proxies (nginx, AWS ALB, Cloudflare) will terminate idle connections after their read-timeout threshold (typically 60–120 s). A `setInterval` emitting `: keepalive\n\n` every 15–30 s is needed for proxy-compatible SSE. A `// TODO(epic-4-5)` comment acknowledges this but it must not persist to production.

**`sessions.ts` near the 500-line ESLint limit.**

Verified: `wc -l apps/core/src/api/routes/sessions.ts` → 493 lines. The ESLint rule `max-lines: 500` will fail on the next meaningful addition. Extraction of the runtime-state and SSE route registrations into a dedicated `runtime-events.ts` sibling file is the natural next step.

---

## 4. Test Quality

### Publisher tests (`in-memory-session-event-publisher.test.ts`) — 11 tests

✅ **Behavioral — strong coverage.**

| Behavior | Tested |
|----------|--------|
| Emit with no subscribers stores event | ✅ |
| Subscribe and receive event | ✅ |
| Unsubscribe stops delivery | ✅ |
| Unsubscribe removes empty set (leak guard) | ✅ |
| Session isolation | ✅ |
| Multiple subscribers same session | ✅ |
| `getLastEvent` returns undefined for unknown session | ✅ |
| `getLastEvent` returns most recent after multiple emits | ✅ |
| `isProcessing` returns true only after `setProcessing(true)` | ✅ |
| `setProcessing(false)` clears state | ✅ |
| Processing state isolated per session | ✅ |

One test accesses private internals (`(publisher as unknown as { subscribers: ... }).subscribers`) to verify cleanup. This is acceptable here given no public inspection API exists and the leak guard is operationally important — but it is the only test in the suite that inspects internal state.

### `GetRuntimeStateUseCase` tests — 9 tests across 2 describe groups

✅ **Behavioral — well structured.**

| Behavior | Tested |
|----------|--------|
| NOT_FOUND when session missing | ✅ |
| `canSendMessage=true` for active session + active conversation | ✅ |
| `canSendMessage=false` for active session + no active conversation | ✅ |
| `canSendMessage=false` for closed session | ✅ |
| `isProcessing=true` from publisher | ✅ |
| `isProcessing=false` from publisher | ✅ |
| `pendingEvent` present when publisher has last event | ✅ |
| `pendingEvent` absent when publisher returns undefined | ✅ |
| `conversationId` present when active conversation exists | ✅ |
| `conversationId` absent when no active conversation | ✅ |

**Gap:** There is no test for the `session.activeAvatarId === undefined` branch (line 22 in `get-runtime-state.use-case.ts`). When `session.activeAvatarId` is `undefined`, the use case skips `findActiveBySessionId` and sets `activeConversation = null` directly. The existing `canSendMessage=false` test (line 79) exercises `findActiveBySessionId` returning `null` but still calls the repository. The branch where the repository is never called is untested. This is a distinct and consumer-relevant behavior: a newly-started session with no active avatar has `canSendMessage=false` via the `activeAvatarId === undefined` path, not via the repository returning null. A consumer building UI state around this contract needs this branch to be proven.

### Route tests (`get-runtime-state.test.ts`) — 5 tests

✅ Auth (401 missing, 401 wrong), 404, happy path `canSendMessage`, `isProcessing=true`.

**Gap:** Route-level contract tests do not assert `conversationId` or `pendingEvent` in the HTTP response envelope. Use-case tests cover these, but the route test's job is to prove the HTTP contract shape — that the field names are present in the JSON and have the correct types when present. A consumer relying on `conversationId` in the response will find no route-level assertion if the serialiser drops the field.

### Route tests (`stream-runtime-events.test.ts`) — 4 tests

✅ Auth (401 ×2), 404, SSE headers + keepalive frame.

**Gap:** No test proves that an event emitted *after* SSE connection is written to the stream. The route test only verifies the initial keepalive. This means the core subscriber → write → client chain is not proven at the route level. The `InMemorySessionEventPublisher` unit tests prove the subscriber mechanism; the gap is the route writing to `reply.raw` on event receipt. A test that subscribes a publisher, emits an event, and reads the next chunk would close this.

**Gap:** No test for the teardown contract at the route level. `request.raw.on('close', unsubscribe)` is the teardown mechanism, but no test triggers a close and verifies the subscriber is removed. This gap means a future refactor of the teardown path (e.g., using `reply.raw.once('finish', ...)` instead) could silently regress without a test failure.

### `RunGameMasterUseCase` runtime event tests — 8 tests across 3 describe groups

✅ **Behavioral — well targeted.**

| Behavior | Tested |
|----------|--------|
| Runs without publisher (optional dependency) | ✅ |
| `processing_started` and `processing_finished` emitted + `setProcessing` toggled | ✅ |
| `processing_finished` emitted on error path with `success: false` | ✅ |
| `avatar_unlocked` emitted with correct payload | ✅ |
| No `avatar_unlocked` emitted when no unlocks | ✅ |
| `avatar_suggested` emitted with payload | ✅ |
| `choice_required` emitted with payload | ✅ |

**Gap:** No test for `runtime.session_closed` — see §1 functional gap.

**Gap:** No negative test for `avatar_suggested` absent (when `suggestedAvatarId === undefined`). Symmetric with the "no unlock" test. Minor.

### Stack-e2e tests

✅ Both `get-runtime-state.stack-e2e.test.ts` and `stream-runtime-events.stack-e2e.test.ts` cover auth (401 ×2), 404, and happy path.

✅ `get-runtime-state.stack-e2e.test.ts` validates the response envelope shape and timestamp parseability — this is a genuine consumer-contract assertion.

⚠️ `stream-runtime-events.stack-e2e.test.ts` has a documented TODO: no end-to-end assertion that an actual event frame is received after a GM run. The happy-path test only validates the keepalive frame. This limits the value of the stack-e2e tier for this feature.

---

## 5. Operational Quality

✅ `isProcessing` provides real-time visibility into in-flight GM state — useful for operations tooling.

✅ `processing_finished.payload.success` distinguishes clean vs. error completion — useful for alerting.

✅ `correlationId` threads through all emitted events, enabling trace reconstruction across GM run, event log, SSE stream, and observability backend.

✅ `runtime.avatar_unlocked`, `runtime.avatar_suggested`, `runtime.choice_required` payloads are lean and intentional — no raw prompt content or session secrets.

⚠️ **No structured log on SSE connect/disconnect.** Production debugging of proxy connection issues (e.g., "why did this client stop receiving events?") will be difficult without log entries at connection open and close. A `request.log.info({ sessionId }, 'sse.connected')` / `request.log.info({ sessionId }, 'sse.disconnected')` pair would provide minimal observability.

⚠️ **No active subscriber count metric.** There is no way to know at runtime how many SSE clients are currently subscribed across all sessions. Adding a simple gauge metric for subscriber count would be valuable for capacity planning and anomaly detection.

⚠️ **Periodic keepalive absent** (see §3). Without it, connections through reverse proxies will time out silently. Clients will see an unexpected stream end with no error frame.

---

## 6. Documentation Alignment

| Document | Status |
|----------|--------|
| `docs/PROJECT_STATUS.md` | ✅ Updated — EPIC 4.5 marked complete 2026-05-05 with accurate feature list |
| `docs/API_CONTRACT.md` §4.1 (SSE stream) | ✅ Correct — SSE format, semantics, error mapping all aligned |
| `docs/API_CONTRACT.md` §4.2 (runtime state) | ✅ Correct — endpoint, response shape, semantics all aligned |
| `docs/API_CONTRACT.md` Core Types — `RuntimeEvent` | ✅ Type definition matches `@gami/shared` exactly |
| `docs/API_CONTRACT.md` Core Types — `RuntimeState` | ✅ Type definition matches `@gami/shared` exactly |
| `docs/ARCHITECTURE.md` | ✅ SSE entry points referenced in layer description |

**Gap:** The `runtime.session_closed` event is documented in `API_CONTRACT.md` `RuntimeEvent.type` union and in the DoD but is not implemented. Either the implementation must be completed or the type and contract must be reduced to reflect Phase A reality.

---

## 7. Structural Maintainability

| Dimension | Assessment |
|-----------|------------|
| Type ownership | ✅ `RuntimeEvent` and `RuntimeState` live exclusively in `@gami/shared`. Zero duplication across layers. |
| Adding a new event type | 3 edits: `runtime-types.ts`, emission site, test. Below the 4-edit threshold. |
| Replacing the publisher | ✅ `ISessionEventPublisher` port means swapping `InMemorySessionEventPublisher` for a Redis-backed implementation requires no changes to use cases or routes. |
| `pendingEvent` extensibility | ✅ Uses the `RuntimeEvent` type directly — no separate DTO. Adding fields to `RuntimeEvent` automatically flows into `pendingEvent`. |
| `sessions.ts` maintainability | ⚠️ At 493/500 lines. Next meaningful route addition triggers an ESLint violation. The SSE + snapshot routes should be extracted before the next feature touches this file. |
| Publisher memory behaviour | ⚠️ `lastEvents` grows per session and is never evicted. Acceptable for Phase A but must be addressed before sustained production load. |
| `session_closed` contract drift | ⚠️ The type union promises `session_closed` but no code emits it. This creates a latent contract violation: API clients may code against it today (it is in the documented type) and receive no events. |

---

## Summary of Findings

### Critical (must fix before considering the EPIC fully closed)

1. **`runtime.session_closed` never emitted.**  
   The event type is in the contract, in the DoD, and in the shared type union, but `EndConversationUseCase` has no access to `ISessionEventPublisher` and emits nothing to the SSE stream when a conversation or session closes. Any client branching on this event type will never receive it. Either emit the event from `EndConversationUseCase` (inject the publisher as optional) or remove `'runtime.session_closed'` from the type union and the contract docs until it is implemented.

### High (should fix before next EPIC)

2. **`InMemorySessionEventPublisher.lastEvents` grows indefinitely.**  
   Each session that emits an event creates a permanent entry in the `lastEvents` Map. There is no eviction mechanism. For long-running servers with many sessions this is a memory leak. The fix is to clear the entry when the last subscriber disconnects (unsubscribes) or on a configurable TTL.

3. **No periodic SSE keepalive.**  
   Proxy-terminated silent disconnects will degrade user experience silently. The `// TODO(epic-4-5)` must become an implementation task for the next EPIC boundary.

### Medium (quality improvements)

4. **Missing unit test: `canSendMessage` via `activeAvatarId === undefined` branch.**  
   The `session.activeAvatarId === undefined` path in `GetRuntimeStateUseCase.execute()` bypasses `findActiveBySessionId` entirely. This distinct behavior is not proven in tests.

5. **Missing route-level test: event frame delivery over SSE.**  
   No test proves that after a publisher emits an event, the route handler writes it to the stream. The mechanism is correct by inspection but the behavior is not regression-protected.

6. **Missing route-level test: SSE teardown on client disconnect.**  
   No test triggers `request.raw.close` and verifies the subscriber is removed. A future refactor of the teardown hook would not be caught.

7. **`sessions.ts` at 493 lines.**  
   Extract `registerGetRuntimeStateRoute` and `registerStreamRuntimeEventsRoute` into a `runtime-events.ts` sibling file. This both avoids the ESLint limit and improves single-responsibility for `sessions.ts`.

8. **`registerGetRuntimeStateRoute` and `registerStreamRuntimeEventsRoute` exported unnecessarily.**  
   These are exported from `sessions.ts` but the route tests use `createServer`, not the exported functions directly. The exports are unused by tests and break the private-by-convention route module pattern.

### Low (minor polish)

9. **No structured log at SSE connect/disconnect.**  
   One `log.info` line at each connection lifecycle event would aid production debugging significantly.

10. **Stack-e2e for SSE has no live event frame assertion.**  
    The `// TODO(epic-4-5)` in `stream-runtime-events.stack-e2e.test.ts` should be converted to an actual test triggering a GM run and reading the resulting event frame before a future release gate.
