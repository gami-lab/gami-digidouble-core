# Code Audit — EPIC 2.5 — Admin CRUD Completion + Console Integration

## Scope audited

- `PATCH /v1/scenarios/{scenarioId}`
- `PATCH /v1/avatars/{avatarId}`
- `GET /v1/sessions`
- `POST /v1/sessions/{sessionId}/reset`
- Console admin flows for scenario edit/delete, avatar edit/delete, and session list/reset
- Repository, use-case, route, and test changes associated with EPIC 2.5

## Executive Summary

EPIC 2.5 is mostly delivered. The backend adds the promised CRUD-completion endpoints with clean application-layer use cases, adapter-backed persistence, and meaningful API/stack-e2e coverage. Console integration is present and usable, with clear inline editing patterns and a dedicated session admin page.

The architecture remains aligned with the modular-monolith constraints: business logic stays in use cases, route handlers remain thin, and persistence stays behind ports.

The main issue is functional, not structural: `ResetSessionUseCase` clears `unlockedAvatarIds` to `[]` instead of restoring the scenario's initial unlocked state. In unlock-gated scenarios such as AI Guided Discovery, that can leave a reset session with no selectable avatars, which breaks the intended operator-facing reset behavior.

The second meaningful weakness is test confidence on the console side. The new admin UI is untested. The EPIC promised a full admin flow usable from the console, but current console tests only cover older state helpers, not the newly added edit/delete/reset flows.

## Final Grade

**C**

## Build Health

- lint: PASS
- typecheck: PASS
- tests: PASS
- coverage: PASS — `pnpm test:coverage` reports `91.48%` statements, `86.78%` branches, `97.89%` functions, `91.48%` lines

## Feature Confidence Matrix

| Feature                     | Expected Behavior                                                     | Evidence                                                                                | Confidence (High/Medium/Low) | Notes                                                                      |
| --------------------------- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------- |
| Scenario partial update API | Operator can patch scenario fields without replacing the whole record | `update-scenario` use case tests, `scenarios.ts` route, `scenarios.stack-e2e.test.ts`   | High                         | Good negative-path and happy-path coverage                                 |
| Avatar partial update API   | Operator can patch avatar prompt and metadata safely                  | `update-avatar` use case tests, `avatars.ts` route, `avatars.stack-e2e.test.ts`         | High                         | Good backend confidence                                                    |
| Session list API            | Operator can list sessions and filter by scenario/user/status         | `list-sessions` use case tests, `sessions.ts` route, `sessions-admin.stack-e2e.test.ts` | Medium                       | Route exists, but HTTP-level proof of sort/filter semantics is still light |
| Session reset API           | Reset preserves session record and returns it to a usable clean state | `reset-session` use case tests, `sessions.ts` route, `sessions-admin.stack-e2e.test.ts` | Low                          | Core unlock-state behavior is incorrect for gated scenarios                |
| Scenario admin UI           | Operator can edit/delete scenarios from console                       | `ScenarioPage.tsx`, `scenario-row.tsx`                                                  | Low                          | Implemented, but no UI tests prove behavior                                |
| Avatar admin UI             | Operator can edit/delete avatars from console                         | `AvatarPage.tsx`, `avatar-row.tsx`                                                      | Low                          | Implemented, but no UI tests prove behavior                                |
| Session admin UI            | Operator can list/filter/reset sessions from console                  | `SessionAdminPage.tsx`, `App.tsx`, API client methods                                   | Low                          | Implemented, but no UI tests prove behavior                                |

## Strengths

- Backend changes respect architecture boundaries. Routes stay thin, use cases own decisions, and infrastructure remains behind ports.
- Repository interface expansion is coherent across ports, in-memory adapters, and Postgres adapters.
- New HTTP endpoints have meaningful auth and negative-path coverage, including stack-e2e files for the new admin API surface.
- Delete conflict handling was improved with structured `details`, which materially helps operators and clients.
- Coverage is strong overall, and the new backend use cases are not relying on brittle implementation-mirroring assertions only.

## Findings

### Reset Leaves Unlock-Gated Sessions Unusable

- Severity: High
- Category: Functional correctness
- Problem: `ResetSessionUseCase` hardcodes `unlockedAvatarIds: []` on reset. In scenarios that use avatar availability policies, `StartSessionUseCase` derives initial unlocked avatars from scenario config. Reset does not recompute that initial set, so the session can become active but have no unlocked avatars.
- Why it matters: The EPIC promises that operators can inspect and reset sessions from the UI. In the flagship AI Guided Discovery scenario, a reset should return the session to a clean usable starting point. Instead, the operator can end up with a session that cannot legally start a conversation because `StartConversationUseCase` blocks locked avatars.
- Evidence:
  - `apps/core/src/application/use-cases/start-session/start-session.use-case.ts` computes initial unlock state via `resolveInitialUnlockedAvatarIds(...)`
  - `apps/core/src/application/use-cases/reset-session/reset-session.use-case.ts` sets `unlockedAvatarIds: []`
  - `apps/core/src/application/use-cases/start-conversation/start-conversation.use-case.ts` forbids starting a conversation when `session.unlockedAvatarIds` exists and does not include the avatar
- Recommendation: Extend reset to restore the scenario's initial unlocked avatar set, not an empty set. That likely means `ResetSessionUseCase` needs access to scenario + avatar repositories or a small domain service abstraction that recomputes initial availability from the scenario config.

### Console Admin Flows Have No Automated Test Coverage

- Severity: Medium
- Category: Test quality
- Problem: The new console admin features are shipped without UI-level tests. There are no tests covering `SessionAdminPage`, `ScenarioRow`, `AvatarRow`, or the new admin API-client flows.
- Why it matters: The EPIC's user increment is a usable internal admin console. That promise is only weakly proven today. Regressions in edit/delete/reset interactions would not be caught by the current console suite.
- Evidence:
  - `apps/console/src/pages/SessionAdminPage.tsx` exists and is wired in `App.tsx`
  - `apps/console/src/pages/scenario-row.tsx` and `apps/console/src/pages/avatar-row.tsx` implement core admin interactions
  - console test files present are limited to `scenario-test-state.test.ts` and `session-state.test.ts`
- Recommendation: Add focused UI tests around the admin pages/components that prove the operator-observable behavior: edit success path, delete conflict message, session list filtering, and reset confirmation/error handling.

### Session List Contract Is Only Partially Proven at HTTP Level

- Severity: Medium
- Category: Test quality
- Problem: `GET /v1/sessions` is implemented and has basic tests, but the key EPIC behaviors at the contract boundary are not fully proven: ordering by recent activity and filter correctness are not validated through the HTTP surface.
- Why it matters: The EPIC explicitly calls out `list sessions ordered by recent activity`. Proving this only in lower-level tests is weaker than proving it on the actual API contract consumed by the console.
- Evidence:
  - `apps/core/src/api/routes/sessions.ts` maps query parameters to `ListSessionsUseCase`
  - `apps/core/src/api/routes/sessions-admin.stack-e2e.test.ts` checks auth, invalid status, empty list, not-found reset, and a basic reset happy path
  - No route/stack-e2e assertion verifies descending `lastActivityAt` order or that filters change the returned set correctly
- Recommendation: Add route-level or stack-e2e assertions that create multiple sessions with distinct `lastActivityAt`/status values and verify returned order and filter behavior through `GET /v1/sessions`.

### Console Session Types Drift From The API Contract

- Severity: Low
- Category: Documentation / contract fidelity
- Problem: The console-side `SessionSummary` type still exposes `availableAvatarIds?: string[]`, while the backend/session contract has moved to `unlockedAvatarIds?: string[]`.
- Why it matters: This does not break compilation because extra response fields are tolerated at runtime, but it weakens the API-first discipline the project is aiming for and increases the risk of future UI misunderstandings.
- Evidence:
  - `apps/console/src/api/sessions.ts` defines `SessionSummary` with `availableAvatarIds?: string[]`
  - `docs/API_CONTRACT.md` and backend types use `unlockedAvatarIds`
- Recommendation: Align the console `SessionSummary` type with the backend contract and remove legacy naming.

## Architecture Review

The implementation is structurally solid.

- API handlers are thin and focused on validation/error mapping.
- Application use cases own business rules for update/list/reset flows.
- Repositories remain behind explicit ports.
- No infrastructure or vendor-specific concerns leaked into domain logic for the audited slice.
- Console work remains in the console package and uses the HTTP client boundary rather than reaching into core internals.

The main architectural weakness is not boundary drift but incomplete orchestration of reset semantics. Reset is currently modeled as a pure session/conversation/message cleanup operation, but in this product the reset behavior also depends on scenario policy. That missing dependency is the root of the functional bug above.

## Test Review

Strong tests:

- Backend use-case tests for `UpdateScenarioUseCase`, `UpdateAvatarUseCase`, and `ResetSessionUseCase` cover happy paths and core failures.
- Stack-e2e tests exist for all newly introduced admin endpoints.
- Route tests around scenarios and avatars prove several consumer-visible behaviors rather than only mock interactions.

Weak tests:

- `ResetSessionUseCase` tests prove that conversations/messages are cleared, but do not prove that the reset session is still usable in an unlock-policy scenario.
- `GET /v1/sessions` tests do not fully prove ordering and filtering through the HTTP contract.

Missing tests:

- Console admin UI behavior tests for scenario edit/delete
- Console admin UI behavior tests for avatar edit/delete
- Console admin UI behavior tests for session list/filter/reset
- Reset-session behavior test for a scenario with `initialAvatarKeys`

Implementation-coupled tests:

- I did not find severe implementation-mirroring problems in the new backend tests. The larger gap is absence of consumer-level UI coverage, not over-coupling.

## Documentation Gaps

- `docs/PROJECT_STATUS.md` claims EPIC 2.5 is complete. Given the reset bug, that claim is ahead of reality.
- Console-side type drift (`availableAvatarIds` vs `unlockedAvatarIds`) weakens alignment with `docs/API_CONTRACT.md`.

## Path to A

Minimal steps needed to reach A:

1. Fix session reset so unlock-gated scenarios restore their initial unlocked avatar set rather than `[]`.
2. Add a regression test proving reset keeps AI Guided Discovery-style sessions usable after reset.
3. Add focused console UI tests for scenario edit/delete, avatar edit/delete, and session admin reset/filter behavior.
4. Add HTTP-level tests for `GET /v1/sessions` ordering and filtering.
5. Align console session types with the current API contract.

## Final Recommendation

- **Rework before close**

The EPIC is close, and the architecture/build health are solid, but one of the shipped operator-facing behaviors is wrong in unlock-gated scenarios. That is enough to hold back closure until fixed.
