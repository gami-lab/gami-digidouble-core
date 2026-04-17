# 05 — Tests and Hardening

## Context

Prompts 01–04 collectively introduce new domain logic (`PersonaPromptService`), a new use case (`SendMessageUseCase`), new ports, two new in-memory repositories, and a new API route.

This prompt consolidates test coverage across all of them, verifies quality gates, and hardens the implementation before final doc sync.

The goal is to reach and sustain the 80% coverage threshold with tests that provide genuine confidence — not metric inflation.

## Scope

**In scope:**

- Review and complete unit tests for `PersonaPromptService` (all assembly rules)
- Review and complete unit tests for `SendMessageUseCase`:
  - happy path: multi-turn history is assembled correctly and passed to LLM
  - session not found / closed / archived
  - avatar not found
  - `LlmError` propagates
  - observability failure swallowed
  - user message persisted before LLM call, avatar message persisted after
  - message history sorted chronologically
- Review and complete API tests for `POST /v1/conversations/:sessionId/messages`:
  - 200 happy path
  - 401 missing/wrong API key
  - 400 invalid body (missing content, empty content, missing avatarId)
  - 404 unknown session
  - 409 closed session
  - 502 LlmError
  - 500 unexpected error
- Lint pass, typecheck pass, full test suite pass, coverage gate pass
- Manual multi-turn smoke test: seed an avatar + session, send 3 messages in sequence, verify history builds correctly

**Out of scope:**

- E2E tests with real LLM for the new endpoint (those go in the e2e file if keys are available — add a `describe.skipIf` block following the pattern in `exchange.e2e.test.ts`)
- Mutation testing (nightly — not blocking here)
- Performance testing (EPIC 2.3)

## Relevant Docs

- `docs/TEST_STRATEGY.md` — mock strategy (mocks only at infrastructure edges), coverage thresholds (≥80%), `*.e2e.test.ts` pattern
- `docs/PRINCIPLES.md` — test the risk, not the code volume

## Implementation Guidance

### Test style rules (align with existing test files)

**Unit tests (application / domain):**

- Use module-level `vi.fn()` declarations — never inline in a `beforeEach`
- Use `vi.mocked()` only if needed for type narrowing — prefer module-level typed mocks
- No live LLM, no network calls, no file I/O
- Each test exercises one specific behavior — no mega-tests

**API tests (route layer):**

- Use `NullLlmAdapter` injected via `MessagesRouteOptions`
- Use pre-seeded `InMemoryAvatarRepository`, `InMemorySessionRepository`, `InMemoryMessageRepository`
- Use Fastify `inject()` — no live HTTP server
- Assert response shape strictly (status, envelope, error code)

### `SendMessageUseCase` unit test structure

Organize into `describe` blocks by concern:

- `→ session validation` — not found, closed, archived
- `→ avatar loading` — not found
- `→ prompt assembly` — persona prompt used in LLM call
- `→ message history` — history sorted, truncated to 20
- `→ message persistence` — user message before, avatar after, correct metadata
- `→ observability` — trace fired, failure swallowed
- `→ error propagation` — LlmError propagates

### `PersonaPromptService` unit test structure

Organize by rule:

- `→ personaPrompt included` — always present in output
- `→ name included` — when provided
- `→ tone included` — when provided, in correct position (after persona)
- `→ empty personaPrompt` — throws domain error
- `→ determinism` — same input = same output across multiple calls

### `POST /v1/conversations/:sessionId/messages` API test structure

Follow the same two-`describe`-block pattern as `exchange.test.ts` to stay within `max-lines-per-function: 50`:

- `describe('auth and validation', ...)` — 401, 400 cases
- `describe('session and use case behavior', ...)` — 200, 404, 409, 502, 500

### E2E test (optional but encouraged)

Add to `src/api/routes/messages.e2e.test.ts` following the `exchange.e2e.test.ts` pattern:

- Guard with `describe.skipIf(!process.env['OPENAI_API_KEY'])`
- Seed a real avatar and session in `InMemoryAvatarRepository` and `InMemorySessionRepository`
- Send two sequential messages and verify the second response references context from the first (rough behavioral check — not exact string matching)
- 30s timeout

### Coverage check

After all tests are written, run:

```sh
pnpm turbo run test:coverage --filter=@gami/core
```

Verify all thresholds remain ≥80%. If a new file falls below:

- add targeted tests for the specific uncovered branch
- do not add tests for defensive branches that cannot actually be reached

### Lint and typecheck

Run and fix everything before Prompt 06:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm turbo run test:coverage --filter=@gami/core
```

## Constraints

- No mocking of domain logic — only infrastructure adapters (LLM, observability, repositories)
- Test file names: `*.test.ts` for unit/API, `*.e2e.test.ts` for real-provider tests
- No test magic strings that couple to exact LLM output phrasing
- ESLint `max-lines-per-function: 50` — split test `describe` blocks if needed

## Deliverables

- Complete unit tests: `persona-prompt.service.test.ts`, `send-message.use-case.test.ts`
- Complete API tests: `messages.test.ts`
- Optional: `messages.e2e.test.ts` with `skipIf` guard
- All tests passing
- Coverage ≥80% retained across all metrics
- Lint and typecheck passing

## Mandatory Final Step — Documentation Update

After tests pass:

- `docs/PROJECT_STATUS.md` — note test coverage retained, EPIC 2.1 / Prompt 05 complete
- `docs/TEST_STRATEGY.md` — if any new test pattern was introduced that is not already documented, add it

## Acceptance Criteria

- [ ] `PersonaPromptService` has unit tests for all assembly rules
- [ ] `SendMessageUseCase` has unit tests for all behaviors listed above
- [ ] `POST /v1/conversations/:sessionId/messages` has API tests for all status codes
- [ ] `pnpm turbo run test:coverage --filter=@gami/core` passes all thresholds (≥80%)
- [ ] `pnpm lint` passes with zero errors
- [ ] `pnpm typecheck` passes clean
- [ ] All test files follow the established mock style (module-level `vi.fn()`, infra-edge injection only)
