# 05 — Hardening and Doc Sync

## Context

All EPIC 2.2 endpoints and use cases are implemented (Prompts 01–04). This final prompt
ensures the implementation is tight, the coverage gate holds, and the documentation accurately
reflects what was built.

This step is not optional. Documentation drift is a structural risk — if `API_CONTRACT.md` or
`DATA_MODEL.md` diverge from the implementation, the next EPIC generation will be built on
wrong assumptions.

---

## Scope

**In scope:**

- Test gap analysis and fill for new use cases
- Coverage gate verification (≥80% on all dimensions)
- Full lint + typecheck + test run
- `docs/API_CONTRACT.md` sync
- `docs/DATA_MODEL.md` sync
- `docs/PROJECT_STATUS.md` sync
- Update stale `TODO(EPIC-2.2)` markers in code and docs to `TODO(EPIC-4.1)`

**Out of scope:**

- New features or behavior changes
- Refactoring beyond what is necessary for correctness
- Tests for behavior not built in this EPIC

---

## Relevant Docs

- `docs/API_CONTRACT.md` — all sections touched by EPIC 2.2
- `docs/DATA_MODEL.md` — Scenario, Avatar, Session, Message entities
- `docs/PROJECT_STATUS.md` — current sprint status table
- `docs/TEST_STRATEGY.md` — coverage tier definitions
- `apps/core/vitest.config.ts` — current coverage thresholds and exclusions

---

## Implementation Guidance

### 1. Test Gap Analysis

For each new use case and module, identify likely untested branches and write targeted tests.

**CreateScenarioUseCase:**

- Invalid slug pattern → DomainError VALIDATION_ERROR
- Blank name → DomainError VALIDATION_ERROR
- Invalid status value → DomainError VALIDATION_ERROR
- Valid input → returns scenarioId, name, slug, status

**CreateAvatarUseCase:**

- Blank name / personaPrompt → DomainError VALIDATION_ERROR
- Scenario not found → DomainError NOT_FOUND
- Valid input with optional fields omitted → AvatarConfig returned with defaults

**StartSessionUseCase:**

- Blank userId → DomainError VALIDATION_ERROR
- Blank scenarioId → DomainError VALIDATION_ERROR
- Valid input → session created with status 'active'

**GetHistoryUseCase:**

- Session not found → DomainError NOT_FOUND
- Session found, no messages → session returned with empty messages array
- Session found with messages → messages returned sorted by createdAt

**ResetSessionUseCase:**

- Session not found → DomainError NOT_FOUND
- Session found → messages deleted, count returned, session record preserved

**InMemoryScenarioRepository:**

- `create` generates `scenario_` prefixed ID
- `findById` returns null for unknown ID
- Constructor with initial data

**InMemoryAvatarRepository (extended):**

- `create` generates `avatar_` prefixed ID
- `findById` still works after `create`

**InMemoryMessageRepository (extended):**

- `deleteBySessionId` removes only matching session's messages
- `deleteBySessionId` returns correct count
- `deleteBySessionId` on session with no messages returns 0

### 2. Conversation route inject tests (if missing)

Review `conversations.test.ts` for any missing error-path coverage:

- `POST /start` with closed/archived session IDs — not applicable (session is new)
- `GET /history` when session is closed → still returns 200 (no status gate)
- `DELETE /:sessionId` when session is closed but exists → returns 200 (reset is always allowed)

### 3. Coverage Gate

Run:

```bash
pnpm --filter @gami/core test:coverage
```

Confirm ≥80% lines/branches/functions/statements.

If coverage drops below threshold:

- Check `vitest.config.ts` `coverage.exclude` — ensure new in-memory repos and route files are
  not accidentally excluded
- Do not raise the threshold — fix the gap

### 4. Update Stale TODO Markers

Search for `TODO(EPIC-2.2)` across the codebase:

```bash
grep -r "TODO(EPIC-2.2)" apps/ docs/
```

Expected occurrences:

**`apps/core/src/application/use-cases/send-message/send-message.use-case.ts`**

```ts
// TODO(EPIC-2.2): trigger GM observation
```

Change to:

```ts
// TODO(EPIC-4.1): trigger GM observation
```

**`docs/API_CONTRACT.md` §2 (Send Message → Behavior section)**

```
Game Master trigger integration is not active yet (`TODO(EPIC-2.2)` in use case)
```

Change to:

```
Game Master trigger integration is not active yet (`TODO(EPIC-4.1)` in use case)
```

If there are other `TODO(EPIC-2.2)` markers not listed above, update them to the appropriate
EPIC number (EPIC-4.1 for GM, or the correct EPIC for whatever the TODO describes).

### 5. docs/API_CONTRACT.md Sync

Verify and update the following sections:

**§1 Start Session:**

Add implementation note:

> Sprint 2 simplification: the request body uses flat `{ userId: string, scenarioId: string }`.
> The nested `user` object and `initialContext` from the full contract are deferred.
> The route does not validate that `scenarioId` references an existing scenario (no FK check in-memory).

Confirm response shape matches `StartSessionResponse` implemented in the routes.

**§4 Get Conversation History:**

Add implementation note:

> `memory` field is absent in Sprint 2. Deferred to EPIC 4.2 (Memory Layer).

**§6 Reset Session:**

Add implementation note:

> `sessionMemory` is hardcoded to `false` (EPIC 4.2); `events` is hardcoded to `0` (EPIC 3.3).
> The session record itself is not deleted — only messages are removed.

**New avatar endpoint (added in Prompt 02):**

Verify the `POST /v1/scenarios/:scenarioId/avatars` section is complete and accurate in
`API_CONTRACT.md`. Confirm request body matches implementation, response matches, and error
mapping (400, 401, 404, 500) is documented.

**§8 Create Scenario:**

Add implementation note:

> Slug uniqueness is not enforced in Sprint 2 (no scenario list query to check).

### 6. docs/DATA_MODEL.md Sync

**§2 Scenario:**

Verify the listed fields match `domain/scenario/scenario.types.ts`. The existing Scenario type
has `scenarioId`, `name`, `slug`, `status`, `config`, `createdAt`, `updatedAt`.

Note any delta between the DATA_MODEL description and the TypeScript implementation.

**§3 Avatar:**

Confirm: `AvatarConfig` (runtime shape) vs `Avatar` (persistence shape) distinction is documented.
EPIC 2.1 established this distinction. Verify the section is consistent with:

- `avatar.types.ts` fields
- The `create` method params added in Prompt 02
- The fact that `AvatarConfig` omits `createdAt`/`updatedAt`

### 7. docs/PROJECT_STATUS.md Sync

Update the Sprint 2 table to reflect EPIC 2.2 completion:

Mark EPIC 2.2 as **Complete** with a summary:

```
EPIC 2.2 — Scenario & Session Lifecycle v1 | Complete |
POST /v1/scenarios, POST /v1/scenarios/:scenarioId/avatars,
POST /v1/conversations/start, GET /v1/conversations/:sessionId/history,
DELETE /v1/conversations/:sessionId implemented.
IScenarioRepository, IAvatarRepository.create, IMessageRepository.deleteBySessionId added.
messages.stack-e2e.test.ts happy path unblocked.
```

Update the sprint status table header if it is stale relative to the current EPICS.md structure.

Also update **Implemented Modules** section to include:

- Session lifecycle (start, history, reset)
- Scenario management (create)
- Avatar management (create)

### 8. Full Quality Gate Run

Run all gates and confirm all pass:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter @gami/core test:coverage
```

If any gate fails, fix before marking EPIC complete.

---

## Constraints

- No behavior changes — this prompt is hardening only
- Do not raise coverage thresholds — fix coverage gaps instead
- TODO markers must reference the correct future EPIC — never leave `EPIC-2.2` in comments
  after this EPIC is done
- Documentation changes must be accurate — do not add notes about behavior not yet implemented
  without a TODO reference to the correct EPIC

---

## Deliverables

- New or updated unit tests for all new use cases (gap fill)
- `pnpm test:coverage` passing at ≥80% on all dimensions
- `TODO(EPIC-2.2)` → `TODO(EPIC-4.1)` in use case and API_CONTRACT
- `docs/API_CONTRACT.md` updated with implementation notes and avatar endpoint confirmed accurate
- `docs/DATA_MODEL.md` verified accurate; Avatar create/AvatarConfig distinction confirmed
- `docs/PROJECT_STATUS.md` updated to mark EPIC 2.2 Complete

---

## Mandatory Final Step — Documentation Update

This entire prompt IS the documentation update step. After completing it:

- Reread `docs/PROJECT_STATUS.md` to confirm it accurately reflects what is now implemented
- Reread `docs/API_CONTRACT.md` §1, §4, §6, §8, and the new avatar endpoint section to confirm
  accuracy
- If any section is still inaccurate, fix it before closing the EPIC

---

## Suggested Commit Messages

Following Conventional Commits + EPIC tag convention:

```
test(scenario): add unit tests for CreateScenarioUseCase and InMemoryScenarioRepository [EPIC-2.2]
test(avatar): add unit tests for CreateAvatarUseCase and IAvatarRepository.create [EPIC-2.2]
test(conversation): add unit tests for StartSession, GetHistory, ResetSession use cases [EPIC-2.2]
fix(send-message): update TODO marker from EPIC-2.2 to EPIC-4.1 [EPIC-2.2]
docs: sync API_CONTRACT, DATA_MODEL, PROJECT_STATUS for EPIC 2.2 completion [EPIC-2.2]
```

Or as a single closing commit if all tests were written incrementally:

```
feat(scenario-session): EPIC 2.2 — Scenario & Session Lifecycle v1 complete [EPIC-2.2]
```

---

## Acceptance Criteria

- [ ] All new use cases have unit tests covering validation errors, not-found paths, and success
- [ ] `InMemoryScenarioRepository`, `InMemoryAvatarRepository.create`, `InMemoryMessageRepository.deleteBySessionId` all have unit tests
- [ ] Coverage gate (≥80% all dimensions) passes
- [ ] `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` all pass
- [ ] No `TODO(EPIC-2.2)` remains anywhere in `apps/` or `docs/`
- [ ] `API_CONTRACT.md` has implementation notes on §1, §4, §6, avatar endpoint
- [ ] `DATA_MODEL.md` accurately reflects Avatar create/AvatarConfig distinction
- [ ] `PROJECT_STATUS.md` marks EPIC 2.2 as Complete with accurate summary
