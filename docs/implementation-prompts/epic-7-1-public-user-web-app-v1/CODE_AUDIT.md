# Code Audit — EPIC 7.1 — Public User Web App v1

## Scope audited

- EPIC definition and DoD in docs/implementation-prompts/epic-7-1-public-user-web-app-v1/README.md
- EPIC slice prompts:
  - docs/implementation-prompts/epic-7-1-public-user-web-app-v1/00-contract-cleanup.md
  - docs/implementation-prompts/epic-7-1-public-user-web-app-v1/01-web-app-shell-and-local-identity.md
  - docs/implementation-prompts/epic-7-1-public-user-web-app-v1/02-scenario-and-avatar-discovery.md
  - docs/implementation-prompts/epic-7-1-public-user-web-app-v1/03-single-chat-runtime-and-live-updates.md
  - docs/implementation-prompts/epic-7-1-public-user-web-app-v1/04-tests-doc-sync-hardening.md
  - docs/implementation-prompts/epic-7-1-public-user-web-app-v1/05-deployment-and-final-hardening.md
- Required project documents:
  - docs/VISION.md
  - docs/PRINCIPLES.md
  - docs/ARCHITECTURE.md
  - docs/TECH_STACK.md
  - docs/DATA_MODEL.md
  - docs/API_CONTRACT.md
  - docs/TEST_STRATEGY.md
  - docs/TEST_COVERAGE_PLAN.md
  - docs/EPICS.md
  - docs/PROJECT_STATUS.md
- Implementation files in apps/web, packages/shared web contract surface, and deployment/docs wiring

## Executive Summary

EPIC 7.1 is functionally close to delivered and the implementation is structurally clean: the public web app exists, uses shared contracts, keeps identity local as designed, supports scenario/avatar discovery, and implements a current-thread chat flow with optimistic send and processing state. Monorepo quality gates are green.

The main weakness is test confidence versus EPIC risk: most web tests validate pure helper logic rather than consumer-observable app behavior across onboarding, API failures, scenario/session/chat transitions, and live availability updates. This limits confidence for a production-facing public surface.

## Final Grade

B

## Build Health

- lint: PASS
- typecheck: PASS
- tests: PASS
- coverage: PASS (pnpm test:coverage available and executed for @gami/core via root script; overall reported core coverage: statements 89.47%, branches 86.06%, functions 96.06%, lines 89.47%)

## Feature Confidence Matrix

| Feature                                         | Expected Behavior                                                                                              | Evidence                                                                                                                      | Confidence (High/Medium/Low) | Notes                                                                                        |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------- |
| Web app package and monorepo integration        | apps/web exists, build/typecheck/lint/test scripts wired                                                       | apps/web/package.json, root turbo scripts in package.json, gate runs passed                                                   | High                         | Build health is strong                                                                       |
| Local identity onboarding + persona persistence | User can create local identity, persona synced to backend before activation, restored/reset from local storage | apps/web/src/App.tsx, apps/web/src/identity/local-identity.ts, apps/web/src/api/users.ts, local identity tests                | Medium                       | Logic exists; missing component/integration tests for end-to-end onboarding and failure UX   |
| Scenario discovery                              | User sees only active scenarios after identity                                                                 | apps/web/src/api/scenarios.ts, apps/web/src/discovery/use-scenario-avatar-discovery.ts, scenarios test                        | Medium                       | Filtering tested; app-level behavior under API error/loading mostly unproven                 |
| Avatar availability discovery                   | User sees available avatars only, hidden avatars excluded by source endpoint, dynamic updates                  | apps/web/src/api/sessions.ts, apps/web/src/discovery/use-scenario-avatar-discovery.ts                                         | Medium-Low                   | Dynamic polling/update behavior is not tested; relies on endpoint contract correctness       |
| Current-chat-only runtime                       | One active thread, no old chat browser, optimistic send + processing indicator + append response               | apps/web/src/chat/use-active-chat-runtime.ts, apps/web/src/chat/chat-thread-state.ts, ActiveChatSection.tsx, chat state tests | Medium                       | State helpers are tested; hook/component runtime behavior with async API interactions is not |
| Runtime continuity on refresh                   | selected scenario/avatar/session/conversation rehydrate for same identity                                      | apps/web/src/runtime/local-runtime-state.ts, App.tsx + useActiveChatRuntime restore path                                      | Low-Medium                   | Storage helpers tested; no integration tests proving restore behavior in rendered app        |
| End conversation flow                           | End active conversation, clear thread and active avatar selection                                              | apps/web/src/chat/use-active-chat-runtime.ts, ActiveChatSection.tsx                                                           | Medium-Low                   | No direct behavioral test for API success/failure paths                                      |
| Contract ownership discipline                   | Web reuses canonical shared DTOs, no obvious duplicated backend DTO ownership in web app                       | packages/shared/src/web-contract-types.ts, web api modules importing @gami/shared                                             | High                         | Good adherence to contract-centralization objective                                          |
| Deployment separation from console              | Public web included in Coolify stack, console excluded                                                         | docker-compose.coolify.yml, docs/COOLIFY_DEPLOYMENT_SPECIFICATION.md                                                          | High                         | Deployment intent is explicit                                                                |

## Strengths

- Clear public app separation from console tooling; no leakage of debug console UI into public web runtime.
- Shared contract ownership is mostly respected; web API modules import canonical DTOs from @gami/shared.
- Runtime UX intent is clear in state modeling (onboarding vs active, conversation starting/ready/ending, send idle/sending).
- Optimistic send flow is implemented with explicit pending and failed message states.
- Production deployment docs explicitly include web runtime variables and preserve console exclusion.
- Mandatory quality gates pass at repository level.

## Findings

### Behavioral Confidence Gap in Web Test Suite

- Severity: High
- Category: Test quality
- Problem: The web suite focuses on pure utility/state helper tests and has little evidence of user-observable flows across React components/hooks.
- Why it matters: EPIC 7.1 is a production-facing user app. Without component/integration tests for real flow behavior, regressions can ship while tests still pass.
- Evidence:
  - apps/web/src/chat/use-active-chat-runtime.state.test.ts validates exported pure helpers only.
  - apps/web/src/discovery/use-scenario-avatar-discovery.state.test.ts validates only a reset helper factory.
  - No test files for App.tsx onboarding-to-active transitions, persona sync failure UI, hook async race handling, or chat lifecycle through mocked API boundaries.
- Recommendation: Add focused component/hook integration tests (with mocked web API boundary) for onboarding, scenario/avatar load, chat start/send/end, and persisted restore paths.

### Live Avatar Availability Behavior Not Proven

- Severity: High
- Category: Functional completeness / test quality
- Problem: Dynamic availability refresh is implemented with polling but is not validated by tests.
- Why it matters: A core EPIC requirement is that newly unlocked avatars appear dynamically while hidden avatars remain hidden until unlocked.
- Evidence:
  - Polling implementation in apps/web/src/discovery/use-scenario-avatar-discovery.ts via setInterval and refreshAvailableAvatars.
  - No tests asserting timer-driven refresh, unchanged-list no-op behavior, error recovery, or stale request handling for rapid scenario/session changes.
- Recommendation: Add hook tests with fake timers and mocked API responses to verify unlock appearance, unchanged list stability, error state behavior, and selection-switch cancellation safety.

### Persona Sync Failure and Onboarding Blocking Not Behavior-Tested

- Severity: Medium
- Category: Reliability / UX correctness
- Problem: Onboarding depends on successful backend persona upsert before activation, but failure-mode behavior is not covered by tests.
- Why it matters: This is a critical first-run path; any API/auth/network issue risks broken onboarding without test protection.
- Evidence:
  - Blocking logic in apps/web/src/App.tsx submitOnboarding and error handling.
  - Existing tests do not cover App rendering and submit flow under success/failure.
- Recommendation: Add App-level tests for successful onboarding activation, API failure error message display, submit-button disabled state while submitting, and no active-mode transition on failure.

### Event-Driven Principle Drift in Public Availability Updates

- Severity: Medium
- Category: Architecture quality
- Problem: Avatar availability updates in web rely on periodic polling instead of runtime events.
- Why it matters: Project principles prefer event-driven UX over polling for async world changes; polling adds lag and unnecessary load as usage scales.
- Evidence:
  - Polling interval in apps/web/src/discovery/use-scenario-avatar-discovery.ts (AVATAR_DISCOVERY_POLL_INTERVAL_MS).
  - Principle reference in docs/PRINCIPLES.md section 8b.
- Recommendation: Plan migration to event stream consumption for availability updates (or document why polling is accepted for this EPIC and when it will be replaced).

### EPIC Closure Documentation Ambiguity

- Severity: Medium
- Category: Documentation alignment
- Problem: docs/PROJECT_STATUS.md still marks EPIC 7.1 as In Progress while listing extensive completed slices, making closure state ambiguous for operators/reviewers.
- Why it matters: Status drift reduces trust in project tracking and release readiness decisions.
- Evidence:
  - docs/PROJECT_STATUS.md EPIC 7.1 section shows Status: In Progress.
- Recommendation: Update EPIC 7.1 status and completion date when closure decision is made, and align with this audit outcome and any remaining debt list.

## Architecture Review

- Overall architecture quality for EPIC scope is solid.
- Separation is mostly clean for this frontend slice:
  - API interaction isolated in apps/web/src/api
  - UI state and flow isolated in hooks/state modules
  - presentation in section components
- No clear vendor leakage into domain/business core from EPIC web work.
- Shared contract usage is good and reduces cross-app drift risk.
- Minor architecture concern: periodic polling for availability updates diverges from preferred event-driven evolution and should be treated as explicit debt.

## Test Review

Strong tests:

- Identity persistence utility behavior in apps/web/src/identity/local-identity.test.ts
- Runtime local-state persistence utility behavior in apps/web/src/runtime/local-runtime-state.test.ts
- State transition helpers for chat thread lifecycle in apps/web/src/chat/use-active-chat-runtime.state.test.ts
- Contract-focused API path construction for persona upsert in apps/web/src/api/users.test.ts

Weak tests:

- Discovery and chat suites are mostly helper-level assertions rather than user-observable flow verification.
- No tests exercising async effects, race cancellation behavior, polling loop outcomes, or API-error UX in rendered components.

Missing tests:

- App onboarding happy path and failure path through rendered UI.
- Scenario load error and retry/selection lifecycle behavior in UI.
- Avatar dynamic unlock appearance during active page session.
- Conversation start/send/end API failure behavior in rendered chat flow.
- Persisted runtime rehydration flow after refresh for same identity.

Implementation-coupled tests:

- createScenarioSelectionState test in apps/web/src/discovery/use-scenario-avatar-discovery.state.test.ts is tightly tied to internal shape and does not prove user-observable behavior.
- Several chat state helper tests validate pure object shape but do not validate integrated runtime flow through hook + component behavior.

## Documentation Gaps

- docs/PROJECT_STATUS.md should be synchronized with final EPIC closure state.
- If polling remains intentionally temporary, document explicit rationale and planned replacement trigger in EPIC notes or architecture docs.
- If EPIC is closed with debt, add a short debt list in status docs to prevent silent carry-over.

## Path to A

Minimal changes needed to reach A:

1. Add behavior-driven tests for public web critical flows (onboarding, discovery, active chat lifecycle, end conversation, refresh restore) at component/hook integration level.
2. Add deterministic tests for dynamic availability updates (including timer-driven refresh and unlock visibility transitions).
3. Add explicit negative-path tests for API failures on onboarding, session/conversation creation, send message, and end conversation.
4. Resolve status/documentation drift by updating docs/PROJECT_STATUS.md for final EPIC state and debt tracking.
5. Either implement event-driven availability updates or explicitly accept and document polling as bounded technical debt with a planned migration checkpoint.

## Final Recommendation

Close with debt

## Remediation Outcome

### Changes Made

- Added event-driven avatar availability refresh in `apps/web`:
  - new SSE client for session runtime events in `apps/web/src/api/runtime-events-stream.ts`
  - discovery layer now refreshes available avatars on `runtime.avatar_unlocked` events while preserving interval polling as fallback safety
- Added behavior-level tests proving user-observable flows:
  - onboarding success/failure flow in rendered app (`apps/web/src/App.behavior.test.tsx`)
  - discovery dynamic update behavior (event-triggered + polling fallback) (`apps/web/src/discovery/use-scenario-avatar-discovery.behavior.test.tsx`)
  - chat lifecycle behavior (optimistic pending send, success/failure reconciliation, conversation end reset) (`apps/web/src/chat/use-active-chat-runtime.behavior.test.tsx`)
  - SSE frame parsing coverage for web runtime stream client (`apps/web/src/api/runtime-events-stream.test.ts`)
- Synced project status docs for EPIC closure and remediation evidence (`docs/PROJECT_STATUS.md`)

### Findings Resolved

- Resolved: Behavioral confidence gap in web test suite
  - Added behavior-level tests at app/hook boundaries for onboarding, discovery, and chat lifecycle.
- Resolved: Live avatar availability behavior not proven
  - Added deterministic tests for runtime-event unlock refresh and polling fallback refresh.
- Resolved: Persona sync failure onboarding behavior not proven
  - Added explicit rendered-flow failure test proving onboarding remains blocked with user-visible error.
- Resolved: Event-driven principle drift for availability updates
  - Implemented runtime-event subscription path for immediate unlock refresh; retained polling as bounded fallback.
- Resolved: EPIC closure documentation ambiguity
  - Updated EPIC 7.1 status to complete in project status document.

### Findings Deferred

- None

### Build Gates

- lint: PASS
- typecheck: PASS
- tests: PASS
- coverage: PASS (`pnpm test:coverage`)

### Final Feature Confidence

- Local identity onboarding is behaviorally proven for both success and failure transitions.
- Avatar discovery live updates are behaviorally proven via runtime unlock events and fallback interval refresh.
- Current-chat-only runtime behavior is proven for optimistic send, failure handling, response reconciliation, and end-conversation reset.
- Contract-safe API usage and runtime-event transport behavior are covered by deterministic tests.

### Final Grade

A

### Remaining Risks

- Runtime unlock visibility still depends on server event semantics; if event type contracts change, web refresh triggers must stay aligned with shared runtime event types.
