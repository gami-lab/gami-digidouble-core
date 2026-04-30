# 05 — Tests, Hardening, and Doc Sync

## Context

All core features are implemented (prompts 01–04). This prompt closes the EPIC by adding
integration tests for the Postgres repository, hardening edge cases across the persona pipeline,
and synchronizing all documentation to reflect the completed implementation.

## Scope

**In scope:**

- Integration tests for `PostgresUserRepository` (against a real DB)
- Additional edge-case unit tests not covered in earlier prompts
- Console awareness: check if the console app has any user-related UI or `userId` display that
  should surface persona (if trivial, add it; if complex, explicitly defer to EPIC 2.1b)
- Full documentation sync across all impacted docs
- Final quality gate run: `pnpm lint && pnpm typecheck && pnpm test && pnpm --filter @gami/core test:coverage`

**Out of scope:**

- New features or behavior changes
- Streaming persona updates
- Per-conversation persona overrides

## Relevant Docs

- `docs/TEST_STRATEGY.md` — integration test pattern (real DB via `vitest.integration.config.ts`)
- `docs/TEST_COVERAGE_PLAN.md` — expected coverage per module
- All other docs listed below under "Documentation Update"

## Integration Tests

### `postgres-user.repository.integration.test.ts`

Location: `infrastructure/db/repositories/postgres-user.repository.integration.test.ts`

Pattern: follow `postgres-session.repository.integration.test.ts`.

Required test cases:

1. `upsert` creates a new user row when userId does not exist; `findById` returns it
2. `upsert` replaces persona when called twice for the same userId; `updatedAt` advances
3. `upsert` with `persona: {}` stores an empty object; `findById` returns `persona: undefined` or
   `persona: {}` (document the behavior either way)
4. `upsert` with `persona: { role: 'friend', tonePreference: 'warm' }` → all fields round-trip
5. `findById` returns `null` for an unknown userId
6. `upsert` with `interactionHints: ['hint1', 'hint2']` → array round-trips correctly

### Hardening edge cases

#### Persona injection graceful degradation

Ensure `send-message.use-case.test.ts` covers:

- `userRepository.findById` returns a user with `persona: undefined` — no persona sentence emitted
- `userRepository.findById` throws an unexpected error — message is still delivered successfully

#### `assemblePersonaPrompt` boundary cases

Ensure `persona-prompt.service.test.ts` covers:

- `userPersona.role` is an empty string `""` → no persona sentence emitted (treat as absent)
- `userPersona.role` is whitespace only → no persona sentence emitted
- `userPersona.tonePreference` set without role → behavior is well-defined (emit or not — be consistent)

#### Route input edge cases

Ensure `users.test.ts` covers:

- `PUT /v1/users/:userId/persona` with body `{ "unknownField": "x" }` → `additionalProperties: false`
  causes 400
- `PUT` with `userId` containing only whitespace (e.g. `"   "`) is rejected by `minLength: 1` rule
  or Fastify param validation

## Documentation Sync

Review and update **all** of the following:

### `docs/API_CONTRACT.md`

- Verify the User Persona section added in prompt 02 is accurate and complete.
- Confirm `UserPersona` type definition under "Core Types" matches the implementation.
- Add a note that `GET /v1/users/{userId}/persona` returns 200 with `{ persona: null }` (not 404)
  for unknown users — this is intentional and must be documented.

### `docs/DATA_MODEL.md`

- Under **User** entity, add an Implementation Status block:

  ```
  ### Implementation Status (EPIC 5.5)
  - Table: `users`
  - Repository: `PostgresUserRepository`
  - Status: Fully implemented. `persona` is a JSONB column; all fields optional.
  - Column note: `id` is TEXT (not UUID) — mirrors `sessions.user_id TEXT`.
  ```

- Confirm `persona` JSONB shape documented in the Notes matches the implemented `UserPersona` type.

### `docs/ARCHITECTURE.md`

- Add `domain/user/` to the domain module map with a short description:
  `user/ → User entity, UserPersona type`
- If there is a module-to-use-case mapping section, add `UpsertUserPersonaUseCase`,
  `GetUserPersonaUseCase`.

### `docs/GAME_MASTER_CONTRACT.md`

- Confirm the `context.userPersona` field addition from prompt 04 is already documented.
  If not, add it now under the GM Input section.

### `docs/PROJECT_STATUS.md`

- Mark EPIC 5.5 as complete in the status table.
- Add a brief log entry describing what was implemented.

## Final Quality Gate

Run all quality checks:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter @gami/core test:coverage
```

Resolve any failures before committing. Coverage for:

- `api/routes/users.ts` → target 100%
- `application/use-cases/upsert-user-persona/` → target 100%
- `application/use-cases/get-user-persona/` → target 100%
- `infrastructure/db/in-memory-user.repository.ts` → target 100%
- `domain/user/user.types.ts` → 0% is expected (type-only file)

## Constraints

- No new features — this is a hardening and doc sync prompt only
- Do not alter behavior to fix coverage; add tests that reflect real usage
- Integration tests require a running DB; confirm the test config (`vitest.integration.config.ts`)
  handles the DB connection

## Deliverables

- `apps/core/src/infrastructure/db/repositories/postgres-user.repository.integration.test.ts`
- Updated unit tests in `persona-prompt.service.test.ts`, `send-message.use-case.test.ts`,
  `users.test.ts` as needed
- `docs/API_CONTRACT.md` — verified and complete
- `docs/DATA_MODEL.md` — User Implementation Status block added
- `docs/ARCHITECTURE.md` — `domain/user/` added to module map
- `docs/GAME_MASTER_CONTRACT.md` — `context.userPersona` documented
- `docs/PROJECT_STATUS.md` — EPIC 5.5 marked complete

## Mandatory Pre-Implementation Check

Before writing tests:

1. Run `pnpm lint && pnpm typecheck && pnpm test` — confirm baseline passes from prompts 01–04.
2. Run `pnpm --filter @gami/core test:coverage` — identify uncovered lines in new code.
3. Confirm integration test DB setup matches the pattern in other `*.integration.test.ts` files.
4. Confirm the `users` table DDL was actually applied to the local DB (restart Docker stack if needed).

## Mandatory Final Step — Documentation Update

This prompt IS the doc sync. Confirm every doc in the deliverables list has been reviewed and
updated before committing.

Commit message format:

```
feat(epic-5-5): implement User Persona System — storage, API, avatar + GM injection [EPIC-5.5]
```

## Acceptance Criteria

- [ ] `postgres-user.repository.integration.test.ts` covers all 6 cases listed above
- [ ] Edge cases for graceful degradation are tested in `send-message.use-case.test.ts`
- [ ] Empty/whitespace role handled consistently in `assemblePersonaPrompt`
- [ ] `api/routes/users.ts` has 100% coverage
- [ ] `docs/API_CONTRACT.md` documents both endpoints accurately
- [ ] `docs/DATA_MODEL.md` has User implementation status
- [ ] `docs/ARCHITECTURE.md` lists `domain/user/`
- [ ] `docs/GAME_MASTER_CONTRACT.md` documents `context.userPersona`
- [ ] `docs/PROJECT_STATUS.md` marks EPIC 5.5 complete
- [ ] `pnpm lint && pnpm typecheck && pnpm test` all pass
