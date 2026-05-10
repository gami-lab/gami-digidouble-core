# Audit and collapse inspector contracts

## Context

EPIC 3.2 touches existing models and admin DTOs that are already spread across multiple layers:

- `AdminSessionInspectResponse` and `AdminSessionEventsResponse` in `@gami/shared`
- memory read shapes in `admin-memory` and `admin-memory-layers`
- `AdminSessionContextResponse` in the admin context route
- `AdminSessionTurnMetricsResponse` in the admin metrics route
- runtime snapshot shapes such as `RuntimeState`
- console-local wrappers in `apps/console/src/api/sessions.ts` and `apps/console/src/api/runtime-inspector.ts`

If implementation starts without first cleaning up contract ownership, the inspector work will increase drift between Core, `@gami/shared`, and the console. This prompt is mandatory.

## Scope

**In scope:**

- inventory every session-inspector-related HTTP contract touched by EPIC 3.2
- identify duplicated or overlapping response shapes, local aliases, and backward-compat branches
- choose the canonical owner for each shared DTO
- remove obvious console-local copies and redundant helper types
- decide whether `admin-session-context` is still needed once the canonical inspector flow is defined

**Out of scope:**

- new inspector behavior
- UI redesign
- adding new endpoints
- storage schema changes unrelated to inspector contracts

## Relevant Docs

- `docs/EPICS.md` - EPIC 3.2 scope and operator expectations
- `docs/API_CONTRACT.md` - existing inspect, memory, metrics, context, runtime-state, and event APIs
- `docs/ARCHITECTURE.md` - admin/public API separation and console as a consumer layer
- `docs/TEST_STRATEGY.md` - contract discipline for admin APIs and stack-E2E expectations
- `docs/PROJECT_STATUS.md` - current state of the observability surfaces
- `docs/DATA_MODEL.md` - session, message, and memory boundaries that the inspector reads from

## Implementation Guidance

1. Read the current contract owners before changing anything:
   - `packages/shared/src/runtime-inspector-types.ts`
   - `apps/console/src/api/runtime-inspector.ts`
   - `apps/console/src/api/sessions.ts`
   - `apps/core/src/api/routes/admin-sessions.ts`
   - `apps/core/src/api/routes/admin-memory.ts`
   - `apps/core/src/api/routes/admin-metrics.ts`
   - `apps/core/src/api/routes/admin-session-context.ts`
   - `apps/core/src/api/routes/runtime-events.ts`

2. Build a short contract map for the inspector surface:
   - session inspect
   - session events
   - session memory summary
   - session memory layers
   - session metrics
   - session context
   - runtime state
   - runtime event stream

3. Canonical owner rules:
   - HTTP-facing DTOs shared between Core and console belong in `packages/shared/src/`
   - core application/domain internals stay in `apps/core/src/`
   - the console imports shared contracts and should not recreate structurally identical admin DTOs locally

4. Remove backward-compatibility code where it only exists to preserve parallel shapes or aliases. This EPIC is not production-critical; prefer one clean contract over keeping old and new shapes alive.

5. If a route is only a thin wrapper around another route or use case and the inspector does not need both, remove the redundant path rather than keeping both around.

6. Keep the contract bounded. Do not create a giant inspector DTO just to avoid making a decision.

## Constraints

- KISS first; do not keep duplicated read surfaces around for convenience
- no silent console-only divergence from `docs/API_CONTRACT.md`
- no new endpoint unless the audit proves the existing surfaces cannot support the EPIC
- if a new endpoint becomes unavoidable, its stack-E2E file must be added immediately in the same EPIC slice
- do not preserve compatibility code just because it is already there

## Deliverables

- a canonical owner map for inspector-related DTOs
- removed duplicate console-local inspector types or wrappers
- removed or justified redundant admin read routes
- a clean compile against the remaining canonical contracts

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
- `docs/API_CONTRACT.md` if any inspector response shape or owner changed
- `docs/ARCHITECTURE.md` if the admin/console boundary changed
- `docs/TEST_STRATEGY.md` if test tier expectations changed

If no doc changes are needed, explicitly verify that the docs are still accurate.

## Acceptance Criteria

- [ ] all inspector-related HTTP DTOs have one clear canonical owner
- [ ] console-local duplicates of inspector DTOs are removed
- [ ] any redundant inspector route or helper that only preserved compatibility is removed or collapsed
- [ ] no new inspector endpoint is introduced unless the audit proves it is truly necessary
- [ ] `pnpm typecheck` passes
