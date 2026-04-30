# 02 — Metrics Query Use Case

## Context

The event log now contains `turn_completed` events (from prompt 01) and enriched `gm_triggered` events. This prompt builds the use case that reads those events, joins them by `correlationId`, and produces a structured `TurnMetricsReport` — the domain object the API endpoint will return.

This use case lives in the application layer, depends only on `IEventLogRepository`, and has no infrastructure dependencies. It must be fully unit-testable.

## Scope

**In scope:**

- `TurnMetricsReport` domain type (in `domain/` or `application/use-cases/` — see guidance)
- `GetTurnMetricsUseCase` — reads events for a session, groups by turn, joins avatar + GM data
- Per-turn output: turn index, avatar latency, GM latency (if present), token counts, model, total turn latency, overhead (total minus avatar LLM latency)
- Summary statistics: avg avatar latency, avg GM latency, avg total tokens, % turns with GM
- Session-level context: sessionId, total turns, `checkedAt`

**Out of scope:**

- Cross-session aggregation
- Percentile calculations (p50/p95) — add as a later iteration
- Pagination of turn list
- Any changes to the event log or database schema

## Relevant Docs

- `docs/ARCHITECTURE.md` — use cases live in `application/use-cases/`
- `docs/DATA_MODEL.md` — understand `StoredEvent` and event_log table
- `apps/core/src/application/ports/IEventLogRepository.ts`
- `apps/core/src/domain/health/health.types.ts` — example of clean domain type structure
- `apps/core/src/application/use-cases/get-health/get-health.use-case.ts` — example use case pattern

## Implementation Guidance

### Type placement

Place `TurnMetricsReport` and related types in:

```
apps/core/src/domain/metrics/metrics.types.ts
```

Export via `apps/core/src/domain/metrics/index.ts`.

Do not place metric types in `application/` — they are domain concepts.

### TurnMetricsReport shape

```ts
type TurnMetrics = {
  turnIndex: number
  correlationId: string
  avatarLatencyMs: number
  totalTurnLatencyMs: number
  overheadMs: number // totalTurnLatencyMs - avatarLatencyMs
  inputTokens: number
  outputTokens: number
  totalTokens: number
  model: string
  hasGm: boolean
  gmLatencyMs?: number // present if gm_triggered event found for this correlationId
  gmInputTokens?: number
  gmOutputTokens?: number
}

type TurnMetricsSummary = {
  totalTurns: number
  turnsWithGm: number
  avgAvatarLatencyMs: number
  avgTotalTurnLatencyMs: number
  avgInputTokens: number
  avgOutputTokens: number
  avgGmLatencyMs: number | null // null if no GM turns
}

type TurnMetricsReport = {
  sessionId: string
  checkedAt: string // ISO timestamp of query
  summary: TurnMetricsSummary
  turns: TurnMetrics[] // ordered by turnIndex ASC
}
```

### GetTurnMetricsUseCase

Location: `apps/core/src/application/use-cases/get-turn-metrics/get-turn-metrics.use-case.ts`

Input: `{ sessionId: string }`

Algorithm:

1. Call `IEventLogRepository.findBySessionId(sessionId)` with a generous limit (e.g., 500 — enough for a full session).
2. Filter events where `type === 'turn_completed'` — these are the canonical turn records.
3. For each `turn_completed` event, extract the `correlationId`. Look for a matching `gm_triggered` event with the same `correlationId`.
4. Build a `TurnMetrics` object per turn. If no matching GM event found, `hasGm: false`, GM fields absent.
5. Sort turns by `turnIndex` ascending.
6. Compute `TurnMetricsSummary` from the turns array.
7. Return `TurnMetricsReport`.

**Edge cases to handle:**

- Session has no `turn_completed` events (never sent a message, or events pre-date this EPIC): return empty `turns: []`, summary with all zeros/nulls.
- A `gm_triggered` event exists but has no latency in its payload (legacy events from before this EPIC): treat as if no GM data — do not error, do not include partial GM stats.
- Multiple `gm_triggered` events for the same `correlationId` (race condition edge case): use the first one found; log a warning.

### Payload extraction

Event payloads are typed as `Record<string, unknown>`. Write a private helper `extractTurnCompletedPayload` and `extractGmPayload` that safely read fields with `typeof` guards. Return `null` for malformed events rather than throwing.

## Constraints

- No infrastructure imports in the use case — only `IEventLogRepository` port.
- Strict mode: all payload field access must go through type guards.
- Do not call `IEventLogRepository` more than once per `execute()` call — fetch all events in a single call, then process in memory.
- `summary.avgGmLatencyMs` must be `null` (not `0`) when no GM turns exist — the distinction matters for display.

## Mandatory Pre-Implementation Check

Before coding:

1. Check if `domain/metrics/` folder already exists — create it only if absent.
2. Confirm `IEventLogRepository.findBySessionId` default limit behavior — pass an explicit high limit to avoid truncation.
3. Look at `GetHealthUseCase` as a pattern reference for a simple, port-dependent use case.
4. Check `@gami/shared` — no shared metric types needed at this stage (metrics are internal/admin-only).

## Deliverables

- `apps/core/src/domain/metrics/metrics.types.ts` — `TurnMetrics`, `TurnMetricsSummary`, `TurnMetricsReport`
- `apps/core/src/domain/metrics/index.ts` — barrel export
- `apps/core/src/application/use-cases/get-turn-metrics/get-turn-metrics.use-case.ts`
- Unit tests: `get-turn-metrics.use-case.test.ts`

## Unit Test Targets

Tests must be deterministic (no real DB, no LLM calls):

- Empty event log → empty turns, zero summary
- Single turn, no GM → `hasGm: false`, correct latency values
- Single turn with GM → `hasGm: true`, `gmLatencyMs` present
- Multiple turns mixed (some with GM, some without) → per-turn and summary computed correctly
- Turn with legacy GM event missing latency payload → `gmLatencyMs` absent, no error
- Summary averages are mathematically correct for a known input set

## Mandatory Final Step — Documentation Update

After implementation:

- `docs/PROJECT_STATUS.md` — note that `GetTurnMetricsUseCase` is complete
- Verify `docs/ARCHITECTURE.md` module map reflects the new `domain/metrics/` module if not already present

## Acceptance Criteria

- [ ] `GetTurnMetricsUseCase` returns correct `TurnMetricsReport` from a mocked event set
- [ ] Empty event log returns a valid empty report (no throw)
- [ ] GM overhead computed correctly (`totalTurnLatencyMs - avatarLatencyMs`)
- [ ] Summary averages are correctly derived from the turns array
- [ ] All unit tests pass
- [ ] `pnpm typecheck` passes
