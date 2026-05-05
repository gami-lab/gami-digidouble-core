# Prompt 05 — Tests, Hardening, and Documentation Sync

## Context

All four prior prompts in EPIC 4.2 have been implemented. This prompt completes the epic by:

1. Adding stack-e2e tests for all three new endpoints
2. Hardening the end-to-end error cases
3. Adding a Postgres integration test for `PostgresUserMemoryFactRepository`
4. Syncing all documentation to match the implementation

Run `pnpm lint`, `pnpm typecheck`, and `pnpm test` before and after each step to confirm
no regressions are introduced.

---

## Relevant Docs

- `docs/TEST_STRATEGY.md` — e2e test conventions for this repo
- `docs/TEST_COVERAGE_PLAN.md` — EPIC 4.2 coverage requirements
- `docs/DATA_MODEL.md` §10 — `user_memory_facts` table definition
- `docs/PROJECT_STATUS.md` — must be updated to mark EPIC 4.2 complete

---

## Mandatory Pre-Implementation Check

1. Run `pnpm test` — confirm all unit and route tests from prompts 01-04 pass.
2. Run `pnpm typecheck` — confirm zero errors.
3. Identify the existing stack-e2e test files to use as patterns (e.g., check
   `apps/core/src/` for `*.stack-e2e.test.ts` files).
4. Read `vitest.stack-e2e.config.ts` — confirm the include/exclude pattern; stack-e2e tests
   must only run under this config, not under `vitest.config.ts`.
5. Confirm `vitest.config.ts` has explicit excludes for `*.stack-e2e.test.ts` files.

---

## Step 1 — Stack-E2E Tests

### `GET /v1/users/{userId}/memory-facts`

File: `apps/core/src/api/routes/__stack_e2e__/list-user-memory-facts.stack-e2e.test.ts`
(or nearest equivalent naming convention — follow existing pattern exactly)

Required scenarios:

| Scenario                            | Expected                                                                               |
| ----------------------------------- | -------------------------------------------------------------------------------------- |
| No API key                          | 401, `error.code === 'UNAUTHORIZED'`                                                   |
| Wrong API key                       | 401, `error.code === 'UNAUTHORIZED'`                                                   |
| Valid key, user with no facts       | 200, `data.facts === []`                                                               |
| Valid key, user with 2 seeded facts | 200, `data.facts.length === 2`, each has `id`, `category`, `key`, `value`, `updatedAt` |
| `confidence` field                  | 200, `confidence === null` when not set                                                |

### `DELETE /v1/users/{userId}/memory-facts/{factId}`

File: `apps/core/src/api/routes/__stack_e2e__/delete-user-memory-fact.stack-e2e.test.ts`

Required scenarios:

| Scenario                                    | Expected                                            |
| ------------------------------------------- | --------------------------------------------------- |
| No API key                                  | 401 UNAUTHORIZED                                    |
| Valid key, factId not found                 | 404, `error.code === 'NOT_FOUND'`                   |
| Valid key, factId belongs to different user | 404, `error.code === 'NOT_FOUND'`                   |
| Valid key, valid factId                     | 200, `data.deleted === true`, `data.factId` matches |
| Double delete (fact already deleted)        | 404 on second call                                  |

### `GET /v1/admin/sessions/{sessionId}/memory`

File: `apps/core/src/api/routes/__stack_e2e__/admin-session-memory.stack-e2e.test.ts`

Required scenarios:

| Scenario                            | Expected                                                                   |
| ----------------------------------- | -------------------------------------------------------------------------- |
| No API key                          | 401 UNAUTHORIZED                                                           |
| Unknown sessionId                   | 404 NOT_FOUND                                                              |
| Known session, no facts, no summary | 200, `data.session.summary === ''`, `data.session.longTermFactCount === 0` |
| Known session after compaction      | 200, `data.session.summary` is non-empty string                            |
| Session with 3 seeded facts         | 200, `data.session.longTermFactCount === 3`                                |

---

## Step 2 — Hardening Checks

Verify these behaviors hold via unit tests. Add tests where missing:

### Fact extraction failure does not affect conversation close

In `end-conversation.use-case.test.ts`:

- Mock `IUserFactExtractor.extract` to throw
- Confirm `EndConversationUseCase.execute()` resolves normally
- Confirm a `user_fact_extraction_failed` event was emitted to the event log

### Missing repository in `SendMessageUseCase` does not break a turn

In `send-message.use-case.test.ts`:

- Construct `SendMessageUseCase` without `userMemoryFactRepository`
- Confirm turn completes normally
- Confirm system prompt does NOT contain a "User Context" section

### Cross-user fact deletion returns 404 not 403

Already covered in route tests — verify the error code is `NOT_FOUND`, not `FORBIDDEN`.

### Session reset does NOT delete user memory facts

In `reset-conversation.use-case.test.ts` (or the relevant reset use case test):

- Seed a user fact
- Call the reset use case
- Verify `IUserMemoryFactRepository.findByUserId` still returns the seeded fact after reset
- This is correct design: user facts are cross-session; reset only clears conversation state

---

## Step 3 — Postgres Integration Test

Create `apps/core/src/infrastructure/db/postgres-user-memory-fact-repository.integration.test.ts`.

This test runs against the real Postgres stack. Follow the existing integration test pattern
(transaction rollback per test or explicit cleanup).

Required cases:

| Case                                      | Expected                                             |
| ----------------------------------------- | ---------------------------------------------------- |
| `findByUserId` — no facts                 | Returns `[]`                                         |
| `upsert` — new fact                       | Returns fact with `id` set                           |
| `upsert` — same `(userId, category, key)` | Updates `value` and `updatedAt`                      |
| `upsert` — different `key` same user      | Returns 2 distinct facts                             |
| `findByUserId` after upsert               | Returns all facts for user only (not other users)    |
| `findById` — existing                     | Returns fact                                         |
| `findById` — unknown                      | Returns `null`                                       |
| `deleteById` — existing                   | Returns `true`, subsequent `findById` returns `null` |
| `deleteById` — unknown                    | Returns `false`                                      |
| `confidence` field round-trip             | Stored and returned as-is                            |

---

## Step 4 — Documentation Sync

### `docs/PROJECT_STATUS.md`

Mark EPIC 4.2 complete. Add a summary section covering:

- `user_memory_facts` table added to Postgres schema
- `PostgresUserMemoryFactRepository` implemented
- `IUserFactExtractor` port + `LlmUserFactExtractor` implemented
- Fact extraction wired into `EndConversationUseCase` (async, non-blocking)
- User facts injected into `SendMessageUseCase` → avatar system prompt
- Three API endpoints live: `GET /v1/users/{userId}/memory-facts`,
  `DELETE /v1/users/{userId}/memory-facts/{factId}`,
  `GET /v1/admin/sessions/{sessionId}/memory`

### `docs/DATA_MODEL.md`

§10 `user_memory_facts`: mark as **Implemented** (Phase A). Add note: "Extraction triggered
on conversation close (async). Injected into avatar context on each turn (bounded to 10 facts)."

### `docs/API_CONTRACT.md`

For each of §14, §15, §A5 — verify the response shapes match implementation.
Update status from "PLANNED" to "IMPLEMENTED" where applicable.
If any field name or type diverged during implementation, update the contract to match.

---

## Step 5 — Final Quality Gate

Run in order:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter @gami/core test:integration  # if available
pnpm --filter @gami/core test:coverage
```

Confirm:

- Zero lint errors
- Zero type errors
- All unit and route tests pass
- Coverage for the new modules is not below project targets

---

## Constraints

- Stack-e2e tests must only run under `vitest.stack-e2e.config.ts`
- `vitest.config.ts` must explicitly exclude `*.stack-e2e.test.ts` (verify — do not assume)
- Integration tests must not be included in the main `pnpm test` run
- No new prod dependencies in this prompt

---

## Deliverables

- Stack-e2e test files for all three memory endpoints
- Hardening unit tests (extraction failure, reset isolation, cross-user deletion)
- Postgres integration test for `PostgresUserMemoryFactRepository`
- Updated `docs/PROJECT_STATUS.md` marking EPIC 4.2 complete
- Updated `docs/DATA_MODEL.md` §10 implementation status
- Updated `docs/API_CONTRACT.md` §14, §15, §A5 status

---

## Acceptance Criteria

- [ ] Stack-e2e tests cover auth, 404, and happy-path shapes for all 3 endpoints
- [ ] Session reset does not delete user facts (verified by test)
- [ ] Extraction failure does not block conversation close (verified by test)
- [ ] Postgres integration tests pass for all repository operations
- [ ] `docs/PROJECT_STATUS.md` marks EPIC 4.2 complete
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` all pass with zero errors
