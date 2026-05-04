# CODE_AUDIT — EPIC 2.2b: Conversation Lifecycle v2

**Date:** 2026-05-04
**Auditor:** AI Agent
**Grade: A**

---

## Quality Gates

| Gate             | Result                             |
| ---------------- | ---------------------------------- |
| `pnpm lint`      | ✅ Pass                            |
| `pnpm typecheck` | ✅ Pass                            |
| `pnpm test`      | ✅ Pass (353 tests, 63 test files) |

---

## Scope

All files introduced or modified by this epic:

- `packages/shared/src/lifecycle-types.ts` — centralized lifecycle contracts
- `packages/shared/src/entity-types.ts` — `LifecycleStatus` type
- `apps/core/src/application/use-cases/end-conversation/` — explicit close use case + types
- `apps/core/src/application/ports/IConversationCompactionPort.ts` — compaction abstraction
- `apps/core/src/application/services/implicit-end-detection.service.ts` — pure detection logic
- `apps/core/src/application/services/implicit-end-detection.service.test.ts`
- `apps/core/src/application/use-cases/send-message/send-message.use-case.ts` — implicit close path added
- `apps/core/src/api/routes/sessions.ts` — `POST /:sessionId/conversations/:conversationId/end`
- `apps/core/src/api/routes/end-conversation.stack-e2e.test.ts`
- `apps/core/src/api/routes/conversation-messages-implicit.stack-e2e.test.ts`

---

## DoD Checklist

| Item                                                                       | Status                  |
| -------------------------------------------------------------------------- | ----------------------- |
| Conversation explicitly closeable via API with clear reason semantics      | ✅                      |
| State updates consistent (`status`, `endedAt`, `reason`, `lastActivityAt`) | ✅                      |
| Memory compaction triggered on close                                       | ✅                      |
| `Session.memorySummary` persisted                                          | ✅                      |
| Implicit end detection reuses canonical close pipeline                     | ✅                      |
| No contract duplication — lifecycle types centralized in `@gami/shared`    | ✅                      |
| Stack-e2e coverage for explicit endpoint                                   | ✅                      |
| Stack-e2e coverage for implicit end path                                   | ✅                      |
| API_CONTRACT.md updated                                                    | ✅ (per PROJECT_STATUS) |
| DATA_MODEL.md updated                                                      | ✅ (per PROJECT_STATUS) |
| Build gates pass                                                           | ✅                      |

---

## Strengths

### S1 — Centralized lifecycle contracts in `@gami/shared`

`ConversationEndReason`, `EndConversationResponse`, `SessionMemorySummary`, `SessionTransitionRecord`, `AvatarTransitionRecord`, and `LifecycleSummary` all live in `packages/shared/src/lifecycle-types.ts`. No field needs to be added in more than one place to evolve the contract.

### S2 — `IConversationCompactionPort` cleanly abstracts compaction

`EndConversationUseCase` depends on the port interface, not on `MessageHistoryCompactionService` directly. The use case is fully testable without touching the real service. Port is wired at the route layer (sessions.ts line 201).

### S3 — Close-first async compaction pattern

`void this.compactSessionMemory(sessionId, conversationId)` — the conversation is closed synchronously and the response is returned before compaction completes. This is consistent with the GM async pattern throughout the codebase. Compaction failure does not abort the close (graceful degradation: emits `memory_compaction_failed` event and continues).

### S4 — Pure function service for implicit end detection

`detectImplicitEndReason` in `implicit-end-detection.service.ts` is a stateless, deterministic pure function with no side effects. It accepts policy configuration, making it easy to override in tests or future per-scenario configuration. Zero DB calls, zero I/O.

### S5 — Canonical close pipeline reused for implicit end

`SendMessageUseCase.tryImplicitClose()` delegates to `endConversationUseCase.execute()` — the full canonical path runs for both explicit and implicit closes. No logic duplication between the two paths.

### S6 — Implicit close failure is non-fatal to message delivery

`tryImplicitClose` catches errors from `endConversationUseCase.execute()`, emits `implicit_end_skipped`, and returns `null` — the `SendMessageUseCase` returns the message response normally. This is tested in `send-message.use-case.test.ts` (line 466: "keeps message flow successful when implicit close is skipped by race/conflict").

### S7 — `compaction: { scheduled: true }` communicates async semantics explicitly

The response shape signals to callers that compaction is happening asynchronously. The literal type `scheduled: true` (not `boolean`) enforces this in the TypeScript type system.

### S8 — Comprehensive test pyramid

- **Unit**: `end-conversation.use-case.test.ts` covers happy path, default reason, conflict, compaction failure; `implicit-end-detection.service.test.ts` covers all three detection outcomes; `send-message.use-case.test.ts` covers canonical close delegation, no-match case, and skipped-on-conflict case.
- **Stack-e2e**: `end-conversation.stack-e2e.test.ts` covers 401, 400 (invalid reason), 404 (session), 404 (conversation), 409 (already closed), 200 (happy path with status + endedAt + compaction flag); `conversation-messages-implicit.stack-e2e.test.ts` covers 401, 400, 404, 200 active, 200 closed on terminal signal.

---

## Findings

### I1 — Low: TypeScript type wider than JSON schema for explicit end endpoint

**File:** `apps/core/src/api/routes/sessions.ts` lines 75–77 and 133–142

**Observation:**

```ts
// Line 75 — TS type
type EndConversationRequestBody = {
  reason?: ConversationEndReason  // 6 values including inactivity_timeout, auto_terminal_signal
}

// Line 138 — JSON schema
enum: ['user_end', 'operator_end', 'scenario_complete', 'safety_stop']  // 4 values
```

`ConversationEndReason` has 6 values: the 4 user-facing reasons plus `inactivity_timeout` and `auto_terminal_signal`. The JSON schema correctly restricts the explicit endpoint to the 4 user-facing values (implicit reasons should not be submitted by callers). However, the TypeScript type uses the full `ConversationEndReason` union, so TypeScript would not flag a caller passing `'inactivity_timeout'` — the runtime schema rejects it, but the type is misleading.

**Recommendation:** Narrow the TS type to a local union of the 4 permitted values, or introduce a separate `ExplicitConversationEndReason` type in `@gami/shared`.

**Impact:** None at runtime. Documentation/type safety issue only.

---

### I2 — Low: Redundant ID validation in `EndConversationUseCase.execute()`

**File:** `apps/core/src/application/use-cases/end-conversation/end-conversation.use-case.ts` lines 20–26

**Observation:**

```ts
const sessionId = input.sessionId.trim()
const conversationId = input.conversationId.trim()
if (sessionId.length === 0) { throw ... }
if (conversationId.length === 0) { throw ... }
```

The route schema (`sessionConversationParamsSchema`) enforces `minLength: 1` on both path params before the use case is invoked. The use case validation is redundant for the HTTP path but would protect callers calling the use case directly (e.g., from implicit close). However, `tryImplicitClose` in `SendMessageUseCase` passes IDs that were already validated upstream (they come from a DB entity), so this is defense-in-depth with no practical effect.

**Recommendation:** Acceptable as-is. Consistent with pattern established in prior epics (EPIC 5.5 I2).

**Impact:** None.

---

## Architecture Compliance

| Rule                                                                    | Status                           |
| ----------------------------------------------------------------------- | -------------------------------- |
| 4-layer boundary respected (API → App → Domain → Infra)                 | ✅                               |
| Domain doesn't import Infrastructure                                    | ✅                               |
| `IConversationCompactionPort` wired at route layer, not inside use case | ✅                               |
| Game Master pattern (async non-blocking) followed for compaction        | ✅                               |
| LLM providers accessed only through abstraction                         | ✅ (not applicable to this epic) |
| `ApiResponse<T>` envelope used on all endpoints                         | ✅                               |
| Input validated at API boundary (Fastify schema)                        | ✅                               |

---

## Summary

EPIC 2.2b is complete and correctly implemented. All four phases (lifecycle contract baseline, explicit endpoint, compaction trigger, implicit end detection) are present and tested. The implementation follows all architectural principles. Two low-severity findings exist, both are cosmetic or defense-in-depth patterns consistent with the existing codebase. No blocking issues.

---

## Remediation Outcome

### Changes Made

- **`apps/core/src/api/routes/sessions.ts`**: Introduced local `ExplicitEndReason` type (`'user_end' | 'operator_end' | 'scenario_complete' | 'safety_stop'`) and replaced `EndConversationRequestBody.reason?: ConversationEndReason` with `reason?: ExplicitEndReason`. Removed now-unused `ConversationEndReason` import. A comment documents why implicit reasons are excluded from this type.

### Findings Resolved

- **I1 (Low)** — TS type narrowed to match the JSON schema enum. TypeScript now prevents callers from passing `'inactivity_timeout'` or `'auto_terminal_signal'` through the explicit endpoint at compile time, consistent with the runtime schema enforcement.

### Findings Deferred

- **I2 (Low)** — Redundant ID validation in `EndConversationUseCase.execute()` — accepted as-is. Defense-in-depth, consistent with EPIC 5.5 pattern. No runtime impact.

### Build Gates

- lint: **PASS**
- typecheck: **PASS**
- tests: **PASS** (353 tests, 63 test files)

### Final Feature Confidence

| Feature                                              | Proven by                                                                                                                   |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Explicit conversation close via API                  | `end-conversation.stack-e2e.test.ts` — auth, 400, 404 (session), 404 (conversation), 409 (conflict), 200                    |
| Close updates status, endedAt, reason                | `end-conversation.use-case.test.ts` — persisted state assertions                                                            |
| Memory compaction triggered on close                 | `end-conversation.use-case.test.ts` — `memory_compaction_triggered` + `memory_compaction_succeeded` events via `vi.waitFor` |
| `Session.memorySummary` persisted                    | `end-conversation.use-case.test.ts` — asserts `memorySummary` value post-waitFor                                            |
| Compaction failure is non-fatal                      | `end-conversation.use-case.test.ts` — close succeeds, `memory_compaction_failed` emitted, `memorySummary` undefined         |
| Implicit end via terminal signal                     | `conversation-messages-implicit.stack-e2e.test.ts` — `bye` → status `closed` + `endedAt`                                    |
| Implicit end reuses canonical close                  | `send-message.use-case.test.ts` — asserts `endConversationExecuteMock` called with `auto_terminal_signal`                   |
| Implicit close failure non-fatal to message delivery | `send-message.use-case.test.ts` — `implicit_end_skipped` emitted, response still 200                                        |
| API reason enum enforced at runtime                  | `end-conversation.stack-e2e.test.ts` — `manual_switch` → 400                                                                |
| API reason enum enforced at compile time             | TypeScript type `ExplicitEndReason` (I1 fix)                                                                                |

### Final Grade

**A**

### Remaining Risks

None. Both findings resolved or consciously accepted.
