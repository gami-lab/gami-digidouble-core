# 04 — Complete messages.stack-e2e.test.ts Happy Path + Full Lifecycle Stack-E2E

## Context

When `messages.stack-e2e.test.ts` was created (as part of the EPIC 2.1 post-audit fix), the
happy-path test for `POST /v1/conversations/:sessionId/messages` was intentionally deferred
with a comment:

> `// Full success-path test deferred until session-creation API exists`

With `POST /v1/conversations/start` now implemented (Prompt 01), that prerequisite is met.
This prompt completes the deferred test and adds a full conversation lifecycle stack-e2e flow.

---

## Scope

**In scope:**

- Complete the deferred happy-path test in `messages.stack-e2e.test.ts`:
  - Create session via `POST /v1/conversations/start`
  - Send message via `POST /v1/conversations/:sessionId/messages`
  - Verify 200 response with correct `ApiResponse` envelope
- Add a full lifecycle stack-e2e test in `conversations.stack-e2e.test.ts`:
  - Start → Send → History → Reset → History-after-reset
  - This is the canonical "session lifecycle works end-to-end" test
- Remove the deferred comment and `// TODO` from `messages.stack-e2e.test.ts`

**Out of scope:**

- Multi-turn context continuity (that is the in-process `messages.e2e.test.ts` concern with
  real LLM calls — it remains as-is with `describe.skipIf(!apiKey)`)
- Any modifications to `conversations.e2e.test.ts` (in-process E2E) — not created in this EPIC

---

## Relevant Docs

- `docs/TEST_STRATEGY.md` — `*.stack-e2e.test.ts` tier: real HTTP, no mocking, requires `APP_URL`
- `apps/core/src/api/routes/messages.stack-e2e.test.ts` — current file with deferred TODO
- `apps/core/src/api/routes/conversations.stack-e2e.test.ts` — created in Prompts 01–03

---

## Implementation Guidance

### `messages.stack-e2e.test.ts` — happy path completion

The existing file has auth/validation/404 tests in `describe` blocks that always run. Add a
new `describe` block:

```
Stack E2E — POST /v1/conversations/:sessionId/messages — null provider (always-on)
```

Guard it with:

```ts
const isNullProvider = (process.env['LLM_PROVIDER'] ?? 'null') === 'null'
describe.skipIf(!isNullProvider)('...', () => {
```

Flow for this test:

1. `POST /v1/conversations/start` with a test `userId` and `scenarioId` → get `sessionId`
2. Seed an avatar in the stack for the same `scenarioId`...

**Wait — the stack doesn't have avatar seeding via API yet.** The avatar must be pre-configured
in the stack. Looking at the existing `NullLlmAdapter` tests, the avatar is injected in-process.
For a live Docker stack test, there is no in-process injection.

**Approach:** The stack-e2e happy path for the messages endpoint requires either:
a) An avatar API endpoint (not yet built)
b) A pre-seeded avatar in the Docker stack image/init script

For EPIC 2.2, option (b) is simpler. Add a minimal demo avatar seed to the Docker stack's
environment or init mechanism — document this in the stack-e2e file as a known limitation.

**Alternative approach (simpler, no image change needed):** Keep the messages happy-path stack-e2e
deferred with an updated comment:

```ts
// TODO(EPIC-2.2 completion): avatar API endpoint not yet available;
// the stack has no mechanism to seed an avatar without code changes.
// This test will be enabled when POST /v1/avatars or equivalent exists.
// Tracked as part of EPIC 6.1 (scenario/avatar builder) or EPIC 3.2 (Public Core API).
```

Update the deferred comment from the original vague text to this specific, EPIC-referenced version.

### Full lifecycle test in `conversations.stack-e2e.test.ts`

Add a `describe` block: `Stack E2E — Full session lifecycle`.

This test chains the three conversation endpoints:

1. `POST /v1/conversations/start` → assert `sessionId` returned
2. `GET /v1/conversations/:sessionId/history` → assert `messages: []` (no messages yet)
3. `DELETE /v1/conversations/:sessionId` → assert 200, `deleted.messages === 0`
4. `GET /v1/conversations/:sessionId/history` after reset → assert 200 (session still exists), `messages: []`

This test does NOT involve message sending (since avatar seeding is not available in the stack
without a separate avatar endpoint). It validates that start + history + reset form a coherent
lifecycle with no data leakage between steps.

This is a meaningful real-stack test — it exercises the full HTTP → `conversationsRoute` → use
cases → `InMemorySessionRepository` + `InMemoryMessageRepository` chain without any process-
internal mocking.

---

## Constraints

- Do not modify auth/validation/404 tests — they must remain exactly as they are
- If the messages happy-path cannot be done cleanly (avatar API missing), update the deferred
  comment to be specific and EPIC-referenced — do not force a half-baked seeding approach
- `describe.skipIf` guards for null-provider tests must follow the exact pattern from
  `exchange.stack-e2e.test.ts`
- No TypeScript `any` in test files

---

## Deliverables

- `apps/core/src/api/routes/messages.stack-e2e.test.ts` — deferred comment updated to specific
  EPIC reference; null-provider happy-path test added if feasible, or comment clearly states
  the exact blocker
- `apps/core/src/api/routes/conversations.stack-e2e.test.ts` — full lifecycle `describe` block added

---

## Mandatory Final Step — Documentation Update

After implementation:

- `docs/PROJECT_STATUS.md` — note Prompt 04 complete; record the lifecycle test and the state
  of the messages happy-path (deferred with EPIC reference, or completed)
- If the messages happy-path remains deferred: note the exact blocker (avatar API missing) and
  the tracking EPIC reference

---

## Acceptance Criteria

- [ ] Full lifecycle stack-e2e test passes: start → history → reset → history-after-reset
- [ ] `messages.stack-e2e.test.ts` deferred comment is updated with specific EPIC reference
- [ ] All always-on auth/validation/404 tests in both files remain passing
- [ ] No test relies on pre-seeded state that is not created by the test itself
- [ ] `pnpm test:stack-e2e` passes when `APP_URL` is set to a running Docker stack
