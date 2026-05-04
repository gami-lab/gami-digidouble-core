# Prompt 02 — Runtime State Snapshot: Use Case + REST Endpoint

## Objective

Implement `GetRuntimeStateUseCase` and the `GET /v1/sessions/{sessionId}/runtime-state` endpoint.

The use case derives `RuntimeState` from live session/conversation data plus the in-process
`ISessionEventPublisher`. No new DB table. Derivation is pure logic from existing data.

---

## Prerequisite Reading

- `docs/API_CONTRACT.md` §4.2 "Get Session Runtime State"
- `docs/API_CONTRACT.md` "Runtime State" and "Runtime Event" under Core Types
- `docs/TEST_STRATEGY.md` — unit test rules
- `apps/core/src/application/use-cases/get-session/get-session.use-case.ts` — reference pattern for a simple read use case
- `apps/core/src/api/routes/sessions.ts` — existing session route structure (how options are typed, how errors are mapped)

After reading, verify:

- `packages/shared/src/index.ts` exports `RuntimeEvent` and `RuntimeState` (from Prompt 01)
- `apps/core/src/application/ports/ISessionEventPublisher.ts` exists (from Prompt 01)

---

## Step 1 — Create Use Case Types File

Create `apps/core/src/application/use-cases/get-runtime-state/get-runtime-state.types.ts`.

```ts
import type { RuntimeState } from '@gami/shared'

export type GetRuntimeStateInput = {
  sessionId: string
}

export type GetRuntimeStateOutput = {
  runtimeState: RuntimeState
}
```

---

## Step 2 — Implement `GetRuntimeStateUseCase`

Create `apps/core/src/application/use-cases/get-runtime-state/get-runtime-state.use-case.ts`.

### Dependencies

```ts
import type { ISessionRepository } from '../../ports/ISessionRepository.js'
import type { IConversationRepository } from '../../ports/IConversationRepository.js'
import type { ISessionEventPublisher } from '../../ports/ISessionEventPublisher.js'
import type { GetRuntimeStateInput, GetRuntimeStateOutput } from './get-runtime-state.types.js'
import { DomainError } from '../../../domain/errors.js'
```

### Constructor

```ts
constructor(
  private readonly sessionRepository: ISessionRepository,
  private readonly conversationRepository: IConversationRepository,
  private readonly eventPublisher: ISessionEventPublisher,
) {}
```

### Derivation Logic

```ts
async execute(input: GetRuntimeStateInput): Promise<GetRuntimeStateOutput> {
  const session = await this.sessionRepository.findById(input.sessionId)
  if (session === null) {
    throw new DomainError('NOT_FOUND', `Session '${input.sessionId}' not found`)
  }

  const activeConversation = session.activeAvatarId !== null && session.activeAvatarId !== undefined
    ? await this.conversationRepository.findActiveBySessionId(input.sessionId)
    : null

  const canSendMessage =
    session.status === 'active' &&
    activeConversation !== null &&
    activeConversation.status === 'active'

  const isProcessing = this.eventPublisher.isProcessing(input.sessionId)

  const pendingEvent = this.eventPublisher.getLastEvent(input.sessionId)

  const runtimeState: RuntimeState = {
    sessionId: session.sessionId,
    conversationId: activeConversation?.conversationId,
    canSendMessage,
    isProcessing,
    ...(pendingEvent !== undefined ? { pendingEvent } : {}),
    updatedAt: new Date().toISOString(),
  }

  return { runtimeState }
}
```

> **Note on `isProcessing`:** The `ISessionEventPublisher` interface must be extended in this step
> to add `isProcessing(sessionId: string): boolean`. See Step 2b below.

### Step 2b — Extend `ISessionEventPublisher`

Add `isProcessing` to the port interface defined in Prompt 01:

```ts
/**
 * Returns true when a background GM run is currently executing for this session.
 * Set to true at processing_started, cleared at processing_finished or on error.
 */
isProcessing(sessionId: string): boolean
```

Also add `setProcessing(sessionId: string, value: boolean): void` to allow GM wiring in Prompt 04.

Update `InMemorySessionEventPublisher` to implement both methods using a `Set<string>` for active
processing sessions:

```ts
private readonly processing = new Set<string>()

isProcessing(sessionId: string): boolean {
  return this.processing.has(sessionId)
}

setProcessing(sessionId: string, value: boolean): void {
  if (value) {
    this.processing.add(sessionId)
  } else {
    this.processing.delete(sessionId)
  }
}
```

Update existing unit tests from Prompt 01 to cover `isProcessing` and `setProcessing`.

---

## Step 3 — Register the Route in `sessions.ts`

The snapshot endpoint lives in `apps/core/src/api/routes/sessions.ts` alongside the other session
routes. Follow the exact same options pattern already in that file.

### Route options extension

Add to `SessionsRouteOptions`:

```ts
sessionEventPublisher?: ISessionEventPublisher
```

Import `ISessionEventPublisher` at the top of the file.

### Default injection

In the sessions route plugin body, fall through to `new InMemorySessionEventPublisher()` when
no publisher is injected. Import `InMemorySessionEventPublisher`.

### Route registration function

Add a new exported function `registerGetRuntimeStateRoute` that registers:

```
GET /:sessionId/runtime-state
```

Pattern to follow: look at `registerGetAvailableAvatarsRoute` or similar read-only GET routes
in the same file.

Authentication: `preHandler: authenticateApiKey(options.config.apiKeySecret)`.

Handler logic:

1. Instantiate `GetRuntimeStateUseCase` with the injected/fallback repos and publisher
2. Call `execute({ sessionId: params.sessionId })`
3. Catch `DomainError`:
   - `NOT_FOUND` → 404 with `fail('NOT_FOUND', message)`
   - all others → 500 with `fail('INTERNAL_ERROR', ...)`
4. Return `ok({ runtimeState })` with status 200

No request body validation needed (GET with path param only).

### Call `registerGetRuntimeStateRoute` inside the plugin

Alongside the other `register*Route` calls at the bottom of the plugin.

---

## Step 4 — Wire `InMemorySessionEventPublisher` into `ServerAdapters`

In `apps/core/src/api/server.ts`:

1. Add `sessionEventPublisher?: ISessionEventPublisher` to `ServerAdapters`
2. Add fallback: `sessionEventPublisher: adapters.sessionEventPublisher ?? new InMemorySessionEventPublisher()`
3. Pass `sessionEventPublisher: resolvedAdapters.sessionEventPublisher` in the `sessionsRoute` registration

---

## Step 5 — Unit Tests for `GetRuntimeStateUseCase`

Create `apps/core/src/application/use-cases/get-runtime-state/get-runtime-state.use-case.test.ts`.

Required test cases (all deterministic, no LLM):

| Test                                    | Setup                                      | Expected result                            |
| --------------------------------------- | ------------------------------------------ | ------------------------------------------ |
| session not found                       | `findById` returns null                    | throws `DomainError` with code `NOT_FOUND` |
| active session with active conversation | status=active, conversation status=active  | `canSendMessage=true`                      |
| active session, no active conversation  | `findActiveBySessionId` returns null       | `canSendMessage=false`                     |
| closed session                          | status=closed                              | `canSendMessage=false`                     |
| isProcessing true                       | `eventPublisher.isProcessing` returns true | `runtimeState.isProcessing=true`           |
| isProcessing false                      | publisher returns false                    | `runtimeState.isProcessing=false`          |
| pendingEvent present                    | `getLastEvent` returns a RuntimeEvent      | `runtimeState.pendingEvent` matches        |
| no pendingEvent                         | `getLastEvent` returns undefined           | `pendingEvent` key absent from output      |
| conversationId in output                | active conversation present                | `conversationId` matches                   |
| no conversationId when none active      |                                            | `conversationId` undefined                 |

Use minimal in-memory stubs for repos (not the full `InMemorySessionRepository`). Do not use
the real `InMemorySessionEventPublisher` — use a typed stub to isolate the use case.

---

## Step 6 — Route Tests

Create `apps/core/src/api/routes/get-runtime-state.test.ts`.

Required test cases using `app.inject()`:

| Test                                                  | Expected                                                                                                            |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| No `x-api-key` header                                 | 401 `UNAUTHORIZED`                                                                                                  |
| Wrong API key                                         | 401 `UNAUTHORIZED`                                                                                                  |
| Unknown `sessionId`                                   | 404 `NOT_FOUND`                                                                                                     |
| Valid session, happy path                             | 200, body matches `{ data: { runtimeState: { sessionId, canSendMessage, isProcessing, updatedAt } }, error: null }` |
| Valid session, isProcessing true (via publisher stub) | 200, `runtimeState.isProcessing === true`                                                                           |

---

## Step 7 — Quality Gates

```bash
pnpm --filter @gami/core typecheck
pnpm --filter @gami/core test
pnpm lint
```

All must pass with zero errors.

---

## Commit

```
feat(epic-4-5): implement GetRuntimeStateUseCase and runtime-state snapshot endpoint [EPIC-4.5]
```
