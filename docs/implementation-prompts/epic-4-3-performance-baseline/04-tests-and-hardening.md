# 04 — Tests and Hardening

## Context

Prompts 01–03 deliver the full feature stack. This prompt hardens it with a complete test suite: unit tests for the use case (already partially specified in prompt 02), integration-style route tests, and a stack-E2E test for the new admin endpoint.

It also covers edge cases that may have been skipped during fast implementation — malformed payloads, missing GM data, legacy events without timing fields.

## Scope

**In scope:**

- Unit tests for `GetTurnMetricsUseCase` (may already exist from prompt 02 — extend if incomplete)
- Route tests for `GET /v1/admin/sessions/{sessionId}/metrics` using `app.inject()`
- Stack-E2E test file: `admin-metrics.stack-e2e.test.ts`
- Verify that `turn_completed` events are appended correctly in `SendMessageUseCase` (unit test extension)
- Verify that `gm_triggered` payload enrichment is present in `RunGameMasterUseCase` (unit test extension)

**Out of scope:**

- Load or performance testing
- Console UI tests
- Langfuse integration tests (Langfuse is already covered)

## Relevant Docs

- `docs/TEST_STRATEGY.md` — unit tests for domain logic, route tests for contracts, stack-E2E for real-stack validation
- `docs/TEST_COVERAGE_PLAN.md` — understand what coverage is expected per module
- `apps/core/src/api/routes/admin-health.test.ts` — pattern for route tests with local probe/adapter stubs
- `apps/core/src/api/routes/admin-sessions.stack-e2e.test.ts` — pattern for stack-E2E tests

## Unit Test Targets

### get-turn-metrics.use-case.test.ts

Location: alongside the use case file.

Scenarios (all using mock `IEventLogRepository` — no DB):

| Scenario                                         | Expected                                                   |
| ------------------------------------------------ | ---------------------------------------------------------- |
| Empty event log                                  | `turns: []`, summary zeros/nulls                           |
| One turn, no GM event                            | `hasGm: false`, correct latency, no GM fields              |
| One turn with matching `gm_triggered`            | `hasGm: true`, `gmLatencyMs` populated                     |
| Three turns — two with GM, one without           | `turnsWithGm: 2`, averages computed correctly              |
| GM event with no latency in payload (legacy)     | Turn still included, `gmLatencyMs` absent                  |
| `gm_triggered` with unrecognized `correlationId` | Not attached to any turn (orphan event ignored)            |
| Summary `avgGmLatencyMs`                         | `null` when no GM turns; numeric when at least one GM turn |

All tests must be deterministic. Use explicit numeric values to verify averages.

### send-message.use-case.test.ts (extension)

Add tests confirming:

- `IEventLogRepository.append` is called with `type: 'turn_completed'` on a successful turn
- `payload.hasGm` is `true` when `runGameMasterUseCase` is provided, `false` otherwise
- `payload.avatarLatencyMs` matches the LLM response latency
- `IEventLogRepository.append` failure does not cause `execute()` to throw (fire-and-forget pattern)

### run-game-master.use-case.test.ts (extension)

Add a test confirming:

- `gm_triggered` event payload includes `latencyMs`, `inputTokens`, `outputTokens`

## Route Test Targets

### admin-metrics.test.ts

Location: `apps/core/src/api/routes/admin-metrics.test.ts`

Use `createServer()` with test config + stubs. Use `app.inject()`.

| Test                                      | Input                                                 | Expected                                                             |
| ----------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------- |
| No API key                                | GET /v1/admin/sessions/any/metrics                    | `401`                                                                |
| Wrong API key                             | GET with wrong key                                    | `401`                                                                |
| Valid key, unknown session                | `sessionRepository.findById` returns `null`           | `404 NOT_FOUND`                                                      |
| Valid key, known session, no events       | `eventLogRepository` returns `[]`                     | `200` with empty `turns`, summary zeros                              |
| Valid key, known session, 2 turns with GM | `eventLogRepository` returns mock events              | `200` with `turns.length === 2`, `turnsWithGm: 2`, non-zero averages |
| Valid key, known session, 1 turn no GM    | `eventLogRepository` returns 1 `turn_completed` event | `200`, `hasGm: false`, no GM fields                                  |

Stub `ISessionRepository.findById` to return a minimal `Session` object for the "known session" cases.

Stub `IEventLogRepository.findBySessionId` to return canned event arrays.

Do not test Langfuse or real DB in this file.

## Stack-E2E Test Targets

### admin-metrics.stack-e2e.test.ts

Location: `apps/core/src/api/routes/admin-metrics.stack-e2e.test.ts`

Pattern: follow `admin-sessions.stack-e2e.test.ts`.

Required tests:

```
1. No API key → 401
2. Wrong API key → 401
3. Valid key, unknown sessionId → 404 with NOT_FOUND code in envelope
4. TODO(EPIC-4.3): happy-path 200 with real turn data — deferred until seeded session flow exists in stack
```

For test 4: since no seeding API exists to create a session with completed turns in a single atomic request, add a `it.skip` with a clear comment:

```ts
// TODO(EPIC-4.3): add happy-path test once a stack-level session seeding utility exists
// The shape is validated in admin-metrics.test.ts using injected stubs
it.skip('returns 200 with turn metrics for a session with completed turns', ...)
```

Tests 1–3 must run against the live stack without any seeding.

### Config

- Reads `APP_URL` from env, defaults to `http://localhost:3000`
- Reads `API_KEY` from env (or a well-known test key configured in the test stack)
- Uses `fetch` directly — no app injection

## Hardening Checklist

Before marking this prompt complete, verify:

- [ ] No test uses `any` type
- [ ] Mock event payloads match the exact shape produced by prompt 01 (field names must be identical)
- [ ] Route test stubs implement the full repository interface (all methods, not just the ones called) — prevents TS errors
- [ ] `afterEach` / `afterAll` cleanup for server instances where needed
- [ ] Stack-E2E file is excluded from `vitest.config.ts` (unit config) and included in `vitest.stack-e2e.config.ts`
- [ ] Check `vitest.config.ts` — the `src/**/*.test.ts` include pattern also matches `*.stack-e2e.test.ts`; an explicit exclude must be added if not already present

## Constraints

- Do not mock `crypto.randomUUID` — use real UUIDs in test payloads
- Do not assert on exact latency values in route or stack-E2E tests — latency is non-deterministic; assert only type and range
- Test stubs for repositories must implement the full interface or use `vi.fn()` casts with explicit type annotations

## Mandatory Pre-Implementation Check

Before coding:

1. Check `vitest.config.ts` exclude patterns — confirm `*.stack-e2e.test.ts` is excluded.
2. Check existing `send-message.use-case.test.ts` — identify the test structure to extend cleanly.
3. Check existing `run-game-master.use-case.test.ts` — identify where GM event assertions live.
4. Check `admin-sessions.stack-e2e.test.ts` — copy auth test structure exactly.

## Deliverables

- `get-turn-metrics.use-case.test.ts` — complete unit coverage (or extended if partially written)
- `admin-metrics.test.ts` — 6 route tests using `app.inject()`
- `admin-metrics.stack-e2e.test.ts` — 3 passing + 1 skipped stack-E2E tests
- Extended `send-message.use-case.test.ts` — event append assertions
- Extended `run-game-master.use-case.test.ts` — GM payload enrichment assertions

## Mandatory Final Step — Documentation Update

After implementation:

- `docs/PROJECT_STATUS.md` — note test coverage complete for EPIC 4.3 metrics
- `docs/TEST_COVERAGE_PLAN.md` — add entry for `domain/metrics/` and `use-cases/get-turn-metrics/` if a coverage plan exists

## Acceptance Criteria

- [ ] All unit tests pass
- [ ] All route tests pass
- [ ] Stack-E2E tests 1–3 pass (test 4 is explicitly skipped)
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` all pass
- [ ] No test file includes `*.stack-e2e.test.ts` in the unit test run
