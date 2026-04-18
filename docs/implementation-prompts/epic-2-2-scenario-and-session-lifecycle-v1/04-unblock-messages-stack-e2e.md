# 04 — Unblock messages.stack-e2e Happy Path

## Context

Since EPIC 2.1, `messages.stack-e2e.test.ts` has contained a deferred happy-path test with
the comment:

```
// TODO(EPIC-6.1 or EPIC-3.2): enable when POST /v1/avatars (or equivalent) is available.
```

The blocker was the absence of an avatar creation API. With Prompts 01–03 complete, the stack
now has:

- `POST /v1/scenarios` — create scenario
- `POST /v1/scenarios/:scenarioId/avatars` — create avatar
- `POST /v1/conversations/start` — create session

This means the messages happy-path test can now be written entirely via HTTP calls: create a
scenario, create an avatar, start a session, then send a message.

This prompt implements the messages happy-path and writes a cross-route full lifecycle
stack-e2e test.

---

## Scope

**In scope:**

- Replace the deferred TODO block in `messages.stack-e2e.test.ts` with a working happy-path test
- The happy-path test creates its own scenario + avatar + session as setup — no pre-seeded data
- Use `describe.skipIf(!isNullProvider)` guard for the LLM call part (same pattern as
  `exchange.stack-e2e.test.ts`) — so the test runs on the null-provider Docker stack but skips
  when a real provider would be needed for a meaningful assertion
- Update the TODO comment to accurately reflect the current state

**Out of scope:**

- Changing any route behavior or use case
- Any new route or endpoint
- Streaming happy path (EPIC 5.3)
- Multi-turn memory assertions (EPIC 4.2)

---

## Relevant Docs

- `docs/TEST_STRATEGY.md` — stack-e2e test tier description and `skipIf` pattern
- `apps/core/src/api/routes/exchange.stack-e2e.test.ts` — `describe.skipIf(!isNullProvider)` usage
- `apps/core/src/api/routes/messages.stack-e2e.test.ts` — current file with deferred TODO
- `apps/core/src/api/routes/messages.ts` — request/response contract for send message
- `docs/API_CONTRACT.md` §2 — `SendMessageRequest` and `SendMessageResponse` shapes

---

## Implementation Guidance

### Understand the null-provider guard

`exchange.stack-e2e.test.ts` follows this pattern:

```ts
const isNullProvider = process.env['LLM_PROVIDER'] === 'null'
describe.skipIf(!isNullProvider)('...', () => { ... })
```

When `LLM_PROVIDER=null`, the null adapter returns a deterministic fake response. This is
what the Docker stack uses in CI (see `docker-compose.yml`). Tests guarded by `skipIf(!isNullProvider)`
run in CI stack tests (null provider) and are skipped when a real provider is configured.

For the messages happy path, the LLM call happens inside `SendMessageUseCase`. The null adapter
returns a deterministic reply, so a meaningful response assertion is possible: check that
`data.avatarMessage.content` is a non-empty string and `data.userMessage.content` matches the
sent message.

### Setup within the happy-path describe block

The happy-path describe block must:

1. Create a scenario via `POST /v1/scenarios` → capture `scenarioId`
2. Create an avatar via `POST /v1/scenarios/:scenarioId/avatars` → capture `avatarId`
3. Start a session via `POST /v1/conversations/start` with the real `scenarioId` → capture `sessionId`
4. Send a message via `POST /v1/conversations/:sessionId/messages` with the real `avatarId`
5. Assert response shape: `data.session.sessionId`, `data.userMessage`, `data.avatarMessage.content`

Steps 1–3 are setup. Steps 4–5 are the assertion.

If the setup steps themselves fail (e.g., unexpected 5xx), let the test fail with a clear error
rather than silently skipping. Use raw `fetch()` assertions or explicit `if (!ok) throw`.

### Granularity

Two options for structure:

**Option A (preferred):** One `describe.skipIf(!isNullProvider)` block with multiple sequential
`it` blocks — one for setup (verify 201s), one for the actual send-message assertion.

**Option B:** Single `it` block that does setup inline — acceptable but harder to diagnose
when setup fails.

Prefer Option A for debuggability.

### What to Assert

On the send-message response:

- `res.status === 200`
- `body.data.session.sessionId === sessionId`
- `body.data.userMessage.content === 'Hello from stack-e2e'` (or whatever input was sent)
- `typeof body.data.avatarMessage.content === 'string'`
- `body.data.avatarMessage.content.length > 0`
- `body.error === null`

Keep assertions focused on contract shape, not on the specific avatar response content (which
varies even with the null adapter if it returns a fixed string).

### Update the TODO Comment

Remove the old deferred comment block at the top of `messages.stack-e2e.test.ts`:

```
// Full happy-path stack test (deferred):
// ...
// TODO(EPIC-6.1 or EPIC-3.2): enable when POST /v1/avatars (or equivalent) is available.
```

Replace with a brief note reflecting current status:

```
// Full happy-path test:
//   Creates scenario + avatar + session via API, then sends a message.
//   Guarded by describe.skipIf(!isNullProvider) — runs only when LLM_PROVIDER=null.
```

---

## Constraints

- No mocking — all HTTP calls use `fetch()`
- The `LLM_PROVIDER` guard must use the same `describe.skipIf(!isNullProvider)` pattern as
  `exchange.stack-e2e.test.ts` — do not invent a new skip mechanism
- Setup calls (create scenario, avatar, session) must not hide failures — assert `201` explicitly
- Do not test avatar response quality — only test structure and presence

---

## Deliverables

- `api/routes/messages.stack-e2e.test.ts` updated:
  - deferred TODO block replaced with working happy-path describe
  - `describe.skipIf(!isNullProvider)` guard
  - setup: create scenario → create avatar → start session
  - assertion: send message → verify 200 + response shape

---

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md` — note that `messages.stack-e2e.test.ts` now has a working happy-path
- `docs/TEST_STRATEGY.md` — verify the stack-e2e section accurately describes the null-provider
  guard pattern; update if the document doesn't mention it

If no doc changes are needed, explicitly verify docs are still accurate.

---

## Acceptance Criteria

- [ ] `messages.stack-e2e.test.ts` no longer contains a deferred TODO for the happy path
- [ ] Happy-path describe is guarded with `describe.skipIf(!isNullProvider)`
- [ ] Setup assertions (`201 Created`) fail explicitly if any setup call fails
- [ ] Send-message assertion checks HTTP 200, session shape, and avatar message presence
- [ ] Always-on auth/validation/404 tests are unchanged and still pass
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` all pass
