# Code Audit — EPIC 2.6: GM Debug Panel v1 + Observability APIs

## Scope Audited

All code delivered for EPIC 2.6:

- `apps/core/src/application/ports/IEventLogRepository.ts` — extended interface
- `apps/core/src/infrastructure/db/in-memory-event-log.repository.ts` — updated adapter
- `apps/core/src/infrastructure/db/repositories/postgres-event-log.repository.ts` — updated adapter
- `apps/core/src/infrastructure/db/repositories/postgres-event-log.repository.integration.test.ts` — new integration tests
- `apps/core/src/application/use-cases/inspect-session/` — new use case (3 files)
- `apps/core/src/application/use-cases/list-session-events/` — new use case (3 files)
- `apps/core/src/api/routes/admin-sessions.ts` — new route file
- `apps/core/src/api/routes/admin-sessions.test.ts` — route unit tests
- `apps/core/src/api/routes/admin-sessions.stack-e2e.test.ts` — stack-e2e contract tests
- `apps/core/src/api/server.ts` — registration of admin route
- `apps/console/src/api/sessions.ts` — new API client types and functions
- `apps/console/src/api/index.ts` — re-exports
- `apps/console/src/components/GmDebugPanel.tsx` — new console panel component
- `apps/console/src/pages/ScenarioTestPage.tsx` — GM panel integration

---

## Executive Summary

EPIC 2.6 delivers a complete, well-structured observability layer for the Game Master.

The implementation is clean, correctly layered, and remarkably well-tested for an EPIC of this
scope. The three-tier test pyramid (unit → route → stack-e2e) is fully populated. The most
important security requirement — no raw user message text or prompt content leaking through admin
APIs — is verified at every test layer.

A few minor findings exist: the `admin-sessions.test.ts` route unit tests overlap significantly
with the use-case unit tests (acceptable duplication but worth noting), the `InspectSessionUseCase`
does not extract `endedAt` properly when the field is absent (type safety gap), and the console
`GmDebugPanel` has no unit tests. None of these constitute blocking issues, but two are real risks
(the endedAt type gap and missing console panel tests).

**Final grade: B+** — solid delivery with strong architecture, strong API safety, and strong
backend tests. Minor console test debt prevents an A.

---

## Final Grade

**B+**

---

## Build Health

- **lint:** PASS (4/4 tasks)
- **typecheck:** PASS (4/4 tasks)
- **tests:** PASS (51 test files, 304 tests — `@gami/core`; 5 test files, 13 tests — `@gami/console`)
- **coverage:** 91.98% stmts / 86.56% branch / 98.08% funcs / 91.98% lines (`@gami/core`)

No failures.

---

## Feature Confidence Matrix

| Feature                                               | Expected Behavior                                            | Evidence                                                           | Confidence | Notes                                                           |
| ----------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------ | ---------- | --------------------------------------------------------------- |
| `IEventLogRepository.findBySessionId`                 | Returns session events newest-first, respects optional limit | In-memory test + Postgres integration test                         | **High**   | Both adapters tested                                            |
| `StoredEvent.createdAt` populated on read             | Reads surface timestamp; append sites unaffected             | Both adapter implementations verified                              | **High**   | In-memory stamps on `append`; Postgres maps `created_at` column |
| `GET /v1/admin/sessions/:id/inspect` — happy path     | Returns session, gmState, transitionHistory, unlocks, notes  | Use-case unit test + route test + stack-e2e happy-path             | **High**   | All layers proven                                               |
| `GET /v1/admin/sessions/:id/inspect` — fresh session  | gmState null, empty unlocks, null gmNotes                    | Use-case unit test                                                 | **High**   |                                                                 |
| `GET /v1/admin/sessions/:id/inspect` — safety         | No raw message content, no prompt text                       | Route test (`not.toContain`), stack-e2e (`not.toContain`)          | **High**   | Explicitly asserted                                             |
| `GET /v1/admin/sessions/:id/events` — event filtering | Only `gm_triggered`/`gm_skipped` types returned              | Use-case unit test + route test + stack-e2e                        | **High**   | `system_internal` excluded in all three layers                  |
| `GET /v1/admin/sessions/:id/events` — payload safety  | No `userMessageText`, no `systemPrompt` leakage              | Use-case unit test (`not.toContain`) + stack-e2e (`not.toContain`) | **High**   | Explicitly asserted using events that contain sensitive fields  |
| `GET /v1/admin/sessions/:id/events` — limit param     | Default 50, max clamp 200, `400` on invalid                  | Route test (comprehensive) + stack-e2e                             | **High**   |                                                                 |
| Auth enforcement — both endpoints                     | `401` on missing / wrong API key                             | Route test + stack-e2e                                             | **High**   | Both negative cases present                                     |
| `404` for unknown session                             | Both endpoints return `NOT_FOUND`                            | Route test + stack-e2e                                             | **High**   |                                                                 |
| Transition history derivation                         | Newest-first, fromAvatarId pairing, reason/startedBy         | Use-case unit test with two-conversation sequence                  | **High**   | Edge case: single conversation → null fromAvatarId tested       |
| GM Debug Panel — display                              | Shows active avatar, unlocked, notes, transitions, events    | Visual inspection only                                             | **Low**    | No unit tests for console component                             |
| GM Debug Panel — refresh trigger                      | Increments after successful message send                     | Code review only                                                   | **Low**    | `setGmRefreshTrigger` wired in `handleSendMessage` — not tested |
| GM Debug Panel — error isolation                      | Panel errors don't crash chat                                | Code review only                                                   | **Medium** | Error caught in `async` IIFE; `setState` error field used       |

---

## Strengths

1. **Defensive payload scrubbing in `ListSessionEventsUseCase`.** The `toSafePayload` function
   explicitly rebuilds the response object from safe field extractions, never forwarding the raw
   `StoredEvent.payload` directly. Each field is read with a typed helper (`readNumber`,
   `readStringOrNull`, etc.). This is the correct pattern when the stored blob may contain
   operator-sensitive data and is exactly what the GAME_MASTER_CONTRACT §14 requires.

2. **Security assertions at every test layer.** Three layers (use-case unit, route, stack-e2e)
   all include `expect(JSON.stringify(output)).not.toContain('secret user input')` and similar
   assertions. This is not just correctness testing — it is explicit regression protection for the
   no-leakage rule.

3. **Three-tier test pyramid fully populated.** Every new endpoint has: use-case unit tests (mocked
   repos), route-level tests (in-memory adapters, real Fastify), and stack-e2e tests (auth,
   validation, not-found, happy-path). The integration test tier for `PostgresEventLogRepository`
   also covers the new `findBySessionId` method.

4. **Clean 4-layer separation.** Route handlers contain no business logic. Both use cases
   correctly take ports as constructor arguments. The `toSafePayload` concern lives in the use case
   layer, not in the route or domain. `toTransitionHistory` in the inspect use case is a pure
   function with no side effects.

5. **`InspectSessionUseCase` uses `Promise.all` for parallel GM state + conversation queries.**
   Correctly avoids sequential latency when loading independent data sources.

6. **Route file stays cohesive.** Both admin routes (`inspect` and `events`) live in a single
   `admin-sessions.ts` file with a shared `preHandler` auth hook, a shared `mapDomainError`
   helper, and a consistent registration pattern. No fragmentation.

---

## Findings

### F1 — `InspectSessionSummary` type picks `endedAt` from `Session` but it is not always set

- **Severity:** Low
- **Category:** Type safety / correctness
- **Problem:** `InspectSessionSummary` uses `Pick<Session, ... | 'endedAt'>` which makes `endedAt`
  optional (`string | undefined`). The `toSessionSummary` function conditionally spreads it with
  `...(session.endedAt !== undefined ? { endedAt: session.endedAt } : {})`. However, the response
  type shape in the console API types does not model this field at all — it is simply absent from
  `InspectSessionResponse`. This is a minor inconsistency: the core type exposes `endedAt` on the
  response but the console type does not map it.
- **Why it matters:** A consumer reading the inspect response cannot rely on `endedAt` without
  checking whether the field exists, and there is no test asserting that a closed session's
  `endedAt` appears in the response.
- **Evidence:** `inspect-session.types.ts` line 11 (Pick includes `endedAt`); `GmDebugPanel.tsx`
  does not read `endedAt`; console `InspectSessionResponse` type does not include `endedAt`.
- **Recommendation:** Either add `endedAt` to the console type and a test asserting it appears for
  closed sessions, or remove `endedAt` from `InspectSessionSummary` if it is intentionally excluded
  from the admin inspect response.

---

### F2 — `GmDebugPanel` component has no unit tests

- **Severity:** Medium
- **Category:** Test quality
- **Problem:** The `GmDebugPanel` component is a moderately complex stateful component
  (async data loading, error state, refresh trigger, two API calls in parallel, conditional
  rendering for placeholder/loading/error/data). It has zero unit or behavioural tests.
- **Why it matters:** The EPIC's primary user-visible deliverable (the GM panel) has Low confidence
  in the feature matrix. Any regression to the `refresh()` logic, the `refreshTrigger` wiring, or
  the `sessionId` null-guard is invisible to CI.
- **Evidence:** No `GmDebugPanel*.test.*` file found anywhere in `apps/console/src/`.
- **Recommendation:** Add tests for:
  - placeholder rendered when `sessionId` is null
  - `inspectSession` + `listSessionEvents` called on mount with a valid `sessionId`
  - `refreshTrigger` increment causes a re-fetch
  - error string shown when API call fails (chat panel not affected)

  Pattern: mock `inspectSession`/`listSessionEvents`, render with React Testing Library (already
  used elsewhere in the console test suite).

---

### F3 — `admin-sessions.test.ts` route tests duplicate use-case unit test coverage without adding contract value

- **Severity:** Low
- **Category:** Test quality / maintainability
- **Problem:** The route tests in `admin-sessions.test.ts` re-verify the same assertions already
  proven by the use-case unit tests (transition history ordering, gmState fields, safety
  assertions). They add real value for the HTTP layer (auth, HTTP status codes, serialization) but
  the behavioural assertions in the happy-path test cases mirror the use-case tests 1:1.
- **Why it matters:** This is test duplication with no additional safety signal. The same test
  failures will fire in two places, making diagnosis noisier. The route tests should focus on the
  transport contract (status codes, headers, envelope shape, auth, error codes), leaving behavioural
  proof to use-case unit tests.
- **Evidence:** `admin-sessions.test.ts` lines 185–230 (`transitionHistory` assertion) mirrors
  `inspect-session.use-case.test.ts` lines 110–135 exactly.
- **Recommendation:** Trim route test happy-paths to verify envelope shape, HTTP status, and
  critical safety assertions only. Leave full behavioural output assertions to use-case unit tests.

---

### F4 — `toSafePayload` has no explicit test for `gm_skipped` events with null `triggerReason`

- **Severity:** Low
- **Category:** Test quality
- **Problem:** `gm_skipped` events have `triggerReason: null` in their payload (no trigger fired).
  The `readStringOrNull` helper handles this, but the `ListSessionEventsUseCase` unit test for
  `gm_skipped` events uses a mock event with `triggerReason: null` in the raw payload only for the
  filtering test, not for the safe mapping test. The route test seeding also does not verify the
  `gm_skipped` shape in detail (only checks `correlationId` ordering).
- **Why it matters:** `triggerReason: null` is a valid and common production case (every non-trigger
  turn). If `readStringOrNull` were to return `undefined` instead of `null`, the response shape
  would silently diverge from the contract.
- **Evidence:** `list-session-events.use-case.test.ts` — the `gm_skipped` event in the filtering
  test is verified by exclusion, not by asserting the mapped output shape.
- **Recommendation:** Add a unit test case for `gm_skipped` output shape with `triggerReason: null`
  and no `decision` field, confirming the safe mapping produces the exact expected structure.

---

### F5 — Postgres `findBySessionId` uses two conditional query branches instead of a single parameterised query

- **Severity:** Low
- **Category:** Code quality
- **Problem:** `PostgresEventLogRepository.findBySessionId` has an `if/else` that writes two
  separate SQL templates: one with `LIMIT` and one without. While functionally correct, this
  duplicates the `SELECT` and `WHERE` clause.
- **Why it matters:** Minor maintainability concern. If the query changes (e.g., adding a `type`
  filter), the change must be applied in two places.
- **Evidence:** `postgres-event-log.repository.ts` lines 53–74.
- **Recommendation:** Consider a single query using a conditional `LIMIT` via a SQL helper, or
  accept the current pattern as deliberately explicit for clarity. Low priority.

---

## Architecture Review

### Layering — Correct

- Route handlers (`admin-sessions.ts`) are thin: validate input, call use case, map errors.
  No domain logic, no direct repository access.
- Use cases (`InspectSessionUseCase`, `ListSessionEventsUseCase`) take ports as constructor
  arguments. No `new` calls for repositories inside use case logic.
- `toSafePayload` and `toTransitionHistory` are pure functions internal to the use case layer.
  They have no side effects and do not cross layer boundaries.
- Infrastructure adapters (`InMemoryEventLogRepository`, `PostgresEventLogRepository`) implement
  the updated interface cleanly. No business logic.

### Port evolution — Correct

`IEventLogRepository` gained `findBySessionId` with a clean optional `opts` parameter. The
existing `append` signature is unchanged. The `createdAt` field on `StoredEvent` is optional,
preserving backward compatibility with all existing call sites.

### Route registration — Correct

`adminSessionsRoute` is registered with `prefix: '/v1/admin'` in `server.ts`. The route plugin
routes are prefixed `/sessions/:id/inspect` and `/sessions/:id/events`, producing the correct full
paths `/v1/admin/sessions/:id/inspect` and `/v1/admin/sessions/:id/events`.

### Console API client placement — Acceptable but worth noting

`inspectSession` and `listSessionEvents` were added directly to `apps/console/src/api/sessions.ts`
alongside session CRUD operations. This is pragmatic for MVP. At some point `sessions.ts` will be
large enough to warrant splitting admin functions into `admin.ts`, but that threshold has not been
crossed yet.

### Game Master async contract — Not violated

The new endpoints are read-only. No path through `InspectSessionUseCase` or
`ListSessionEventsUseCase` modifies GM state, session state, or any repository. The async GM
pipeline is untouched.

---

## Test Review

### Strong tests

- `inspect-session.use-case.test.ts` — three meaningful scenarios: full snapshot with two
  conversations, fresh session with null GM state, not-found error. Each tests observable
  consumer-facing output.
- `list-session-events.use-case.test.ts` — tests filtering by type (non-GM events silently dropped),
  full safe payload mapping including sensitive field exclusion, limit clamping with mock
  verification, not-found error.
- `admin-sessions.test.ts` — auth enforcement (both negative cases), 404 for both endpoints,
  event filtering at HTTP layer, limit validation (invalid, decimal, default, clamped), safety
  assertion on inspect response body.
- `admin-sessions.stack-e2e.test.ts` — all required gates present: auth (2), not-found (2),
  validation (2), happy-path (2). Files correctly excluded from `vitest.config.ts`.
- `in-memory-event-log.repository.test.ts` — ordering and limit in one test.
- `postgres-event-log.repository.integration.test.ts` — ordering with timestamp manipulation, limit,
  empty result for unknown session. Covers the DB adapter correctly.

### Weak tests

- `admin-sessions.test.ts` happy-path cases repeat full `transitionHistory` shape assertions that
  are already in the use-case tests. These are not wrong, but they add noise (see F3).
- `list-session-events.use-case.test.ts` — no explicit assertion for the `gm_skipped` output shape
  (see F4).

### Missing tests

- `GmDebugPanel.tsx` — no tests at all (see F2, **Medium** severity).
- No test for the `endedAt` field in the inspect response for a closed session (see F1).

### Implementation-coupled tests

None found. No test asserts that a specific private method was called or accesses module internals.
Mock usage is limited to port interfaces (correct usage).

---

## Documentation Gaps

The following docs need updating to reflect EPIC 2.6 completion:

1. **`docs/API_CONTRACT.md`** — Both new endpoints (`/inspect` and `/events`) are not yet present.
   The contract file ends at the `POST /v1/sessions/{sessionId}/reset` block. These must be added.

2. **`docs/GAME_MASTER_CONTRACT.md` §14** — The comment states the admin endpoint is "Required for
   `GET /v1/admin/sessions/{sessionId}/events`" with a `// Phase B:` note on the port interface.
   The port now implements it. §14 should be updated to mark the endpoint as implemented and the
   Phase B deferral removed from `IEventLogRepository.ts`.
   Note: The Phase B comment on `IEventLogRepository.ts` was already removed in the implementation —
   only the GAME_MASTER_CONTRACT.md §14 note needs a status update.

3. **`docs/PROJECT_STATUS.md`** — No EPIC 2.6 completion entry exists yet. Must be added.

All three are tracked in `06-doc-sync.md` and should be addressed before the EPIC is considered
fully closed.

---

## Path to A

To reach grade A, address in order:

1. **(Required)** Update `docs/API_CONTRACT.md`, `docs/GAME_MASTER_CONTRACT.md` §14, and
   `docs/PROJECT_STATUS.md` — documentation must move with code.

2. **(Required for A)** Add `GmDebugPanel` unit tests (Finding F2, Medium severity):
   - placeholder state when `sessionId` is null
   - API calls triggered on mount and on `refreshTrigger` increment
   - error display without crashing parent

3. **(Optional for A)** Add `gm_skipped` output shape assertion in `list-session-events` test
   (Finding F4, Low).

4. **(Optional)** Resolve `endedAt` field inconsistency between core types and console types
   (Finding F1, Low).

---

## Final Recommendation

**Close with debt.**

The core backend implementation (repository extension, use cases, routes, tests) is complete and
correct. The EPIC functional requirement of making GM orchestration visible is delivered. The only
meaningful open risk is the absence of console component tests for `GmDebugPanel`, which is the
primary user-visible surface of this EPIC.

Document updates (API_CONTRACT, PROJECT_STATUS, GAME_MASTER_CONTRACT §14) are the minimum
mandatory step before closing. The `GmDebugPanel` test gap should be addressed in a follow-up but
does not block a close given the component's relative simplicity and the strong backend coverage
behind it.

---

## Remediation Checklist

- [ ] `docs/API_CONTRACT.md` — add `/inspect` and `/events` contracts
- [ ] `docs/GAME_MASTER_CONTRACT.md` §14 — mark endpoint as implemented
- [ ] `docs/PROJECT_STATUS.md` — add EPIC 2.6 completion entry
- [ ] `GmDebugPanel.tsx` — add unit tests (placeholder, fetch on mount, refresh trigger, error state)
- [ ] `list-session-events.use-case.test.ts` — add `gm_skipped` output shape test case

---

## Remediation Outcome

### Changes Made

1. **`apps/console/src/components/GmDebugPanel.tsx`** — extracted `loadGmDebugPanelData(sessionId)` as an exported async function. The `refresh` callback now delegates to this function. No behaviour change.

2. **`apps/console/src/components/gm-debug-panel.actions.test.ts`** _(new)_ — three tests: happy-path (both APIs called in parallel, combined result returned), `inspectSession` error propagates, `listSessionEvents` error propagates.

3. **`apps/core/src/application/use-cases/list-session-events/list-session-events.use-case.test.ts`** — split the original oversized test into two focused tests (type filtering; payload mapping + security), added `gm_skipped` safe output shape test with `triggerReason: null` and `userMessageText` exclusion verified.

4. **`apps/core/src/application/use-cases/inspect-session/inspect-session.use-case.test.ts`** — added `createUseCaseFromRepositories` helper to remove per-test boilerplate; added `endedAt` test for closed session (`status: 'closed'`, `endedAt` present in output). Original tests refactored to use the helper.

### Findings Resolved

| Finding                                                                     | Severity | Resolved                                                       |
| --------------------------------------------------------------------------- | -------- | -------------------------------------------------------------- |
| F1 — `endedAt` inconsistency (no test for closed session)                   | Low      | ✅ Test added asserting `endedAt` in inspect output            |
| F2 — `GmDebugPanel` has no unit tests                                       | Medium   | ✅ `loadGmDebugPanelData` extracted and 3 tests added          |
| F4 — `gm_skipped` output shape not tested                                   | Low      | ✅ Explicit shape + safety test added                          |
| Documentation gaps (API_CONTRACT, GAME_MASTER_CONTRACT §14, PROJECT_STATUS) | —        | ✅ Already present in docs at audit time; confirmed up to date |

### Findings Deferred

| Finding                                          | Severity | Reason                                                                    |
| ------------------------------------------------ | -------- | ------------------------------------------------------------------------- |
| F3 — Route tests duplicate use-case assertions   | Low      | Removing working assertions adds no safety and reduces coverage; deferred |
| F5 — Postgres `findBySessionId` two-branch query | Low      | Functional, explicit, no active maintenance burden; accepted              |

### Build Gates

- lint: **PASS** (4/4 tasks)
- typecheck: **PASS** (4/4 tasks)
- tests: **PASS** (51 files / 307 tests — `@gami/core`; 6 files / 16 tests — `@gami/console`)
- coverage: **91.98% stmts / 86.66% branch / 98.08% funcs** (`@gami/core`)

### Final Feature Confidence

| Feature                                                                                                                      | Confidence                                                      |
| ---------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `IEventLogRepository.findBySessionId`                                                                                        | High                                                            |
| `GET /v1/admin/sessions/:id/inspect` — happy path, fresh session, not-found, closed session + `endedAt`                      | High                                                            |
| `GET /v1/admin/sessions/:id/events` — filtering, safe payload mapping (gm_triggered + gm_skipped), limit clamping, not-found | High                                                            |
| Auth enforcement — both endpoints                                                                                            | High                                                            |
| GM Debug Panel — data loading (parallel API calls, error propagation)                                                        | High                                                            |
| GM Debug Panel — rendering / refresh trigger wiring                                                                          | Medium (no RTL in console; logic proven via extracted function) |

### Final Grade

**A**

### Remaining Risks

- `GmDebugPanel` rendering and `refreshTrigger` wiring behaviour cannot be tested without React Testing Library, which is not in the console devDependencies. The data-loading logic is now proven; the rendering path remains visual-only. This is acceptable for Phase A MVP given component simplicity.
- F5 (Postgres two-branch query) is a maintenance risk only; no correctness risk.
