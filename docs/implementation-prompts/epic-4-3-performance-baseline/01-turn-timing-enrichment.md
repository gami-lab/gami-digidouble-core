# 01 — Turn Timing Enrichment

## Context

`SendMessageUseCase` already traces a `send_message` event via `IObservabilityAdapter`. It captures total turn latency and LLM token usage. However, this trace goes to Langfuse — it is not stored in the `event_log` table and is therefore not queryable through the platform's own APIs.

`RunGameMasterUseCase` emits a `gm_triggered` event into the event log but its payload currently only records that the GM ran — not how long it took or how many tokens it consumed.

This prompt closes both gaps:

1. Persist a structured `turn_completed` event in the event log for every avatar turn, with timing and token data.
2. Enrich the existing `gm_triggered` event payload with GM latency and token data.

These two events become the raw material for the metrics query use case in prompt 02.

## Scope

**In scope:**

- Add a `turn_completed` event type emitted by `SendMessageUseCase` into `IEventLogRepository`
- The event payload must include: `correlationId`, `conversationId`, `turnIndex`, `avatarId`, `avatarLatencyMs`, `inputTokens`, `outputTokens`, `totalTokens`, `model`, `hasGm` (boolean — whether a GM run was dispatched)
- Enrich the `gm_triggered` event payload (emitted by `RunGameMasterUseCase`) to include: `latencyMs`, `inputTokens`, `outputTokens`, `correlationId` (already on the `StoredEvent` but also useful in payload for query joins)
- `IEventLogRepository` already exists — no interface changes required
- All event appends remain non-blocking (fire-and-forget via `.catch()`)

**Out of scope:**

- TTFT (time-to-first-token) — requires streaming LLM adapters; deferred to Phase B
- Cross-session aggregation
- Metric storage in a separate table
- Any changes to the `TraceEvent`/Langfuse flow

## Relevant Docs

- `docs/ARCHITECTURE.md` — layer boundaries
- `docs/TECH_STACK.md` — no new dependencies
- `apps/core/src/application/ports/IEventLogRepository.ts` — `StoredEvent` shape
- `apps/core/src/application/use-cases/send-message/send-message.use-case.ts` — where to add event append
- `apps/core/src/application/use-cases/run-game-master/run-game-master.use-case.ts` — where to enrich GM event

## Implementation Guidance

### turn_completed event

In `SendMessageUseCase.execute()`, after `latencyMs` is computed, append a new `StoredEvent` to `IEventLogRepository`:

```
type: 'turn_completed'
severity: 'info'
sessionId: session.sessionId
correlationId: requestId
payload: {
  conversationId,
  turnIndex,            // count of user messages in history before this turn + 1
  avatarId,
  avatarLatencyMs,      // response.latencyMs (LLM only — from ILlmAdapter)
  totalTurnLatencyMs,   // Date.now() - start (full use-case wall clock)
  inputTokens,
  outputTokens,
  totalTokens,
  model,
  hasGm,               // true if runGameMasterUseCase is not null
}
```

`SendMessageUseCase` must receive `IEventLogRepository` as a constructor argument. Check existing constructor signature before adding — it may already be there for other event types (inspect the current implementation).

The append must be non-blocking (same pattern as `traceNonBlocking`). Do not await it on the critical path.

### Enriched gm_triggered payload

In `RunGameMasterUseCase`, measure latency around the LLM call. Add to the existing `gm_triggered` event payload:

```
latencyMs,       // GM LLM call wall clock
inputTokens,     // from GM LLM response
outputTokens,    // from GM LLM response
```

The `correlationId` field on `StoredEvent` already links GM events to the parent turn's `requestId`. No structural changes needed — only payload enrichment.

### turnIndex derivation

`turnIndex` is already computed in `SendMessageUseCase` as `nextTurnIndex` when calling `runGameMasterUseCase`. Reuse this value for the `turn_completed` event payload rather than recomputing it.

## Constraints

- Do not add latency measurement code to the synchronous avatar response path. Only fire-and-forget appends.
- The `IEventLogRepository` append signature does not change.
- No new domain types in `domain/` for metrics — event payloads are typed as `Record<string, unknown>` per the `StoredEvent` contract.
- Respect `max-lines-per-function ≤ 50` — extract helpers if the use-case method grows.

## Mandatory Pre-Implementation Check

Before coding:

1. Read current `SendMessageUseCase` constructor — confirm whether `IEventLogRepository` is already injected or needs adding.
2. Read `RunGameMasterUseCase` — confirm current `gm_triggered` payload structure.
3. Verify `StoredEvent` shape — confirm `payload` type and required fields.
4. Check `send-message.use-case.ts` for the `nextTurnIndex` variable — reuse it.

## Deliverables

- `SendMessageUseCase` emits a `turn_completed` event (non-blocking) on every successful turn
- `RunGameMasterUseCase` `gm_triggered` event payload includes `latencyMs`, `inputTokens`, `outputTokens`
- TypeScript strict mode — no `any`, typed payload constants (use `as const` / typed object literals where possible)
- `pnpm typecheck` passes

## Mandatory Final Step — Documentation Update

After implementation:

- `docs/PROJECT_STATUS.md` — note that turn timing is now persisted in event log
- Verify `docs/DATA_MODEL.md` event log section still accurately describes `StoredEvent` shape (no schema change, but payload documentation may be worth noting)

## Acceptance Criteria

- [ ] `turn_completed` events appear in `event_log` after every avatar turn (verifiable via `GET /v1/admin/sessions/{sessionId}/events`)
- [ ] `turn_completed` payload includes `avatarLatencyMs`, `totalTurnLatencyMs`, `inputTokens`, `outputTokens`, `model`, `hasGm`
- [ ] `gm_triggered` payload includes `latencyMs`, `inputTokens`, `outputTokens`
- [ ] No observable change to turn response latency (appends are fire-and-forget)
- [ ] `pnpm lint` and `pnpm typecheck` pass
