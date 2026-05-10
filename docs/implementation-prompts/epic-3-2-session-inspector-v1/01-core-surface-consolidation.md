# Consolidate backend inspector surfaces

## Context

The backend already exposes multiple session-inspection and observability routes:

- `GET /v1/admin/sessions/:sessionId/inspect`
- `GET /v1/admin/sessions/:sessionId/events`
- `GET /v1/admin/sessions/:sessionId/memory`
- `GET /v1/admin/sessions/:sessionId/memory-layers`
- `GET /v1/admin/sessions/:sessionId/metrics`
- `GET /v1/admin/sessions/:sessionId/context`
- `GET /v1/sessions/:sessionId/runtime-state`
- `GET /v1/sessions/:sessionId/events/stream`

EPIC 3.2 should not add another read surface by default. The goal is to audit those existing routes, decide which ones are canonical, and remove any redundant compatibility path that only survives because it used to be there.

## Scope

**In scope:**

- decide the canonical backend session-inspector read path
- simplify route handlers so they reuse the same application-level mapping and error handling
- remove redundant route-local conversions or helper code
- if `admin-session-context` is redundant after the audit, delete it and update its callers instead of keeping it alive in parallel
- keep the surviving backend surfaces bounded and explicit

**Out of scope:**

- console redesign
- adding a new inspector endpoint
- changing unrelated public session routes
- schema migrations

## Relevant Docs

- `docs/EPICS.md` - EPIC 3.2 scope
- `docs/API_CONTRACT.md` - current session inspector/admin contract shapes
- `docs/ARCHITECTURE.md` - route ownership and layer boundaries
- `docs/TEST_STRATEGY.md` - admin-route and stack-E2E rules
- `docs/PROJECT_STATUS.md` - current observability surface status

## Implementation Guidance

1. Start from the current route set and inspect how each route is wired:
   - `apps/core/src/api/routes/admin-sessions.ts`
   - `apps/core/src/api/routes/admin-memory.ts`
   - `apps/core/src/api/routes/admin-metrics.ts`
   - `apps/core/src/api/routes/admin-session-context.ts`
   - `apps/core/src/api/routes/runtime-events.ts`
   - `apps/core/src/api/routes/get-runtime-state.ts`

2. Decide the canonical surface for each capability:
   - session summary and transition history
   - GM state and notes
   - message history / events
   - memory summary and layers
   - metrics
   - assembled context
   - runtime state and live events

3. Prefer a single internal mapping path in Core when multiple routes currently duplicate the same composition or error conversion.

4. If one route is only a compatibility wrapper for another and the console does not truly need both, remove the wrapper and update all callers.

5. Keep auth, not-found, and error mapping consistent across the surviving routes. Do not let each route invent its own variant of the same response behavior.

6. Do not introduce a new endpoint to paper over duplication. Reduce the surface first.

## Constraints

- no backward compatibility for admin surfaces unless a route is already externally depended on and cannot be removed in this EPIC
- KISS: prefer fewer routes and fewer branches
- do not duplicate mapping logic across route files
- keep `ApiResponse<T>` behavior consistent with the existing contract
- if the audit proves a new route is unavoidable, stop and make that decision explicit before implementing it

## Deliverables

- one clean canonical backend inspector surface plan
- removed redundant route code or wrapper logic
- consistent auth / validation / not-found behavior across surviving routes
- no extra route introduced just to preserve old structure

## Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts.
2. Search for duplicated type definitions.
3. Identify canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

## Mandatory Final Step - Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- `docs/API_CONTRACT.md` if the final route surface or response shape changed
- `docs/ARCHITECTURE.md` if route ownership changed
- `docs/TEST_STRATEGY.md` if test expectations changed

If no doc changes are needed, explicitly verify that the docs are still accurate.

## Acceptance Criteria

- [ ] redundant backend inspector routes or compatibility wrappers are removed or clearly justified
- [ ] one canonical backend implementation path remains for the surviving inspector capabilities
- [ ] route error behavior is consistent and bounded
- [ ] no new endpoint was added to work around duplication
- [ ] backend route tests pass
