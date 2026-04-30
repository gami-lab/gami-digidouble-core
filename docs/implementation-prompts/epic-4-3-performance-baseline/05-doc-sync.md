# 05 — Documentation Sync

## Context

Prompts 01–04 deliver the full EPIC 4.3 implementation. This prompt closes the documentation loop — updating every impacted reference document so the repository remains the source of truth.

Nothing here should require code changes. If you discover a discrepancy between code and docs that requires a code fix, make the fix first, then update docs.

## Scope

**In scope:**

- `docs/API_CONTRACT.md` — add `GET /v1/admin/sessions/{sessionId}/metrics` endpoint definition
- `docs/DATA_MODEL.md` — document the new event types (`turn_completed`, enriched `gm_triggered` payload)
- `docs/PROJECT_STATUS.md` — mark EPIC 4.3 as complete
- `docs/TEST_COVERAGE_PLAN.md` — add coverage expectations for new modules
- `docs/ARCHITECTURE.md` — confirm `domain/metrics/` module is listed (or add it)

**Out of scope:**

- VISION.md — no strategic change
- PRINCIPLES.md — no principle change
- TECH_STACK.md — no new dependencies added
- GAME_MASTER_CONTRACT.md — only if the `gm_triggered` payload enrichment changes the GM output contract (check; it likely does not since payload enrichment is internal)

## Relevant Docs

Read all before editing:

- `docs/API_CONTRACT.md` — locate the admin endpoints appendix (Appendix A); add the new section after the existing health endpoint
- `docs/DATA_MODEL.md` — locate the event log section; describe the new event type payloads
- `docs/ARCHITECTURE.md` — locate the module map; ensure `domain/metrics/` appears
- `docs/TEST_COVERAGE_PLAN.md` — locate the application/domain coverage tables; add metrics entries

## API_CONTRACT.md Update

Add a new section to Appendix A (admin endpoints):

### A3. Turn Performance Metrics

```
GET /v1/admin/sessions/{sessionId}/metrics
```

**Auth:** API key required (`x-api-key` header)

**Response 200** (authenticated, session found):

```json
{
  "data": {
    "sessionId": "string (uuid)",
    "checkedAt": "string (ISO 8601)",
    "summary": {
      "totalTurns": "number",
      "turnsWithGm": "number",
      "avgAvatarLatencyMs": "number",
      "avgTotalTurnLatencyMs": "number",
      "avgInputTokens": "number",
      "avgOutputTokens": "number",
      "avgGmLatencyMs": "number | null"
    },
    "turns": [
      {
        "turnIndex": "number",
        "correlationId": "string (uuid)",
        "avatarLatencyMs": "number",
        "totalTurnLatencyMs": "number",
        "overheadMs": "number",
        "inputTokens": "number",
        "outputTokens": "number",
        "totalTokens": "number",
        "model": "string",
        "hasGm": "boolean",
        "gmLatencyMs": "number (optional)",
        "gmInputTokens": "number (optional)",
        "gmOutputTokens": "number (optional)"
      }
    ]
  },
  "error": null
}
```

**Behavior notes:**

- Always returns HTTP 200 when authenticated and session exists, even if `turns` is empty
- `summary.avgGmLatencyMs` is `null` when no turns have GM data (not `0`)
- `turns` is ordered by `turnIndex` ascending
- Turns pre-dating EPIC 4.3 (no `turn_completed` event) do not appear in the list

**Response 401:** Missing or invalid API key — standard `UNAUTHORIZED` envelope  
**Response 404:** Session not found — `NOT_FOUND` error code

## DATA_MODEL.md Update

Locate the `event_log` section. Add a sub-section documenting the two performance event types:

### Event: `turn_completed`

Emitted by `SendMessageUseCase` after every successful avatar turn (fire-and-forget).

Payload fields:

- `conversationId` — string
- `turnIndex` — number (1-based count of user messages in this conversation)
- `avatarId` — string
- `avatarLatencyMs` — number (LLM call wall clock, from `ILlmAdapter.complete` return value)
- `totalTurnLatencyMs` — number (full use-case wall clock from request start)
- `inputTokens` — number
- `outputTokens` — number
- `totalTokens` — number
- `model` — string (LLM model identifier)
- `hasGm` — boolean (true if a GM use case was wired and dispatched)

### Event: `gm_triggered` (enriched)

Pre-existing event type; payload enriched in EPIC 4.3.

Added payload fields:

- `latencyMs` — number (GM LLM call wall clock)
- `inputTokens` — number
- `outputTokens` — number

The `StoredEvent.correlationId` field links this event to the parent `turn_completed` event via shared `requestId`.

## ARCHITECTURE.md Update

Locate the module map section. Confirm `domain/metrics/` is listed under `domain/`. If absent, add:

```
domain/
  ...
  metrics/        → TurnMetrics, TurnMetricsSummary, TurnMetricsReport types
```

Add `get-turn-metrics/` under `application/use-cases/` if not already listed.

## PROJECT_STATUS.md Update

Add a new entry under the current sprint section:

```
### EPIC 4.3 — Performance Baseline: **complete** (April 30, 2026)

- `turn_completed` events persisted to event log on every successful avatar turn,
  capturing avatar LLM latency, total turn latency, token counts, model, and hasGm flag
- `gm_triggered` event payload enriched with GM LLM latency and token usage
- `GetTurnMetricsUseCase` added — reads event log, joins turn + GM events by correlationId,
  computes per-turn metrics and session-level summary statistics
- `GET /v1/admin/sessions/{sessionId}/metrics` endpoint implemented (API-key required);
  returns `ApiResponse<TurnMetricsReport>` with per-turn and summary data
- Route returns 404 for unknown sessions, 200 with empty turns for sessions with no metric events
- Unit tests cover all `GetTurnMetricsUseCase` scenarios including legacy events and orphan GM events
- Route tests cover auth, not-found, empty, and data-populated cases
- Stack-E2E covers auth rejection and not-found; happy-path deferred pending session seeding utility
- Quality gates confirmed: `pnpm lint`, `pnpm typecheck`, `pnpm test` pass
```

## TEST_COVERAGE_PLAN.md Update

If a coverage table exists, add entries for:

| Module                                    | Required Coverage                                                                 |
| ----------------------------------------- | --------------------------------------------------------------------------------- |
| `domain/metrics/metrics.types.ts`         | Types only — no runtime logic; N/A                                                |
| `application/use-cases/get-turn-metrics/` | Unit tests required; all logical branches (empty, avatar-only, GM, legacy events) |
| `api/routes/admin-metrics.ts`             | Route tests required (auth, not-found, empty, data cases)                         |

## Constraints

- Do not invent API behavior not implemented in code — document what was actually built
- If any doc section already covers the topic accurately, only append the new data — do not rewrite working content
- Doc changes should not require code changes; if they do, fix the code first

## Mandatory Final Step

After all doc updates:

1. Re-read each updated section to verify internal consistency
2. Confirm `API_CONTRACT.md` new section matches the actual `TurnMetricsReport` type defined in `domain/metrics/metrics.types.ts`
3. Run `pnpm test` one final time to confirm nothing was accidentally broken

## Acceptance Criteria

- [ ] `docs/API_CONTRACT.md` includes `GET /v1/admin/sessions/{sessionId}/metrics` with correct shape
- [ ] `docs/DATA_MODEL.md` documents `turn_completed` payload and enriched `gm_triggered` payload
- [ ] `docs/ARCHITECTURE.md` lists `domain/metrics/` module
- [ ] `docs/PROJECT_STATUS.md` marks EPIC 4.3 complete with accurate summary
- [ ] `docs/TEST_COVERAGE_PLAN.md` updated with new module coverage expectations
- [ ] No stale references to missing features or incorrect field names in any updated doc
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` still pass after doc-only changes
