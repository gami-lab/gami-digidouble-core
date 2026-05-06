# Console Runtime Inspector v2

## Context

The console already has a Scenario Test Bench, a basic Session Inspector, and a GM Debug panel.
EPIC 2.7 upgrades that into a real runtime-inspection tool for operators and developers.

The backend should not drive the UI shape blindly. The console must use canonical contracts and the
new aggregated/admin-safe APIs to make runtime behavior understandable without raw logs or DB
access.

## Scope

**In scope:**

- upgrade the Scenario Test Bench inspector area into a multi-panel runtime inspector
- consume the aggregated runtime-inspector snapshot from prompt 1
- consume assembled context inspection from prompt 2
- surface admin runtime actions from prompt 3
- connect to the existing session-scoped SSE stream for live runtime events
- surface user persona inspection/editing using existing user persona APIs

**Out of scope:**

- a brand-new console application shell
- full design-system rewrite
- rich analytics dashboards beyond the session-scoped runtime metrics needed by EPIC 2.7

## Relevant Docs

- `docs/EPICS.md` — EPIC 2.7 operator capabilities
- `docs/API_CONTRACT.md` — runtime-state, SSE, persona, memory, metrics, and new admin contracts
- `docs/ARCHITECTURE.md` — console is a consumer layer, not a second backend
- `docs/TECH_STACK.md` — React + Vite + TypeScript constraints
- `docs/TEST_STRATEGY.md` — test consumer-observable behavior, not internal hook wiring
- `docs/PROJECT_STATUS.md` — existing console Scenario Test Bench + GM Debug baseline

## Implementation Guidance

1. Start by reading the current console surfaces:
   - `apps/console/src/pages/ScenarioTestPage.tsx`
   - `apps/console/src/components/ScenarioTestLayout.tsx`
   - `apps/console/src/components/StateInspector.tsx`
   - `apps/console/src/components/GmDebugPanel.tsx`
   - `apps/console/src/api/sessions.ts`

2. Keep the UI coherent. Prefer one inspector workspace with clear sections or tabs such as:
   - Overview
   - Memory
   - Context
   - Events
   - Metrics
   - Actions

3. The inspector should make these EPIC requirements directly observable:
   - runtime-state visualization
   - layered memory inspection
   - GM decision + notes inspection
   - avatar transition visualization
   - unlock progression visualization
   - assembled Avatar/GM context inspection
   - runtime metrics display
   - user persona inspection/editor
   - live SSE event feed

4. Reuse the existing SSE endpoint instead of inventing a new console polling loop for live events.
   Implement a small typed EventSource adapter at the console API layer if needed.

5. Show safe action affordances:
   - reset session (existing endpoint)
   - replay GM
   - trigger memory refresh
   - clear session-scoped memory

6. The UI should clearly distinguish:
   - session-scoped state vs user-scoped state
   - current runtime snapshot vs live incoming events
   - read-only inspection vs destructive/admin actions

7. Use canonical shared DTOs from prompt 0. Do not reintroduce local API-contract copies in the
   console.

8. Tests:
   - unit/component tests for inspector data loading, action triggering, and error states
   - tests for SSE subscription behavior at the consumer boundary
   - avoid brittle snapshot tests or deep implementation-coupled hook assertions

## Constraints

- preserve the existing console’s overall information architecture unless there is a strong local
  reason to change it
- no duplicated API DTO ownership in the console
- no raw prompt dumping or provider-level payload rendering in the UI
- keep interactions explicit and safe for operators

## Deliverables

- upgraded runtime inspector in the console
- live runtime event viewer backed by the existing SSE endpoint
- persona editor surfaced in the inspector flow
- action controls for reset, replay GM, memory refresh, and memory clear
- component/API tests for the touched console slice

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
- `docs/API_CONTRACT.md` if any console-facing contract assumptions changed
- any console-specific README or docs if they are now stale

If no doc changes are needed, explicitly verify that the docs are still accurate.

## Acceptance Criteria

- [ ] the Scenario Test Bench exposes a coherent runtime inspector instead of separate minimal
      panels
- [ ] operators can view runtime state, memory, context, metrics, persona, transitions, and events
      for the selected session
- [ ] live SSE events are visible in the console for the selected session
- [ ] admin actions are available from the console and surface success/failure states clearly
- [ ] the console uses canonical shared API DTOs rather than local duplicated contracts
- [ ] console tests pass for the touched slice
