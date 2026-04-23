# 05 — Tests, Hardening & Doc Sync

## Context

All four previous prompts introduced new domain logic, use cases, routes, and infrastructure methods. This final prompt:

- closes coverage gaps by adding integration and edge-case tests
- validates the complete multi-avatar flow end-to-end
- confirms all quality gates pass from a clean state
- brings all project documentation in sync with the implementation

This prompt is the shipping gate for EPIC 4.4. Do not mark the EPIC complete until every item below is checked.

---

## Scope

### In scope

- Targeted unit tests for edge cases identified below
- One full integration test (`persistence.e2e.test.ts` extension or equivalent) verifying the GM-driven switch writes persist correctly to Postgres
- `PostgresConversationRepository.findActiveBySessionId()` integration test
- Documentation sync for all affected docs

### Out of scope

- New features not in Prompts 01–04
- Performance benchmarking (EPIC 4.3)

---

## Relevant Docs

- `docs/TEST_STRATEGY.md` — all test tiers and their contracts
- `docs/TEST_COVERAGE_PLAN.md` — per-module coverage expectations (update it)
- `docs/API_CONTRACT.md` — must be updated with all new endpoints
- `docs/DATA_MODEL.md` — must document `avatarTransitionRules` in `ScenarioConfig`
- `docs/GAME_MASTER_CONTRACT.md` — must document activated `conversationMode: 'new'` path
- `docs/PROJECT_STATUS.md` — must mark EPIC 4.4 complete

---

## Hardening Checklist

### Transition Engine (`transition-engine.ts`)

Verify the following edge cases have explicit tests:

- Rule with `fromAvatarId` matching current avatar but no `activeTrigger` → not returned
- Two rules with the same `fromAvatarId` and different `toAvatarId` → both returned
- `topic_repeat` rule where `rule.topic` is the empty string → treat as non-matching (defensive)

### `SwitchAvatarUseCase`

Verify:

- Switching when no active conversation exists (first switch, conversation was never started) → `previousConversationId: null`, no error
- Switching to same avatar creates a new conversation correctly
- `reason` field exceeding `maxLength: 200` at the schema level → validated at route layer, not use case

### `GetAvatarTransitionsUseCase`

Verify:

- Session with one conversation and no `handoffFromConversationId` → one record with `fromConversationId: null`, `reason: 'session_start'`
- Session with two conversations (A → B) where `B.handoffFromConversationId = A.conversationId` → two records with correct `fromAvatarId` linkage
- Session with conversation listing that has the `handoffFromConversationId` pointing to a missing ID (data inconsistency) → record created with `fromAvatarId: null`, no throw

### `RunGameMasterUseCase` (GM-driven switch)

Verify (if not already covered in Prompt 02 tests):

- GM outputs `conversationMode: 'new'` but `nextAvatarId` is empty string → switch skipped
- `findActiveBySessionId` returns `null` (no prior conversation) → new conversation created with `handoffFromConversationId: undefined`

---

## Integration Test

### `PostgresConversationRepository.findActiveBySessionId`

Add to `postgres-conversation.repository.integration.test.ts`:

1. Create session + avatar → no conversations → `findActiveBySessionId` returns `null`
2. Create conversation with `status: 'active'` → `findActiveBySessionId` returns it
3. Create two active-ish conversations (close the first one first) → returns only the active one
4. Create conversation, then update `status: 'closed'` → `findActiveBySessionId` returns `null`

### Full multi-avatar flow (`persistence.e2e.test.ts` extension)

Add a multi-avatar flow block that:

1. Creates scenario + 2 avatars via `PostgresScenarioRepository` / `PostgresAvatarRepository`
2. Creates session via `PostgresSessionRepository`
3. Creates conversation A (avatar 1) via `PostgresConversationRepository.create`
4. Calls `SwitchAvatarUseCase` (real use case, Postgres repos wired) → conversation A closed, conversation B created
5. Asserts: session `activeAvatarId` is avatar 2, conversation A `status: 'closed'`, conversation B `status: 'active'`, `B.handoffFromConversationId === A.conversationId`
6. Calls `GetAvatarTransitionsUseCase` → returns 2 records with correct linkage

---

## Documentation Sync

After all tests pass, update the following documents:

### `docs/API_CONTRACT.md`

Add or verify three new endpoint sections are present and accurate:

**`POST /v1/sessions/{sessionId}/switch-avatar`**

- Request: `{ avatarId: string, reason?: string }`
- Response: `SwitchAvatarOutput` shape
- Error mapping: 401, 400, 404, 409, 500

**`GET /v1/sessions/{sessionId}/available-avatars`**

- Response: `GetAvailableAvatarsOutput` shape
- Error mapping: 401, 404, 500

**`GET /v1/sessions/{sessionId}/avatar-transitions`**

- Response: `GetAvatarTransitionsOutput` with `AvatarTransitionRecord[]` shape
- Error mapping: 401, 404, 500

### `docs/DATA_MODEL.md`

In the `Scenario → Typical Config` section, add `avatarTransitionRules`:

```
- avatarTransitionRules (AvatarTransitionRule[]): defines eligible avatar transitions; evaluated by the domain transition engine
```

Add a sub-section or note under `ScenarioConfig` documenting `AvatarTransitionRule` fields (`fromAvatarId`, `toAvatarId`, `trigger`, optional `topic`).

### `docs/GAME_MASTER_CONTRACT.md`

- Section 3 (Turn Pipeline): update step 6 to state that when `conversationMode === 'new'` and `nextAvatarId` is valid, the use case closes the current conversation and opens a new one.
- Section 5 (GM Output): add a note under `conversationMode` clarifying that `'new'` is now active (remove any "deferred" language).
- Add a new section (e.g., Section 15) titled "Avatar Switch Flow" briefly describing:
  - When a rule-based transition fires
  - How `eligibleTransitions` is passed into `GameMasterInput.context`
  - The validation that `nextAvatarId` must be in the eligible set when rules exist

### `docs/PROJECT_STATUS.md`

Add an entry for EPIC 4.4 — Multi-Avatar Navigation v1:

```
## EPIC 4.4 — Multi-Avatar Navigation v1 ✅ Done

[Brief summary of what was implemented]

- AvatarTransitionRule types + transition-engine.ts (pure domain)
- GM-driven conversationMode: 'new' path activated in RunGameMasterUseCase
- POST /v1/sessions/:sessionId/switch-avatar — manual switch use case + route
- GET /v1/sessions/:sessionId/available-avatars
- GET /v1/sessions/:sessionId/avatar-transitions
- Full unit, integration, and stack-e2e test coverage
```

### `docs/TEST_COVERAGE_PLAN.md` (if it exists)

If this file exists, add entries for:

- `domain/avatar/transition-engine.ts` — 100% stmts/branches required (pure function)
- `application/use-cases/switch-avatar/` — unit tests required for all branches
- `application/use-cases/get-avatar-transitions/` — unit tests required for chain derivation edge cases

---

## Final Quality Gate Run

Run the following from the workspace root and confirm all pass:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter @gami/core test:coverage
```

Coverage thresholds must remain ≥ 80% on all dimensions (statements, branches, functions).

---

## Deliverables

- All edge-case unit tests added and passing
- `PostgresConversationRepository.findActiveBySessionId` integration tests
- Full multi-avatar flow block in `persistence.e2e.test.ts`
- `docs/API_CONTRACT.md` — three new endpoints documented
- `docs/DATA_MODEL.md` — `avatarTransitionRules` in `ScenarioConfig`
- `docs/GAME_MASTER_CONTRACT.md` — `conversationMode: 'new'` activated; Section 15 added
- `docs/PROJECT_STATUS.md` — EPIC 4.4 complete

---

## Mandatory Final Step — Documentation Update

This prompt IS the documentation update. Do not consider EPIC 4.4 complete until every doc listed above is synced.

---

## Acceptance Criteria

- [ ] All edge-case tests pass (see hardening checklist above)
- [ ] `PostgresConversationRepository.findActiveBySessionId` has ≥4 integration tests
- [ ] A multi-avatar flow integration test verifies the full Postgres write chain
- [ ] `docs/API_CONTRACT.md` has all three new endpoints with shapes and error maps
- [ ] `docs/DATA_MODEL.md` documents `avatarTransitionRules`
- [ ] `docs/GAME_MASTER_CONTRACT.md` has no "deferred" language for `conversationMode: 'new'`
- [ ] `docs/PROJECT_STATUS.md` marks EPIC 4.4 complete
- [ ] `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` all pass from root
- [ ] Coverage ≥ 80% on all dimensions retained
