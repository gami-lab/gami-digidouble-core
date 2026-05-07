# Runtime Inspector Query Model Over Existing APIs

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

EPIC 2.7 needs a coherent runtime-inspector experience, not another collection of ad hoc console
calls. The console should have one typed query/composition layer for runtime inspection, but that
does not require adding a new backend read endpoint when the existing APIs already cover the needed
data.

## Scope

**In scope:**

- define one typed console-side query/composition layer for the runtime inspector
- reuse the existing read APIs where they already provide the needed bounded data:
  - `GET /v1/admin/sessions/{sessionId}/inspect`
  - `GET /v1/admin/sessions/{sessionId}/memory`
  - `GET /v1/admin/sessions/{sessionId}/memory-layers`
  - `GET /v1/admin/sessions/{sessionId}/events`
  - `GET /v1/admin/sessions/{sessionId}/metrics`
  - `GET /v1/sessions/{sessionId}/runtime-state`
  - `GET /v1/users/{userId}/persona`
- consolidate contract ownership and eliminate duplicated console DTOs
- return only bounded, operator-safe data needed for overview/runtime panels

**Out of scope:**

- assembled Avatar/GM context inspection endpoint work (handled in a later prompt)
- admin mutation actions (handled in a later prompt)
- major console UI implementation

## Relevant Docs

- `docs/EPICS.md` — EPIC 2.7 includes runtime-state, memory, transitions, unlocks, metrics
- `docs/API_CONTRACT.md` — existing inspect/memory/metrics/runtime-state contracts
- `docs/ARCHITECTURE.md` — admin API belongs in the admin plane, console remains a consumer
- `docs/TEST_STRATEGY.md` — admin APIs are first-class contracts
- `docs/TEST_COVERAGE_PLAN.md` — inspect, memory, metrics, runtime-state coverage expectations
- `docs/PROJECT_STATUS.md` — implemented backend capabilities that should be reused

## Implementation Guidance

1. Treat this as a reuse-and-composition prompt, not a route-addition prompt.

2. Build one typed query/composition layer at the console boundary that loads the existing runtime
   inspector inputs and maps them into one coherent console view model.

3. Use prompt 0 to centralize HTTP DTO ownership in `@gami/shared`, then make the console query
   layer compose those shared contracts instead of redefining them locally.

4. A good starting composed view model for the console is:

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
- `recentEvents` (bounded, newest-first)

5. If loading order or request fan-out becomes awkward, solve it first with a console-side loader
   or application service function, not with a new backend endpoint by default.

6. Reuse existing bounds rather than introducing new ones casually.

7. Avoid embedding raw transcript replay. The existing memory and runtime contracts are already
   bounded. Preserve that property.

8. Tests:

- focused console/API-layer tests for composition and missing optional layers
- update any touched Core route tests only if shared DTO ownership changed
- do not add a new route or stack-e2e test in this prompt unless you prove an existing API is
  insufficient and choose to introduce a new endpoint explicitly

## Constraints

- do not add a new aggregated admin route unless the existing read APIs are demonstrably
  insufficient after contract cleanup
- reuse existing read APIs before adding new repository methods or new routes
- no raw prompt text, provider credentials, or unbounded message history in the composed view
- do not let the console query model drift from the shared contract owner introduced in prompt 0

## Deliverables

- one clean typed console query/composition layer for the runtime inspector
- shared DTO ownership aligned with the existing read APIs
- console/API-layer tests for the composed inspector model
- explicit justification only if a new backend read endpoint is still needed after this slice

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

- [ ] the runtime inspector uses one typed console-side query/composition layer over the existing
      read APIs
- [ ] shared DTO ownership is canonical and the console no longer defines duplicated inspector DTOs
- [ ] the composed inspector model is bounded, operator-safe, and sufficient for the console
      overview/runtime panels
- [ ] a new backend read endpoint is not introduced unless the existing APIs are proven
      insufficient and that decision is explicitly documented
- [ ] `pnpm test` passes for the touched slice
