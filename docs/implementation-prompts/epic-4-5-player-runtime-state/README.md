# EPIC 4.5 — Player Runtime State & World Events: Implementation Prompt Pack

## Objective

Let clients know when the world/session state has changed after an async GM run, without polling
or waiting for the next user turn.

Two new endpoints are added:

- `GET /v1/sessions/{sessionId}/events/stream` — SSE stream of runtime events for the session
- `GET /v1/sessions/{sessionId}/runtime-state` — synchronous snapshot of the current runtime state

An in-process session-scoped event publisher wires the async Game Master to both surfaces.

---

## What Is Being Built

| Surface                         | Description                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------------- |
| `RuntimeEvent` shared type      | Canonical event shape: type, payload, sessionId, correlationId                        |
| `RuntimeState` shared type      | Derived state: canSendMessage, isProcessing, pendingEvent, updatedAt                  |
| `ISessionEventPublisher` port   | Abstraction for emitting and subscribing to session-scoped runtime events             |
| `InMemorySessionEventPublisher` | Default in-process implementation using Node `EventEmitter`                           |
| `GetRuntimeStateUseCase`        | Derive runtime state from session/conversation + publisher                            |
| Snapshot route                  | `GET /v1/sessions/{sessionId}/runtime-state` → `ApiResponse<RuntimeState>`            |
| SSE stream route                | `GET /v1/sessions/{sessionId}/events/stream` — live event frames                      |
| GM wiring                       | Emit runtime events from `RunGameMasterUseCase` after unlock/suggest/choice decisions |
| Tests                           | Unit (state derivation), route tests, stack-e2e for both endpoints                    |

---

## Definition of Done

- Client can connect to SSE and receive `runtime.avatar_unlocked`, `runtime.avatar_suggested`,
  `runtime.choice_required`, `runtime.processing_started`, `runtime.processing_finished`, and
  `runtime.session_closed` frames in real time
- Client can retrieve consistent `RuntimeState` snapshot at any time via REST
- `isProcessing` reflects true only while the async GM is executing for a session
- `pendingEvent` carries the most recent unacknowledged runtime event when present
- GM remains fully async and non-blocking; event emission is fire-and-forget
- No WebSocket dependency — SSE (`text/event-stream`) only
- No event-sourcing redesign — lightweight in-process publisher only
- No cross-session event leakage (publisher is session-scoped)
- Every new HTTP endpoint has an `*.stack-e2e.test.ts` covering auth (401), 404, and happy path
- SSE connection is cleanly torn down when client disconnects (no orphaned listeners)
- `pnpm lint`, `pnpm typecheck`, `pnpm test` pass at the end of each prompt

---

## Execution Order

| #   | Prompt file                      | What it delivers                                           |
| --- | -------------------------------- | ---------------------------------------------------------- |
| 1   | `01-runtime-event-types.md`      | Shared types + publisher port + in-memory implementation   |
| 2   | `02-runtime-state-snapshot.md`   | GetRuntimeStateUseCase + REST snapshot route + route tests |
| 3   | `03-sse-event-stream.md`         | SSE stream route + Fastify SSE pattern + teardown contract |
| 4   | `04-gm-event-publication.md`     | Wire GM to emit runtime events via publisher               |
| 5   | `05-tests-hardening-doc-sync.md` | Stack-e2e, unit hardening, doc sync                        |

Execute in order. Do not skip ahead. Each prompt builds on the previous.

---

## Key Constraints (Non-Negotiable)

- **No WebSocket** — SSE only in Phase A
- **No event-store / event-sourcing redesign** — publisher is a lightweight in-process abstraction
- **GM stays non-blocking** — all event emission is `void` fire-and-forget inside `RunGameMasterUseCase`
- **Session-scoped pub/sub** — a subscriber for session A never receives events for session B
- **`ApiResponse<T>` envelope** for the snapshot endpoint; raw SSE frames for the stream endpoint
- **TypeScript strict mode** — no `any`, no implicit types
- **LLM provider SDKs** are never imported in domain or application layers

---

## Architecture Placement

```
api/routes/sessions.ts              ← Two new route registrations
application/
  use-cases/
    get-runtime-state/              ← New use case
  ports/
    ISessionEventPublisher.ts       ← New port
infrastructure/
  events/
    in-memory-session-event-publisher.ts   ← New in-process implementation
domain/
  (no new domain logic — RuntimeEvent/RuntimeState are shared types, not domain entities)
packages/shared/src/
  runtime-types.ts                  ← RuntimeEvent, RuntimeState (new file)
  index.ts                          ← Export new types
```

---

## Source-of-Truth References

| Topic                             | Document                                  |
| --------------------------------- | ----------------------------------------- |
| API endpoint shapes & semantics   | `docs/API_CONTRACT.md` §4.1 and §4.2      |
| RuntimeEvent / RuntimeState types | `docs/API_CONTRACT.md` Core Types section |
| Architecture layers               | `docs/ARCHITECTURE.md`                    |
| GM event emission capability      | `docs/GAME_MASTER_CONTRACT.md` §5 notes   |
| Session domain fields             | `docs/DATA_MODEL.md` §4 Session           |
| Testing strategy                  | `docs/TEST_STRATEGY.md`                   |
| Test coverage requirements        | `docs/TEST_COVERAGE_PLAN.md`              |
