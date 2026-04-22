# EPIC 3.1 — Operational Health & Dependency Monitoring

## Objective

Expose structured health and dependency probes so operators know whether Postgres, Redis, and LLM providers are reachable **before** users report errors.

Replace the flat `GET /health` ("status: ok, always") with a richer surface:

- `GET /health` — shallow liveness probe (unchanged shape, always fast)
- `GET /v1/admin/health` — deep dependency probe (Postgres, Redis, LLM readiness)

## Generated

April 22, 2026

---

## Prompt Files

| #   | File                                                       | What It Delivers                                |
| --- | ---------------------------------------------------------- | ----------------------------------------------- |
| 01  | [01-health-domain-model.md](01-health-domain-model.md)     | Domain types, probe interface, result model     |
| 02  | [02-dependency-probes.md](02-dependency-probes.md)         | Postgres, Redis, and LLM probe implementations  |
| 03  | [03-admin-health-endpoint.md](03-admin-health-endpoint.md) | `GET /v1/admin/health` endpoint + route wiring  |
| 04  | [04-tests-and-hardening.md](04-tests-and-hardening.md)     | Unit tests, stack E2E tests, error edge cases   |
| 05  | [05-doc-sync.md](05-doc-sync.md)                           | API_CONTRACT, ARCHITECTURE, PROJECT_STATUS sync |

---

## Execution Order

Run prompts sequentially. Each prompt assumes the previous one is committed.

```
01 → 02 → 03 → 04 → 05
```

**01** must come first — all later prompts depend on the domain types it defines.  
**02** must come before **03** — the endpoint delegates to the probe implementations.  
**04** can start while **03** is under review but depends on the endpoint shape.  
**05** is always last.

---

## Dependencies

- Existing `GET /health` route (`apps/core/src/api/routes/health.ts`) — do not break it
- `ILlmAdapter` is already wired through `ServerAdapters`; probes need access to DB and Redis clients
- Redis client placeholder exists at `apps/core/src/infrastructure/cache/index.ts`
- Postgres client singleton at `apps/core/src/infrastructure/db/client.ts`

---

## Definition of Done

- [ ] `GET /health` continues to return `{ status: 'ok' }` fast (no DB calls, 200 always)
- [ ] `GET /v1/admin/health` returns per-dependency probe results with `healthy/degraded/unknown` states
- [ ] A stopped Postgres container makes the endpoint return `degraded` (not 500)
- [ ] A stopped Redis container makes the endpoint return `degraded`
- [ ] A misconfigured LLM provider key makes the LLM probe return `degraded`
- [ ] Overall status is `healthy` only when all probes pass; otherwise `degraded`
- [ ] Probe latencies are included in the response
- [ ] Auth enforced on `GET /v1/admin/health` (API key required)
- [ ] Stack E2E test covers auth rejection + response shape
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` all pass
- [ ] `docs/API_CONTRACT.md` updated with the new endpoint contract
- [ ] `docs/PROJECT_STATUS.md` updated

---

## Key Design Constraint

The `/health` endpoint must remain a fast liveness probe — it must never call external services. Kubernetes / load balancers use it. The deep probe lives exclusively at `/v1/admin/health`.
