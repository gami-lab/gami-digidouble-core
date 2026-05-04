# Prompt 01 — Runtime Event Types, Publisher Port, and In-Memory Implementation

## Objective

Introduce the canonical `RuntimeEvent` and `RuntimeState` shared types, define the
`ISessionEventPublisher` application port, and deliver the default in-process implementation
(`InMemorySessionEventPublisher`).

No routes, no use cases, no GM wiring in this step.

---

## Prerequisite Reading

Read these before writing any code:

- `docs/API_CONTRACT.md` — "Runtime Event" and "Runtime State" sections under **Core Types**
- `docs/ARCHITECTURE.md` — Layer rules (port belongs in `application/ports/`, infrastructure in `infrastructure/`)
- `packages/shared/src/index.ts` — understand the current export surface before adding to it

---

## Step 1 — Add `runtime-types.ts` to `@gami/shared`

Create `packages/shared/src/runtime-types.ts`.

The file must export exactly two types:

### `RuntimeEvent`

```ts
export type RuntimeEvent = {
  eventId: string
  sessionId: string
  conversationId?: string
  type:
    | 'runtime.processing_started'
    | 'runtime.processing_finished'
    | 'runtime.avatar_unlocked'
    | 'runtime.avatar_suggested'
    | 'runtime.choice_required'
    | 'runtime.session_closed'
  occurredAt: string // ISO 8601 UTC
  correlationId?: string
  payload: Record<string, unknown>
}
```

### `RuntimeState`

```ts
export type RuntimeState = {
  sessionId: string
  conversationId?: string
  canSendMessage: boolean
  isProcessing: boolean
  pendingEvent?: RuntimeEvent
  updatedAt: string // ISO 8601 UTC
}
```

No additional types, no helpers.

---

## Step 2 — Export from `@gami/shared`

Add to `packages/shared/src/index.ts`:

```ts
export type { RuntimeEvent, RuntimeState } from './runtime-types.js'
```

---

## Step 3 — Define `ISessionEventPublisher` port

Create `apps/core/src/application/ports/ISessionEventPublisher.ts`.

```ts
import type { RuntimeEvent } from '@gami/shared'

export type SessionEventHandler = (event: RuntimeEvent) => void

export interface ISessionEventPublisher {
  /**
   * Emit a runtime event for a session.
   * All subscribers for that session receive the event synchronously in-process.
   */
  emit(event: RuntimeEvent): void

  /**
   * Subscribe to all runtime events for a given session.
   * Returns an unsubscribe function. The caller MUST call it when done (e.g. on SSE disconnect).
   */
  subscribe(sessionId: string, handler: SessionEventHandler): () => void

  /**
   * Retrieve the most recent event emitted for a session, if any.
   * Used to populate `pendingEvent` in runtime state snapshots.
   */
  getLastEvent(sessionId: string): RuntimeEvent | undefined
}
```

Strict rules:

- No concrete implementation in this file
- No coupling to Node.js `EventEmitter` or any infrastructure detail
- The interface must import from `@gami/shared` only (no circular deps)

---

## Step 4 — Implement `InMemorySessionEventPublisher`

Create `apps/core/src/infrastructure/events/in-memory-session-event-publisher.ts`.

The implementation uses a `Map<string, Set<SessionEventHandler>>` for subscribers per session
and a `Map<string, RuntimeEvent>` to track the last event per session.

```ts
import { EventEmitter } from 'node:events'
import type { RuntimeEvent } from '@gami/shared'
import type {
  ISessionEventPublisher,
  SessionEventHandler,
} from '../../application/ports/ISessionEventPublisher.js'

export class InMemorySessionEventPublisher implements ISessionEventPublisher {
  private readonly subscribers = new Map<string, Set<SessionEventHandler>>()
  private readonly lastEvents = new Map<string, RuntimeEvent>()

  emit(event: RuntimeEvent): void {
    this.lastEvents.set(event.sessionId, event)
    const handlers = this.subscribers.get(event.sessionId)
    if (handlers === undefined) return
    for (const handler of handlers) {
      handler(event)
    }
  }

  subscribe(sessionId: string, handler: SessionEventHandler): () => void {
    if (!this.subscribers.has(sessionId)) {
      this.subscribers.set(sessionId, new Set())
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    this.subscribers.get(sessionId)!.add(handler)
    return () => {
      this.subscribers.get(sessionId)?.delete(handler)
    }
  }

  getLastEvent(sessionId: string): RuntimeEvent | undefined {
    return this.lastEvents.get(sessionId)
  }
}
```

Implementation constraints:

- Handlers for session A **must never** be called with events for session B
- No `EventEmitter` max-listener warnings — use plain `Map<string, Set<handler>>`
- Do not import Node's `EventEmitter` unless genuinely necessary (the above approach does not need it — remove the import if unused)
- The class must be a singleton when used in production (injected, not instantiated per request)

---

## Step 5 — Unit Tests

Create `apps/core/src/infrastructure/events/in-memory-session-event-publisher.test.ts`.

Required test cases:

| Test                                                        | Description                                                            |
| ----------------------------------------------------------- | ---------------------------------------------------------------------- |
| emit with no subscribers                                    | no error, getLastEvent returns the event                               |
| subscribe and receive event                                 | handler called with correct event                                      |
| unsubscribe stops delivery                                  | after unsub(), handler is not called                                   |
| session isolation                                           | subscribing to session A does not receive events emitted for session B |
| multiple subscribers same session                           | all handlers called for one emit                                       |
| getLastEvent returns undefined for unknown session          |                                                                        |
| getLastEvent returns most recent event after multiple emits |                                                                        |

All tests must be deterministic (no timers, no LLM, no network).

---

## Step 6 — Expose from Infrastructure Index (if applicable)

If `apps/core/src/infrastructure/db/index.ts` or equivalent barrel exists, add a re-export.
If not, skip — explicit imports are preferred.

---

## Step 7 — Quality Gates

Run before committing:

```bash
pnpm --filter @gami/shared typecheck
pnpm --filter @gami/core typecheck
pnpm --filter @gami/core test
pnpm lint
```

All must pass with zero errors.

---

## Commit

```
feat(epic-4-5): add RuntimeEvent/RuntimeState shared types and ISessionEventPublisher port [EPIC-4.5]
```
