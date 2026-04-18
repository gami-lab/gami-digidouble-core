# 05 — Hardening, Coverage Gate, and Doc Sync

## Context

Prompts 01–04 delivered three new endpoints, three new use cases, one new port method, and
stack-e2e tests. This prompt hardens the delivery: verifies the coverage gate holds, runs
all quality checks, and synchronizes documentation so the repository stays authoritative.

---

## Scope

**In scope:**

- Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:coverage` — fix any failures
- Verify coverage gate (≥80% all metrics) is still met after new code is added
- Review and complete test cases if any gap is found under the coverage report
- Update all impacted documentation files
- Final EPIC 2.2 closure check

**Out of scope:**

- Adding new features or endpoints not defined in Prompts 01–03
- Performance testing (EPIC 4.3)
- Mutation testing (nightly, not a PR gate)

---

## Relevant Docs

- `docs/TEST_STRATEGY.md` — coverage thresholds, test tiers
- `docs/TEST_COVERAGE_PLAN.md` — Conversation Module coverage checklist
- `apps/core/vitest.config.ts` — current coverage thresholds

---

## Hardening Checklist

Run every command below and fix whatever fails before marking EPIC 2.2 complete:

```sh
pnpm lint          # zero errors, zero warnings
pnpm typecheck     # zero errors in strict mode
pnpm test          # all tests pass
pnpm test:coverage # coverage thresholds met (≥80% lines/branches/functions/statements)
```

Additional manual checks:

- [ ] No `any` types in new production code (`use-cases/`, `routes/`, `infrastructure/`)
- [ ] `TODO(EPIC-2.2)` comment in `send-message.use-case.ts` has been updated to `TODO(EPIC-4.1)`
- [ ] No remaining `TODO(EPIC-2.2)` anywhere in the codebase (search for it)
- [ ] `conversations.ts` route plugin is registered in `server.ts` and prefix is `/v1/conversations`
- [ ] `messagesRoute` and `conversationsRoute` do not conflict on any path (no route overlap)
- [ ] `IMessageRepository.deleteBySessionId` is defined in the port and implemented in `InMemoryMessageRepository`

---

## Test Gap Analysis

If coverage drops below 80% after new code is added, check these likely gap areas before
adding tests:

| File                              | Likely uncovered branch                                  |
| --------------------------------- | -------------------------------------------------------- |
| `start-session.use-case.ts`       | Validation error for blank `userId` or `scenarioId`      |
| `get-history.use-case.ts`         | Empty message list (session found but no messages)       |
| `reset-session.use-case.ts`       | `deletedCount === 0` (reset of session with no messages) |
| `conversations.ts` route          | `DomainError` with unexpected code falls through to 500  |
| `in-memory-message.repository.ts` | `deleteBySessionId` on empty store                       |

For each uncovered branch, add the minimum test in the corresponding `*.use-case.test.ts` or
`conversations.test.ts` to cover it. Do not add redundant tests for branches already covered.

---

## Documentation Updates

### `docs/PROJECT_STATUS.md` (always required)

Mark EPIC 2.2 — Session Lifecycle v1 as **Complete**.

List all new files:

- `application/use-cases/start-session/start-session.types.ts`
- `application/use-cases/start-session/start-session.use-case.ts`
- `application/use-cases/start-session/start-session.use-case.test.ts`
- `application/use-cases/get-history/get-history.types.ts`
- `application/use-cases/get-history/get-history.use-case.ts`
- `application/use-cases/get-history/get-history.use-case.test.ts`
- `application/use-cases/reset-session/reset-session.types.ts`
- `application/use-cases/reset-session/reset-session.use-case.ts`
- `application/use-cases/reset-session/reset-session.use-case.test.ts`
- `application/ports/IMessageRepository.ts` — `deleteBySessionId` added
- `infrastructure/db/in-memory-message.repository.ts` — `deleteBySessionId` implemented
- `api/routes/conversations.ts` — all three session lifecycle endpoints
- `api/routes/conversations.test.ts`
- `api/routes/conversations.stack-e2e.test.ts`

Record the final test suite count and updated coverage baseline.

Update the Sprint 2 status table to show EPIC 2.2 complete.

### `docs/API_CONTRACT.md`

Review sections 1, 4, and 6 against what was actually implemented:

**§1 Start Session:**

- Note that `user` nesting and `initialContext` were deferred (not in EPIC 2.2)
  - Implemented request shape: `{ userId: string, scenarioId: string }`
  - Deferred: nested `user` object, `externalId`, `email`, `user.metadata`, `initialContext`, `gameMaster` in response
- Add a `> Sprint 2 implementation note:` callout explaining what was built vs what is documented

**§4 Get Conversation History:**

- Confirm `{ session, messages }` shape matches implementation
- Note that `memory` field is absent until EPIC 4.2

**§6 Reset Session:**

- Confirm `{ sessionId, deleted: { messages, sessionMemory, events } }` matches
- Note that `sessionMemory: false` and `events: 0` are hardcoded until EPIC 4.2 and EPIC 3.3

**Also update the Behavior section for `POST /v1/conversations/:sessionId/messages`:**

- Replace `Game Master trigger integration is not active yet (TODO(EPIC-2.2)` with
  `Game Master trigger integration is not active yet (TODO(EPIC-4.1)` to reflect the renumbering

### `docs/DATA_MODEL.md`

Add a note to the Message entity section:

> The `IMessageRepository` port now includes `deleteBySessionId(sessionId): Promise<number>`,
> added in EPIC 2.2. The return value is the count of deleted messages.

No new entity was added; no schema change.

### `docs/ARCHITECTURE.md`

If there is an "Application layer — use cases" section or similar, add the three new use cases
to the list. If not, add a note under the Conversation module section.

---

## Commit Convention

Commit each prompt's work independently if possible. The final hardening commit should be:

```
feat(conversation): EPIC 2.2 — Session Lifecycle v1 complete [EPIC-2.2]
```

Or split into:

```
feat(conversation): add StartSessionUseCase + POST /v1/conversations/start [EPIC-2.2]
feat(conversation): add GetHistoryUseCase + GET /v1/conversations/:sessionId/history [EPIC-2.2]
feat(conversation): add ResetSessionUseCase + DELETE /v1/conversations/:sessionId [EPIC-2.2]
test(conversation): complete lifecycle stack-e2e; update deferred messages comment [EPIC-2.2]
docs: sync documentation after EPIC 2.2 Session Lifecycle v1 [EPIC-2.2]
```

---

## Acceptance Criteria

- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:coverage` all pass clean
- [ ] Coverage gate (≥80% all metrics) is green
- [ ] No `TODO(EPIC-2.2)` remains anywhere in production code or tests
- [ ] `docs/PROJECT_STATUS.md` marks EPIC 2.2 complete with all files listed
- [ ] `docs/API_CONTRACT.md` §1, §4, §6 reflect the actual Sprint 2 implementation
- [ ] `docs/DATA_MODEL.md` mentions `deleteBySessionId` port addition
- [ ] `docs/ARCHITECTURE.md` is consistent with the new use case files
- [ ] Test suite count and coverage baseline are recorded in `PROJECT_STATUS.md`
