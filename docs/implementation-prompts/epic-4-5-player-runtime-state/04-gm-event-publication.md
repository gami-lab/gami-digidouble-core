# Prompt 04 — GM Event Publication

## Objective

Wire `RunGameMasterUseCase` to emit `RuntimeEvent` frames via `ISessionEventPublisher` when it
produces unlock, suggestion, or choice-required decisions. Also emit processing lifecycle events
(`runtime.processing_started` / `runtime.processing_finished`) around the GM run.

The Game Master **must remain non-blocking** throughout. All publisher calls are fire-and-forget.

---

## Prerequisite Reading

- `docs/GAME_MASTER_CONTRACT.md` §5 — GM Output shape + Runtime event emission capability table
- `apps/core/src/application/use-cases/run-game-master/run-game-master.use-case.ts` — full GM flow
- `apps/core/src/application/use-cases/run-game-master/run-game-master.events.ts` — where GM events are emitted (event log helpers)
- `apps/core/src/application/ports/ISessionEventPublisher.ts` — the publisher port (from Prompt 01/02)

After reading, identify:

1. Where `applyAvatarUnlocks` is called — that's where `runtime.avatar_unlocked` is emitted
2. Where `output.suggestedAvatarId` is checked — that's where `runtime.avatar_suggested` is emitted
3. Where `output.recommendedChoices` is present — that's where `runtime.choice_required` is emitted
4. The entry point of `execute()` — processing lifecycle wraps the entire GM run

---

## Event Mapping

| GM Output field              | RuntimeEvent type             | Payload fields                                                  |
| ---------------------------- | ----------------------------- | --------------------------------------------------------------- |
| `unlockAvatarIds` (resolved) | `runtime.avatar_unlocked`     | `{ unlockedAvatarIds: string[] }`                               |
| `suggestedAvatarId`          | `runtime.avatar_suggested`    | `{ suggestedAvatarId: string, reason?: string }`                |
| `recommendedChoices` present | `runtime.choice_required`     | `{ choices: Array<{ id: string, label: string }> }`             |
| GM run starts                | `runtime.processing_started`  | `{ triggerReason: 'post_turn_observation', turnIndex: number }` |
| GM run ends (success/error)  | `runtime.processing_finished` | `{ success: boolean }`                                          |

Emit rules:

- `runtime.avatar_unlocked` — only when `unlockedAvatarIds.length > 0` (after `resolveAvatarUnlocks` validation)
- `runtime.avatar_suggested` — only when `output.suggestedAvatarId !== undefined`
- `runtime.choice_required` — only when `output.recommendedChoices !== undefined && output.recommendedChoices.length > 0`
- `runtime.processing_started` — at the start of `execute()`, before any async work
- `runtime.processing_finished` — always at the end of `execute()` (success or error), in a `finally` block

---

## Step 1 — Add `ISessionEventPublisher` as Optional Dependency

In `RunGameMasterUseCase`:

- Add `private readonly sessionEventPublisher?: ISessionEventPublisher` as the last constructor
  parameter (optional, consistent with how `eventLogRepository` is optional)
- Import `ISessionEventPublisher` from the ports directory

---

## Step 2 — Emit Processing Lifecycle Events

In `execute()`, wrap the existing body with `isProcessing` signalling:

```ts
async execute(input: RunGameMasterInput): Promise<void> {
  // Signal processing start
  this.sessionEventPublisher?.setProcessing(input.sessionId, true)
  this.emitRuntimeEvent({
    sessionId: input.sessionId,
    type: 'runtime.processing_started',
    correlationId: input.correlationId,
    payload: { triggerReason: 'post_turn_observation', turnIndex: input.turnIndex },
  })

  try {
    // ... existing body unchanged ...
  } finally {
    // Signal processing end (always, even on error)
    this.sessionEventPublisher?.setProcessing(input.sessionId, false)
    this.emitRuntimeEvent({
      sessionId: input.sessionId,
      type: 'runtime.processing_finished',
      correlationId: input.correlationId,
      payload: { success: true }, // errors set success: false in catch
    })
  }
}
```

> Errors inside the GM run are already caught and logged via `emitGameMasterError`. The
> `finally` block simply clears `isProcessing` regardless of outcome.

---

## Step 3 — Create a Private `emitRuntimeEvent` Helper

Add a private method to `RunGameMasterUseCase`:

```ts
private emitRuntimeEvent(
  fields: Omit<RuntimeEvent, 'eventId' | 'occurredAt'>
): void {
  if (this.sessionEventPublisher === undefined) return
  const event: RuntimeEvent = {
    eventId: `rev_${crypto.randomUUID()}`,
    occurredAt: new Date().toISOString(),
    ...fields,
  }
  this.sessionEventPublisher.emit(event)
}
```

Import `crypto` from `'node:crypto'`.

This helper must **never throw** — wrap in try/catch and log a warning if it does.

---

## Step 4 — Emit Avatar Unlock Events

In `handleTriggeredTurn`, after the `applyAvatarUnlocks` call resolves `unlockedAvatarIds`:

```ts
if (unlockedAvatarIds.length > 0) {
  this.emitRuntimeEvent({
    sessionId: input.sessionId,
    conversationId: input.conversationId,
    type: 'runtime.avatar_unlocked',
    correlationId: input.correlationId,
    payload: { unlockedAvatarIds },
  })
}
```

---

## Step 5 — Emit Avatar Suggested Event

After the GM output is parsed and `output.suggestedAvatarId` is truthy:

```ts
if (output.suggestedAvatarId !== undefined) {
  this.emitRuntimeEvent({
    sessionId: input.sessionId,
    conversationId: input.conversationId,
    type: 'runtime.avatar_suggested',
    correlationId: input.correlationId,
    payload: {
      suggestedAvatarId: output.suggestedAvatarId,
      ...(output.suggestedAvatarReason !== undefined
        ? { reason: output.suggestedAvatarReason }
        : {}),
    },
  })
}
```

---

## Step 6 — Emit Choice Required Event

After `recommendedChoices` is present in output:

```ts
if (output.recommendedChoices !== undefined && output.recommendedChoices.length > 0) {
  this.emitRuntimeEvent({
    sessionId: input.sessionId,
    conversationId: input.conversationId,
    type: 'runtime.choice_required',
    correlationId: input.correlationId,
    payload: { choices: output.recommendedChoices },
  })
}
```

---

## Step 7 — Wire `sessionEventPublisher` into `RunGameMasterUseCase` Construction

`RunGameMasterUseCase` is constructed in the server/route wiring. Find where `new RunGameMasterUseCase(...)` is called and add `resolvedAdapters.sessionEventPublisher` as the last argument.

> Check `apps/core/src/api/server.ts` and any factory helpers for the GM use case construction.

---

## Step 8 — Unit Tests for GM Event Emission

Add test cases to the existing `RunGameMasterUseCase` test suite (or create a dedicated file
`run-game-master.event-publication.test.ts`):

| Test                                                               | Expected                                 |
| ------------------------------------------------------------------ | ---------------------------------------- |
| GM run with no publisher injected                                  | no error (optional dependency)           |
| GM run starts → `runtime.processing_started` emitted               | publisher.emit called with correct type  |
| GM run finishes → `runtime.processing_finished` emitted            | always in `finally`                      |
| GM error path → `runtime.processing_finished` still emitted        | `finally` guarantees this                |
| `unlockedAvatarIds.length > 0` → `runtime.avatar_unlocked` emitted | payload matches                          |
| `unlockedAvatarIds.length === 0` → no unlock event                 | emit not called for avatar_unlocked      |
| `suggestedAvatarId` present → `runtime.avatar_suggested` emitted   | payload includes reason                  |
| `recommendedChoices` present → `runtime.choice_required` emitted   | payload.choices matches                  |
| `isProcessing` set to true on start, false on finish               | publisher.setProcessing called correctly |

All tests must be deterministic. Mock the publisher with a simple recording stub.

---

## Step 9 — Quality Gates

```bash
pnpm --filter @gami/core typecheck
pnpm --filter @gami/core test
pnpm lint
```

All must pass with zero errors.

---

## Commit

```
feat(epic-4-5): wire GM runtime event publication to ISessionEventPublisher [EPIC-4.5]
```
