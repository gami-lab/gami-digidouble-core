# Runtime Inspector Contract Cleanup

## Context

EPIC 2.7 touches existing contracts that are already spread across multiple layers:

- `RuntimeState` and `RuntimeEvent` in `@gami/shared`
- admin inspect response shape in `docs/API_CONTRACT.md`
- memory-layer DTOs in `@gami/shared`
- metrics response shape in `docs/API_CONTRACT.md`
- user persona API contracts
- local console-only copies in `apps/console/src/api/sessions.ts`

If implementation starts without first cleaning up contract ownership, the runtime inspector will
increase drift between Core, `@gami/shared`, and the console. EPIC 2.7 explicitly touches existing
models and admin DTOs, so this prompt is mandatory.

## Scope

**In scope:**

- identify all runtime-inspector HTTP contracts touched by EPIC 2.7
- centralize canonical ownership for those HTTP-facing DTOs
- remove obvious duplicated or drifting local copies in the console API layer
- prepare canonical request/response types for any new inspector or admin-action endpoints

**Out of scope:**

- new endpoint behavior
- new console panels
- storage schema changes unrelated to contract ownership

## Relevant Docs

- `docs/EPICS.md` — EPIC 2.7 scope and operator expectations
- `docs/API_CONTRACT.md` — existing inspect, memory, persona, runtime-state, SSE, and metrics APIs
- `docs/ARCHITECTURE.md` — admin/public API separation and console as consumer layer
- `docs/TECH_STACK.md` — TypeScript-first, shared package ownership, Fastify admin APIs
- `docs/TEST_STRATEGY.md` — contract discipline for admin APIs
- `docs/PROJECT_STATUS.md` — currently implemented EPIC 2.6, 4.2b, 4.3, 4.5, 5.5 surfaces

## Implementation Guidance

1. Read these files before changing anything:
   - `packages/shared/src/runtime-types.ts`
   - `packages/shared/src/lifecycle-types.ts`
   - `apps/console/src/api/sessions.ts`
   - `apps/core/src/api/routes/admin-sessions.ts`
   - `apps/core/src/api/routes/admin-memory.ts`
   - `apps/core/src/api/routes/runtime-events.ts`
   - `apps/core/src/api/routes/users.ts`
   - `apps/core/src/api/routes/admin-metrics.ts`

2. Inventory every touched EPIC 2.7 contract. At minimum, inspect ownership for:
   - runtime state snapshot
   - runtime event records shown in the inspector
   - admin session inspect response
   - layered memory response
   - admin session metrics response
   - user persona response
   - new runtime-inspector snapshot response
   - new admin-action request/response DTOs

3. Canonical owner rules:
   - HTTP-facing DTOs shared between Core and console belong in `packages/shared/src/`
   - domain-only orchestration or memory internals stay in `apps/core/src/domain/`
   - the console should import shared contracts, not recreate them structurally

4. Prefer adding one dedicated shared file for runtime-inspector/admin DTOs if the existing shared
   files are becoming overloaded. Keep the module names explicit and bounded.

5. Replace console-local copies such as `InspectSessionResponse`, `GmStateSummary`, and session
   event shapes with imports from the canonical shared owner. If a UI component needs only a
   subset, use `Pick<>` or a thin local view model rather than a duplicated API DTO.

6. Do not move internal application or domain types into `@gami/shared` unless they cross an HTTP
   or package boundary.

7. Add compile-time coverage where useful. This prompt is allowed to update existing unit tests if
   imports or named exports move.

## Constraints

- do not add new route behavior in this prompt
- keep backward compatibility for existing implemented endpoints
- avoid one giant `InspectorPayload` type with unrelated optional fields
- keep shared types consumer-oriented and API-stable
- no console-only divergence from `docs/API_CONTRACT.md`

## Deliverables

- canonical shared ownership for runtime-inspector/admin HTTP DTOs
- console API layer updated to consume shared types instead of local copies
- Core routes/use cases still compile against the new shared type ownership
- no new structural contract duplication introduced

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
- `docs/API_CONTRACT.md` if canonical DTO ownership or response shapes changed
- `docs/ARCHITECTURE.md` if the shared/admin boundary description drifted

If no doc changes are needed, explicitly verify that the docs are still accurate.

## Acceptance Criteria

- [ ] all HTTP-facing runtime-inspector contracts have one clear canonical owner
- [ ] `apps/console/src/api/sessions.ts` no longer defines duplicated admin-inspector DTOs that
      already belong in `@gami/shared`
- [ ] existing endpoint behavior remains backward compatible
- [ ] `pnpm typecheck` passes
