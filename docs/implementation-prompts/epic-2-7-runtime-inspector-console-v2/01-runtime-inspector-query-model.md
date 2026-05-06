# Aggregated Runtime Inspector Query Model

## Context

The console currently has inspection primitives, but they are fragmented:

- GM inspect endpoint
- memory summary endpoint
- memory-layers endpoint
- session events endpoint
- runtime-state endpoint
- runtime SSE stream
- session metrics endpoint
- user persona endpoint

EPIC 2.7 needs a coherent runtime-inspector experience, not another collection of independent API
calls. The console should be able to load one operator snapshot for a session and render most of
the inspector from that response.

## Scope

**In scope:**

- add one aggregated admin endpoint for the runtime inspector, for example:
  - `GET /v1/admin/sessions/{sessionId}/runtime-inspector`
- compose the endpoint from already-implemented read models where possible
- return only bounded, operator-safe data needed for overview/runtime panels
- add route tests and a stack-e2e file for the new endpoint

**Out of scope:**

- assembled Avatar/GM context inspection (handled in a later prompt)
- admin mutation actions (handled in a later prompt)
- console UI implementation

## Relevant Docs

- `docs/EPICS.md` — EPIC 2.7 includes runtime-state, memory, transitions, unlocks, metrics
- `docs/API_CONTRACT.md` — existing inspect/memory/metrics/runtime-state contracts
- `docs/ARCHITECTURE.md` — admin API belongs in the admin plane, console remains a consumer
- `docs/TEST_STRATEGY.md` — admin APIs are first-class contracts
- `docs/TEST_COVERAGE_PLAN.md` — inspect, memory, metrics, runtime-state coverage expectations
- `docs/PROJECT_STATUS.md` — implemented backend capabilities that should be reused

## Implementation Guidance

1. Build a dedicated application use case that composes existing read-model boundaries instead of
   reimplementing route logic. Reuse existing repositories/use cases wherever practical.

2. The runtime-inspector response should be operator-oriented and stable. Include the minimum data
   that the console needs to render an overview panel without further fan-out. A good starting
   envelope is:
   - `session`
   - `runtimeState`
   - `gm`
     - `gmState`
     - `gmNotes`
     - `transitionHistory`
     - `unlockedAvatarIds`
   - `memory`
     - compact summary
     - layered memory snapshot
   - `metrics`
     - summary block from admin session metrics
   - `persona`
   - `availableAvatars`
   - `recentEvents` (bounded, newest-first)

3. Reuse existing bounds rather than introducing new ones casually. If you add a new event limit,
   make it explicit in the contract and keep it small (for example 20 or 50).

4. Avoid embedding raw transcript replay. The existing memory and runtime contracts are already
   bounded. Preserve that property.

5. Add a new shared HTTP DTO for this endpoint in `@gami/shared`. The console should consume that
   DTO directly.

6. Route requirements:
   - API key auth required
   - `404` for missing session
   - response uses the standard `ApiResponse<T>` envelope used by the codebase

7. Tests:
   - application/use-case behavior tests for composition and missing optional layers
   - route tests for auth/not-found/happy path shape
   - `apps/core/src/api/routes/admin-runtime-inspector.stack-e2e.test.ts` with auth,
     validation if applicable, not-found, and happy path if seedable

## Constraints

- do not collapse all inspector logic into the route handler
- reuse existing read models before adding new repository methods
- no raw prompt text, provider credentials, or unbounded message history in the response
- do not let the admin snapshot drift from the shared contract owner introduced in prompt 0

## Deliverables

- new aggregated runtime-inspector endpoint
- application use case that composes existing read models cleanly
- shared response type for the new endpoint
- route tests and stack-e2e coverage

## Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts.
2. Search for duplicated type definitions.
3. Identify canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- `docs/API_CONTRACT.md`
- `docs/TEST_COVERAGE_PLAN.md` if new route coverage expectations were added

If no doc changes are needed, explicitly verify that the docs are still accurate.

## Acceptance Criteria

- [ ] `GET /v1/admin/sessions/{sessionId}/runtime-inspector` exists with a canonical shared DTO
- [ ] the response is bounded, operator-safe, and sufficient for the console overview/runtime
      panels
- [ ] the route returns `401` on missing/wrong API key and `404` for unknown sessions
- [ ] the endpoint has route tests and a matching `*.stack-e2e.test.ts` file
- [ ] `pnpm test` passes for the touched slice
