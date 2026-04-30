# EPIC 4.3 — Performance Baseline

## Objective

Instrument real interaction costs so the team has objective data for product decisions.

Measure latency, token usage, and the overhead of the Avatar+GM flow compared to Avatar-only, using data already flowing through the system — no synthetic benchmarks, no new external tools.

The system already captures `latencyMs`, `inputTokens`, and `outputTokens` per avatar turn in `SendMessageUseCase`. This EPIC:

1. Adds missing metrics (per-step timing, GM overhead)
2. Exposes them through a queryable admin API
3. Ensures they are readable and testable without touching Langfuse directly

## Generated

April 30, 2026

---

## Prompt Files

| #   | File                                                         | What It Delivers                                                           |
| --- | ------------------------------------------------------------ | -------------------------------------------------------------------------- |
| 01  | [01-turn-timing-enrichment.md](01-turn-timing-enrichment.md) | Enrich `gm_triggered` events with GM step timing; align trace shape        |
| 02  | [02-metrics-query-use-case.md](02-metrics-query-use-case.md) | `GetTurnMetricsUseCase` — aggregates per-turn performance from event log   |
| 03  | [03-admin-metrics-endpoint.md](03-admin-metrics-endpoint.md) | `GET /v1/admin/sessions/{sessionId}/metrics` — expose turn metrics via API |
| 04  | [04-tests-and-hardening.md](04-tests-and-hardening.md)       | Unit + route + stack-E2E tests; edge cases                                 |
| 05  | [05-doc-sync.md](05-doc-sync.md)                             | API_CONTRACT, DATA_MODEL, ARCHITECTURE, PROJECT_STATUS sync                |

---

## Execution Order

```
01 → 02 → 03 → 04 → 05
```

**01** must come first — later prompts depend on the enriched event payload shape.  
**02** must come before **03** — the endpoint delegates to the use case.  
**04** covers all layers; run after **03** is committed.  
**05** is always last — doc sync requires all code to be stable.

---

## Dependencies

- `StoredEvent` and `IEventLogRepository` (already exist in `application/ports/`)
- `gm_triggered` event emitted by `RunGameMasterUseCase` (already exists; needs payload enrichment)
- `send_message` trace already captured by `SendMessageUseCase` via `IObservabilityAdapter`
- `GET /v1/admin/sessions/{sessionId}/events` endpoint (EPIC 2.6) — metrics endpoint is separate but uses the same event infrastructure
- `authenticateApiKey` Fastify hook (already in use on admin routes)

---

## Definition of Done

- [ ] Every completed avatar turn records total turn latency, avatar LLM latency, input tokens, output tokens in the event log
- [ ] Every completed GM run records GM LLM latency, input tokens, output tokens, and GM overhead (wall-clock minus avatar latency) in the event log
- [ ] `GET /v1/admin/sessions/{sessionId}/metrics` returns per-turn aggregated performance data
- [ ] Response clearly separates avatar timing from GM timing per turn
- [ ] Auth enforced on metrics endpoint (API key required)
- [ ] Stack-E2E test covers auth, not-found, and response shape
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` all pass
- [ ] `docs/API_CONTRACT.md` updated with the new endpoint
- [ ] `docs/PROJECT_STATUS.md` updated

---

## Key Design Constraints

- **No new dependencies.** All data lives in the existing `event_log` table. No new external metric stores.
- **No blocking changes to the hot path.** Metric enrichment adds only to existing fire-and-forget trace/event calls — never to the synchronous avatar response path.
- **No TTFT instrumentation in Phase A.** The LLM adapters are non-streaming; true TTFT requires streaming. Document this gap as a Phase B item rather than introducing streaming prematurely.
- **Single source of truth.** Metrics are derived from the event log, not from a separate table. Keeps schema complexity low.
- **Avatar-only vs Avatar+GM comparison** is derived from whether `gm_triggered` events are present for a given turn — no mode flag needed.
