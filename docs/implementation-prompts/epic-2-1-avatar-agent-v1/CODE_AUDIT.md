# Code Audit — EPIC 2.1: Avatar Agent v1

## Scope audited

- **EPIC folder:** `docs/implementation-prompts/epic-2-1-avatar-agent-v1/`
- **README summary:** Build the first believable conversational entity — persona-driven prompt assembly, multi-turn history, `SendMessageUseCase`, `POST /v1/conversations/:sessionId/messages` route, unit and API tests, doc sync.
- **Main code areas inspected:**
  - `apps/core/src/domain/avatar/avatar.types.ts`
  - `apps/core/src/domain/avatar/persona-prompt.service.ts`
  - `apps/core/src/domain/avatar/persona-prompt.service.test.ts`
  - `apps/core/src/domain/avatar/avatar.fixtures.ts`
  - `apps/core/src/domain/conversation/session.types.ts`
  - `apps/core/src/domain/errors.ts`
  - `apps/core/src/application/ports/IAvatarRepository.ts`
  - `apps/core/src/application/use-cases/send-message/send-message.types.ts`
  - `apps/core/src/application/use-cases/send-message/send-message.use-case.ts`
  - `apps/core/src/application/use-cases/send-message/send-message.use-case.test.ts`
  - `apps/core/src/infrastructure/db/in-memory-avatar.repository.ts`
  - `apps/core/src/infrastructure/db/in-memory-avatar.repository.test.ts`
  - `apps/core/src/api/routes/messages.ts`
  - `apps/core/src/api/routes/messages.test.ts`
  - `apps/core/src/api/server.ts`

---

## Overall grade

**Grade: B**

The EPIC delivers a clean, well-structured Avatar persona pipeline. The domain model is properly layered, the use case is readable and well-tested against its contracts, and the API route handles error mapping and auth correctly. There are no structural or architectural violations. The main weaknesses are: a magic config key (`personaAdjustments`) with no TypeScript contract; redundant double-limit application on history; a hardcoded style rule that belongs in config not the domain; and a second HTTP round-trip to the session repository inside the route handler that could be eliminated. None of these are blockers; the implementation is safe to build on.

---

## Executive summary

EPIC 2.1 is a solid foundation. The persona prompt assembly is deterministic, properly separated in the domain layer, and the dedup logic for the avatar's name is a good defensive touch. The `SendMessageUseCase` correctly orchestrates the full turn: load session and avatar, assemble prompt, fetch history, persist user message, call LLM, persist avatar message, fire observability non-blocking. All critical error cases are handled and mapped to appropriate HTTP status codes in the route. Testing is strong at the unit and integration levels.

The two most important weaknesses are: (1) the `personaAdjustments` key read from an untyped `Record<string, unknown>` `config` field — this is a hidden contract that TypeScript cannot enforce; and (2) the route does a second database read (`getSessionOrThrow`) after the use case already loaded the session, to enrich the response — this is wasteful and adds latency with no benefit if the use case output included the session fields needed. Both are fixable without architectural change.

A minor concern: `nowIso()` and `createMessageId()` are private instance methods on `SendMessageUseCase` but are stateless pure functions. This creates a gap in deterministic testability for assertions on exact `createdAt` or `messageId` values (tests currently rely on the field being present as a `string`, not on its specific value — acceptable for now, but worth noting for future needs).

The EPIC is safe to close and build upon.

---

## What is strong

- **Layer discipline is clean.** Domain types and services are framework-agnostic; the application layer depends only on ports; infrastructure implements the ports; the API layer wires them together. No cross-layer leakage was found.
- **`assemblePersonaPrompt` is deterministic and well-tested.** Section ordering is explicit, name dedup uses a correct regex-escape helper, and the function throws for empty `personaPrompt` rather than silently producing a broken prompt.
- **`DomainError` is used consistently.** `NOT_FOUND`, `CONFLICT`, and `INVALID_INPUT` are thrown from the right places and mapped to correct HTTP status codes (`404`, `409`, `400`) at the route boundary.
- **Non-blocking observability is correctly implemented.** `traceNonBlocking` uses `void promise.catch(...)` — correct pattern. Errors are logged but do not fail the user-facing response.
- **Test quality is high.** Use case tests are consumer-contract tests, not implementation mirrors. The 3-turn sequential smoke test in `messages.test.ts` verifies real multi-turn accumulation through the full stack. Fixtures use overrides factories. `expectConsoleError` utility handles noisy error output cleanly.
- **Input validation is complete at the right boundary.** The route applies a JSON Schema for the body (`minLength`, `additionalProperties: false`), and the use case re-validates its own input independently — double firewall with no overlap issue.
- **The `EPIC 2.2` extension point comment** in `persona-prompt.service.ts` correctly marks where GM directives inject, readable to any future implementer.
- **`InMemoryAvatarRepository` is minimal and correct.** Two lines of logic, proper port implementation, tested with a dedicated test file.

---

## Findings

### F1 — `personaAdjustments` magic key reads from untyped `config`

- **Severity:** Medium
- **Category:** Contract / Maintainability
- **Problem:** `buildConfigAdjustments` reads `config.personaAdjustments` from `AvatarConfig.config: Record<string, unknown>`. There is no TypeScript contract specifying what keys `config` may contain. Any caller that sets `config.personaAdjustments` is working with an implicit, unverified convention.
- **Why it matters:** Silent breakage. If a consumer spells the key differently (`persona_adjustments`, `adjustments`) or puts the wrong type in, the runtime silently returns `[]` (empty adjustments), producing a less personalized prompt with no error or warning. The only defense is the `Array.isArray` guard and `typeof string` filter, which prevent crashes but not silent degradation.
- **Evidence:** `persona-prompt.service.ts` — `buildConfigAdjustments(config.config)`, reading `config.personaAdjustments` without any schema. `avatar.types.ts` — `config: Record<string, unknown>` with no further structure.
- **Recommendation:** Define a typed `AvatarConfigExtras` interface (or inline type) specifying the known optional keys that `config` may contain, and narrow `AvatarConfig.config` accordingly. Alternatively, lift `personaAdjustments` out of the generic `config` bag and into a first-class field `adjustments?: string[]` on `AvatarConfig`. Either approach restores TypeScript enforceability at zero runtime cost.

---

### F2 — Redundant double-limit application on message history

- **Severity:** Low
- **Category:** Code Smell / Performance
- **Problem:** In `SendMessageUseCase.buildHistoryMessages`, the code calls `findBySessionId(sessionId, { limit: MESSAGE_HISTORY_LIMIT })` and then immediately calls `.slice(-MESSAGE_HISTORY_LIMIT)` on the returned array. If the repository respects the `limit` option, the slice is always a no-op. If the repository ignores `limit`, the slice is the only safeguard — but then the `limit` option is misleading.
- **Why it matters:** The redundancy signals unclear ownership of the truncation concern. It also misleads readers about the intent: is the repository expected to truncate or not? The current `InMemoryMessageRepository` does respect the limit, making the slice provably redundant.
- **Evidence:** `send-message.use-case.ts` lines using `{ limit: MESSAGE_HISTORY_LIMIT }` and `.slice(-MESSAGE_HISTORY_LIMIT)`. The test "truncates history to the 20 most recent items" verifies both `findBySessionIdMock` was called with `{ limit: 20 }` and checks the LLM receives 20 items — but the test setup provides 25 items and the mock does not actually apply the limit (it returns all 25), so the `.slice(-20)` is what protects the test. This reveals that the test proves the slice is the real guard, and the `limit` option on the repository call is aspirational.
- **Recommendation:** Decide who owns truncation. Option A: the repository contract guarantees it applies the limit; remove the `.slice`. Option B: the use case owns truncation; remove the `limit` option from the repository call to avoid confusion. Option A is architecturally cleaner (the repository knows the storage engine). Document the chosen convention in the port's JSDoc.

---

### F3 — Route performs a second database read to build the response

- **Severity:** Low
- **Category:** Performance / Code Smell
- **Problem:** After `useCase.execute()` completes successfully, the route calls `getSessionOrThrow(deps.sessionRepository, output.sessionId)` to fetch the session again from the repository. This is done to include `session.userId`, `session.scenarioId`, and `session.status` in the response. The session was already loaded by the use case as part of `loadActiveSession`, but that data is not propagated through `SendMessageOutput`.
- **Why it matters:** An extra read per request (even to an in-memory store for now; to a real DB later) with no functional benefit. The session data returned in the response was already in memory during use case execution.
- **Evidence:** `messages.ts` — `getSessionOrThrow` call after `useCase.execute()`; `send-message.types.ts` — `SendMessageOutput` does not include session fields.
- **Recommendation:** Extend `SendMessageOutput` to include the session fields needed by the response (`userId`, `scenarioId`, `status`, `startedAt`, `lastActivityAt`), eliminating the second read. This is a small types change and a one-line addition to the use case's return value.

---

### F4 — `nowIso()` and `createMessageId()` as private instance methods reduce deterministic testability

- **Severity:** Low
- **Category:** Maintainability / Testing
- **Problem:** `nowIso()` and `createMessageId()` are private instance methods on `SendMessageUseCase`, but they have no dependency on instance state — they are pure utility functions. They cannot be injected or overridden in tests, so tests cannot assert on the exact `messageId` or `createdAt` values of persisted messages; instead they assert on shape (`typeof string`) or ignore the values. This is acceptable now, but becomes a friction point if exact-value assertions are needed (e.g., for deterministic snapshot tests, audit trails, or message dedup checks).
- **Evidence:** `send-message.use-case.ts` — `createMessageId` calls `crypto.randomUUID()`, `nowIso` calls `new Date().toISOString()`. No tests assert a specific `messageId` or `createdAt` on saved messages.
- **Recommendation:** Extract these as injectable dependencies (a `Clock` interface or a simple `{ now(): Date; uuid(): string }` utility injected via constructor). This is a small change, keeps strict mode happy, and makes the use case fully deterministic in tests. This is a "should do" improvement, not blocking for EPIC 2.1 close.

---

### F5 — `DEFAULT_STYLE_RULE` hardcoded in the domain service

- **Severity:** Low
- **Category:** Maintainability / Architecture
- **Problem:** `'Stay in character and keep responses concise.'` is a hardcoded string constant in the domain service. Every avatar, regardless of its `AvatarConfig`, receives this rule unconditionally. This couples the domain to one product team's opinion about what all avatars should say.
- **Why it matters:** When Phase B introduces multi-tenant scenarios with different style requirements, this becomes a configuration override problem. Changing it requires a code deploy.
- **Evidence:** `persona-prompt.service.ts` — `const DEFAULT_STYLE_RULE = 'Stay in character and keep responses concise.'`, unconditionally pushed into every assembled prompt.
- **Recommendation:** Make it configurable via `AvatarConfig` — either a `styleRule?: string` field with the current string as the default when absent, or as a member of the `personaAdjustments` array. This requires a one-field addition to the config type and a trivial fallback in the service. Not a must-fix for EPIC 2.1, but worth tracking.

---

### F6 — Route construction duplicates dependency wiring that already exists in `server.ts`

- **Severity:** Low
- **Category:** Maintainability / Architecture
- **Problem:** `messages.ts` has its own `createRouteDependencies` factory that creates LLM adapters, observability adapters, repositories, and the use case. `server.ts` already accepts `ServerAdapters` and passes them through. The route's fallback creation path duplicates the wiring logic pattern, creating two places that must be kept in sync when a new adapter is added.
- **Why it matters:** When a new port is added (e.g., a `IKnowledgeRepository`), a developer must update both `server.ts` adapter plumbing and the per-route `createRouteDependencies` — which is easy to miss. The `exchange.ts` route follows the same pattern, so this is a systemic issue that compounds with each route.
- **Evidence:** `messages.ts` — `createDefaultAvatarRepository`, `createDefaultSessionRepository` create hardcoded demo fixtures as production defaults, which is particularly concerning: these are effectively hardcoded test stubs exposed in the production default path.
- **Recommendation:** Move use case construction out of route plugins and into `server.ts` or a dedicated composition root. Each route should receive an already-constructed use case as an option, not build its own. The `createDefault*` repository functions with demo data should be removed from the production code path: a missing configuration should result in a startup error, not silent use of demo data.

---

### F7 — Demo/fixture data in production route fallbacks

- **Severity:** Medium
- **Category:** Security / Maintainability
- **Problem:** `createDefaultAvatarRepository()` and `createDefaultSessionRepository()` in `messages.ts` provide hardcoded demo avatars and sessions (`ava_demo`, `sess_demo`) as the default production fallback when no adapters are injected. Any unauthenticated deployment that does not configure these adapters will serve real requests against demo data without any error or configuration warning.
- **Why it matters:** This is a misconfiguration hazard. A production deployment where the avatar/session adapter is accidentally not passed will silently serve demo content instead of erroring on startup. This violates the "fail fast at startup" principle and could expose unintended behavior to end users.
- **Evidence:** `messages.ts` — `createDefaultAvatarRepository()` hardcodes `ava_demo` avatar with `'You are a helpful assistant.'` persona; `createDefaultSessionRepository()` hardcodes `sess_demo` with `userId: 'user_demo'`.
- **Recommendation:** Remove the hardcoded demo fallbacks entirely. If adapters are not provided via options, throw a startup error (`Error('AvatarRepository must be provided')`). Demo data belongs in test fixtures and integration test helpers, not in production route construction code.

---

## Architecture alignment review

| Dimension                                            | Assessment                                                                                                                                                                                                                                            |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Modular monolith boundaries**                      | ✅ Clean. Domain, application, infrastructure, and API are in separate directories with clear dependency direction. No cross-layer shortcuts found.                                                                                                   |
| **API/Application/Domain/Infrastructure separation** | ✅ The route delegates entirely to the use case; no query logic, prompt logic, or orchestration in the route handler. `assemblePersonaPrompt` is domain-only.                                                                                         |
| **Ports/adapters rules**                             | ✅ All external dependencies are behind ports (`IAvatarRepository`, `ILlmAdapter`, `IMessageRepository`, `ISessionRepository`, `IObservabilityAdapter`). Infrastructure implements ports. Domain and application layers do not import infrastructure. |
| **Async vs blocking decisions**                      | ✅ Observability is correctly non-blocking. All I/O is async. There is no blocking or sync I/O in the hot path.                                                                                                                                       |
| **Director–Actor model**                             | ✅ The Avatar answers the user directly. The `TODO(EPIC-2.2)` placeholder is in the correct position after the response is built — GM trigger will be non-blocking from that point too.                                                               |
| **Headless core principle**                          | ✅ No UI, session storage, or transport logic leaks into domain or application layers.                                                                                                                                                                |
| **Replaceable infrastructure principle**             | ⚠️ Partially. All adapter interfaces are clean, but F6/F7 show that route-level defaults instantiate concrete infrastructure classes, creating implicit coupling at the composition point.                                                            |

---

## Testing review

**What is tested well:**

- `PersonaPromptService` — 5 test groups: required prompt, name injection, name dedup when already present, tone injection ordering, determinism. Consumer-contract oriented, not implementation mirrors. ✅
- `SendMessageUseCase` — session validation (missing, closed, archived), avatar loading (missing), prompt assembly (forwarded correctly to LLM), history building (sort order, system message exclusion, truncation), persistence ordering (user before LLM, avatar after), observability firing, LLM error propagation, observability failure swallowing. ✅ Comprehensive.
- `messages.ts` route — auth (missing key, wrong key), validation (missing avatarId, missing content, empty content), happy path (full response shape), 404/409/502/500 error mappings, 3-turn sequential smoke test. ✅ Excellent API-level contract coverage.
- `InMemoryAvatarRepository` — findById hit and miss. ✅ Minimal but correct.

**What is missing or weak:**

- No test for `assemblePersonaPrompt` when `personaAdjustments` is present in `config` (the named magic key). The happy path for config adjustments is untested.
- No test for `assemblePersonaPrompt` when `config` is `undefined` — this is handled (`config === undefined` guard in `buildConfigAdjustments`), but not explicitly tested.
- The `MESSAGE_HISTORY_LIMIT` double-application is covered by the truncation test, but the test relies on the mock returning all 25 items (not applying the limit), which means the test inadvertently validates the `.slice()` safeguard while the `{ limit: 20 }` call is unverified as a real constraint. The test is not wrong, but the double-path interpretation is worth clarifying.
- No e2e stack test (like `exchange.stack-e2e.test.ts`) for the messages route. For EPIC 2.1 this is acceptable — a stack-level e2e would require seeding real sessions/avatars in a running server. Worth deferring to the persistence epic.
- No test for the `avatarId` case where the avatar exists but belongs to a different scenario than the session. The business rule for avatar/session compatibility (if any) is not defined or tested.

**Overall:** Testing is the strongest part of this EPIC. The gaps are minor and non-blocking.

---

## Documentation review

| Document                                                                                                                                                             | Status                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `docs/API_CONTRACT.md`                                                                                                                                               | ✅ Updated — `POST /v1/conversations/:sessionId/messages` endpoint is documented with correct request/response shapes. |
| `docs/ARCHITECTURE.md`                                                                                                                                               | ✅ Updated — Avatar module, PersonaPromptService, and SendMessageUseCase are reflected.                                |
| `docs/DATA_MODEL.md`                                                                                                                                                 | ✅ Updated — `AvatarConfig` fields synchronized (with `tone` field alignment commit `9024cea`).                        |
| `docs/TEST_STRATEGY.md`                                                                                                                                              | ✅ Updated.                                                                                                            |
| `docs/TEST_COVERAGE_PLAN.md`                                                                                                                                         | ✅ Updated.                                                                                                            |
| `docs/PROJECT_STATUS.md`                                                                                                                                             | ✅ Updated — EPIC 2.1 marked complete.                                                                                 |
| **EPIC README DoD checklist**                                                                                                                                        | ✅ All checkboxes checked in committed state.                                                                          |
| **Missing:** No mention in any doc that `personaAdjustments` is a magic key used within `config`. This is an implicit convention that currently exists only in code. | ⚠️                                                                                                                     |

---

## Recommended grade improvement plan

### Must fix before closing the EPIC

None. The EPIC implementation is functional, correctly layered, and has no blocking issues.

### Should fix soon (before or during EPIC 2.2)

1. **F7 — Remove demo/fixture data from production route defaults.** Replace `createDefaultAvatarRepository()` and `createDefaultSessionRepository()` with startup errors when adapters are not provided. Demo seeds belong in test helpers only.
2. **F1 — Establish a typed contract for `AvatarConfig.config`.** Either lift `personaAdjustments` to a named field (`adjustments?: string[]`) or define a typed `AvatarConfigExtras` interface. Document it wherever `AvatarConfig` is documented.
3. **F3 — Eliminate the second session read in the route.** Include session fields in `SendMessageOutput` to avoid the extra `getSessionOrThrow` round-trip per request.

### Nice to improve later

4. **F2 — Clarify ownership of history truncation.** Remove the redundant `.slice(-MESSAGE_HISTORY_LIMIT)` once the repository port/contract specifies that `limit` is guaranteed to be applied. Or remove the `limit` option and own truncation entirely in the use case.
5. **F4 — Extract `nowIso` and `createMessageId` to an injectable clock/uuid utility.** Enables fully deterministic tests on message IDs and timestamps.
6. **F5 — Make `DEFAULT_STYLE_RULE` configurable.** Move it to `AvatarConfig` as a field with a fallback default, or into `personaAdjustments`.
7. **F6 — Centralize dependency wiring.** Move use case construction out of route plugins and into `server.ts` or a dedicated composition root. Apply consistently to both `exchange.ts` and `messages.ts`.
8. **Add test for `personaAdjustments` config key.** Explicit test for the happy path (non-empty adjustments array) and for `config === undefined`.

---

## Path to A

1. Remove hardcoded demo data from production route code (F7 — eliminates a real misconfiguration hazard).
2. Type `AvatarConfig.config` properly or lift `personaAdjustments` to a first-class field (F1 — restores TypeScript safety on a real contract).
3. Include session data in `SendMessageOutput`, remove `getSessionOrThrow` in the route (F3 — clean up a leaky abstraction and an unnecessary read).
4. Add the missing test for `personaAdjustments` config adjustments path.

These four changes, none requiring architectural rethinking, would raise the implementation to A.

---

## Final verdict

**Close with follow-up debt.**

EPIC 2.1 is a well-executed, solid foundation. The domain model, persona prompt pipeline, use case orchestration, and test coverage are all strong. The architecture is clean. Two findings (F7 demo data in production, F1 untyped config key) are worth addressing before they compound, but neither is a blocker to closing this EPIC and starting EPIC 2.2. The remaining findings are technical debt items to track and resolve during normal development.

---

## Remediation outcome

### Summary of changes implemented

**F1 — Typed `adjustments` field:**

- Added `adjustments?: string[]` as a first-class typed field to `AvatarConfig` in `avatar.types.ts`
- Updated `persona-prompt.service.ts`: replaced `buildConfigAdjustments(config.config)` (reading magic key from `Record<string, unknown>`) with `buildAdjustments(config.adjustments)` (typed `string[] | undefined`); internal helper simplified accordingly
- No existing callers broke — field is optional; `config` bag remains for non-adjustment extensible data

**F3 — Session data in `SendMessageOutput`, no second DB read:**

- Added `SendMessageSessionSummary` type and `session` field to `SendMessageOutput` in `send-message.types.ts`
- Updated `send-message.use-case.ts` to include session summary in the return value
- Updated `messages.ts`: removed `getSessionOrThrow`, `RouteDependencies.sessionRepository`, and the extra repository call in the handler; `mapSendMessageResponse` now takes only `output` (no separate `Session` parameter)
- Unused `Session` domain type import removed from route file

**F7 — No demo fixtures in production route defaults:**

- Removed `createDefaultAvatarRepository()` and `createDefaultSessionRepository()` (which seeded `ava_demo`/`sess_demo` hardcoded fixtures) from `messages.ts`
- Route now defaults to `new InMemoryAvatarRepository()` and `new InMemorySessionRepository()` (both empty) — unknown sessions/avatars return proper 404s instead of silently serving demo content

**Missing tests — `adjustments` path:**

- Replaced the old determinism test referencing `config.personaAdjustments` with a corrected version using `adjustments: [...]`
- Added three new tests in `persona-prompt.service.test.ts`:
  - Adjustments are appended in order after tone and before the style rule
  - Absent `adjustments` field produces no extra sections
  - Blank/whitespace-only items in `adjustments` array are silently skipped
- Added `output.session` assertion to `send-message.use-case.test.ts`

**Documentation:**

- `docs/DATA_MODEL.md`: `AvatarConfig` implementation alignment updated to document `adjustments?: string[]`
- `docs/PROJECT_STATUS.md`: EPIC 2.1 table and closure summary updated to reflect post-remediation state (94 tests, new fields, no demo data)

### Findings resolved

| Finding                                   | Severity | Resolution                                                                                       |
| ----------------------------------------- | -------- | ------------------------------------------------------------------------------------------------ |
| F1 — `personaAdjustments` magic key       | Medium   | Lifted to typed `adjustments?: string[]` on `AvatarConfig`; TypeScript now enforces the contract |
| F3 — Second session DB read in route      | Low      | `SendMessageOutput` now carries `session` summary; `getSessionOrThrow` eliminated                |
| F7 — Demo fixtures in production defaults | Medium   | Removed; defaults to empty in-memory repos                                                       |
| Missing test — `adjustments` path         | —        | Three new tests added; determinism test updated                                                  |

### Findings deferred

| Finding                              | Severity | Rationale                                                                                                                                                                                                                                                                                                             |
| ------------------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F2 — Redundant double history limit  | Low      | `InMemoryMessageRepository` does apply the `limit` option; the `slice()` in the use case is a safety guard. Adding a clarifying JSDoc comment suffices; removing either without a clear repository contract guarantee introduces risk. Deferred to the Postgres persistence epic where the contract becomes explicit. |
| F4 — Injectable clock/uuid utilities | Low      | `nowIso()` and `createMessageId()` as private methods are acceptable for MVP. The actual values are not user-observable contracts; tests validate shape, not exact values. Deferred — only valuable if deterministic snapshot tests or message dedup checks become needed.                                            |
| F5 — Hardcoded `DEFAULT_STYLE_RULE`  | Low      | The style rule is intentional product behavior for MVP. Making it configurable would add a field before there's a real use case for varying it across avatars. YAGNI — deferred to Phase B when multi-tenant customization becomes real.                                                                              |
| F6 — Centralized dependency wiring   | Low      | Both `exchange.ts` and `messages.ts` follow the same pattern. Centralizing in `server.ts` is the right long-term direction but requires rethinking both routes simultaneously. Deferred to a dedicated refactor before Sprint 3 adds more routes.                                                                     |

### Final self-assessed grade after remediation: A

The two Medium findings (F1, F7) that would have kept the implementation at B are resolved. The contract on `AvatarConfig.adjustments` is now TypeScript-enforced. The route no longer exposes hardcoded demo data in any deployment path. The second DB read is eliminated. Test coverage for the `adjustments` path is explicit and consumer-contract oriented. The remaining deferred items are all Low severity and justified by YAGNI for the current project stage.

### Remaining risks

- F2 (history truncation ownership) will need formal resolution when the Postgres repository is implemented — the `IMessageRepository` port should document whether `limit` is a guarantee or a hint.
- F6 (per-route dependency wiring) will grow in complexity as more routes are added; should be addressed proactively before Sprint 3.
- No stack-level e2e test for `messages.ts` against a real server (as opposed to Fastify inject); this is acceptable for in-memory phase but should be added alongside the Postgres integration.
