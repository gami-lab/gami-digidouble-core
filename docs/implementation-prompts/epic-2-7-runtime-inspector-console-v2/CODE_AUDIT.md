# EPIC 2.7 Code Audit

Date: 2026-05-07
Scope: Runtime Inspector Contract Cleanup, query composition, assembled context API, admin runtime actions, console inspector v2

## Final Grade

B+

Rationale: Core EPIC objectives are implemented and validated by passing lint/typecheck/test/coverage gates and broad route/stack coverage. Grade is held below A due to one contract-doc drift, one response-semantics bug risk, missing use-case-level tests for a central action orchestrator, UI maintainability/testability debt, and a non-clean lint warning.

## Build Health

Mandatory gates were executed on current HEAD:

- pnpm lint: PASS (with 1 warning)
- pnpm typecheck: PASS
- pnpm test: PASS
- pnpm test:coverage: PASS

Coverage snapshot from run:

- Core all-files coverage: 91.59% statements, 86.16% branches, 97.91% functions, 91.59% lines

Build-health verdict: Good and releasable for dev/internal usage, but not fully clean due to lint warning.

## Feature Confidence Matrix

| Area                                         |  Confidence | Evidence                                                                                                       |
| -------------------------------------------- | ----------: | -------------------------------------------------------------------------------------------------------------- |
| Shared runtime-inspector DTO ownership       |        High | Canonical types centralized in packages/shared/src/runtime-inspector-types.ts and consumed across core/console |
| Console query composition over existing APIs |        High | loadRuntimeInspectorViewModel composes inspect/runtime/memory/layers/metrics/persona/events/context with tests |
| Assembled context API                        |        High | Route + use-case + unit route tests + stack-e2e auth/not-found/happy-path                                      |
| Admin runtime actions + audit trail          | Medium-High | Route and stack-e2e pass; append-only admin_action events present                                              |
| Console Runtime Inspector v2 UX/testability  |      Medium | Works functionally, but complexity suppressions and lack of component-level tests increase regression risk     |
| Docs/contract consistency                    |      Medium | New sections present, but one stale endpoint remains documented                                                |

## Findings

### 1) Stale API contract advertises non-existent endpoint

- Severity: High
- Category: Documentation/API Contract Drift
- Evidence:
  - docs/API_CONTRACT.md documents POST /v1/admin/sessions/{sessionId}/replay-last-turn at line 1911.
  - No corresponding route implementation exists in apps/core/src.
- Impact:
  - Contract consumers can implement against an endpoint that does not exist.
  - Weakens source-of-truth reliability for operators and clients.
- Recommendation:
  - Remove or clearly deprecate the A9 replay-last-turn section, or implement the endpoint if still required.
  - Keep only one authoritative runtime-action surface (A9b) to avoid ambiguity.

### 2) clearMemory cleared-flags can over-report success when fields are already null

- Severity: Medium
- Category: Behavioral Correctness
- Evidence:
  - apps/core/src/application/use-cases/admin-runtime-actions/admin-runtime-actions.use-case.ts:147 computes gmNotesCleared via session.gmNotes !== undefined.
  - apps/core/src/application/use-cases/admin-runtime-actions/admin-runtime-actions.use-case.ts:148 computes legacySessionSummaryCleared via session.memorySummary !== undefined.
- Impact:
  - If values are already null, response can still report cleared=true, reducing operational trust in action result semantics.
- Recommendation:
  - Compute cleared flags using pre-state value checks against nullish content intent (for example non-null and non-empty where applicable), then add explicit tests for null/undefined/pre-cleared states.

### 3) Missing use-case unit tests for AdminRuntimeActionsUseCase

- Severity: Medium
- Category: Test Coverage / Regression Risk
- Evidence:
  - apps/core/src/application/use-cases/admin-runtime-actions/admin-runtime-actions.use-case.ts exists.
  - No matching apps/core/src/application/use-cases/admin-runtime-actions/\*.test.ts file is present.
  - Coverage currently relies on route-level and stack-e2e tests.
- Impact:
  - Harder to validate edge branches deterministically (dependency unavailable, conversation fallback ordering, user-turn preconditions, audit payload details).
- Recommendation:
  - Add focused use-case unit tests for replay/refresh/clear branches and domain-error mappings independent of Fastify wiring.

### 4) Runtime inspector UI has acknowledged complexity without component behavior tests

- Severity: Medium
- Category: Maintainability / Frontend Testability
- Evidence:
  - apps/console/src/components/RuntimeInspector.tsx:87 has max-lines-per-function suppression.
  - apps/console/src/components/RuntimeInspector.tsx:208 has max-lines-per-function and complexity suppression.
  - Current tests focus API adapters; no component test file for RuntimeInspector tab/action/persona flows is present.
- Impact:
  - UI regressions in tab rendering, action-state handling, and persona form behavior are more likely during future changes.
- Recommendation:
  - Split RuntimeInspector into smaller tab components/hooks and add component tests for critical operator workflows.

### 5) Lint gate passes with warning (not warning-clean)

- Severity: Low
- Category: Tooling Hygiene
- Evidence:
  - apps/console/src/api/sessions.runtime-inspector-actions.test.ts:23 contains an unused eslint-disable directive.
- Impact:
  - Minor signal that guardrails are not fully clean; can hide future real lint regressions in CI noise.
- Recommendation:
  - Remove the unused disable and keep lint warnings at zero.

## Path To A

1. Fix contract drift by deleting or reconciling A9 replay-last-turn docs with implemented routes.
2. Correct clearMemory cleared-flag semantics and add direct tests for null/undefined/pre-cleared states.
3. Add unit tests for AdminRuntimeActionsUseCase branches and audit payload integrity.
4. Refactor RuntimeInspector into smaller components and add component tests for tabs/actions/persona workflows.
5. Remove lint warning and enforce warning-clean lint in CI for this slice.

## Final Recommendation

Proceed with EPIC 2.7 as functionally complete and stable for internal/dev usage. Do not classify as A-grade done until the five findings above are closed, with priority on contract drift and clearMemory response correctness.
