# Working Memory Storage And Repository Layer

## Context

Memory v1 stores working memory in a single `sessions.memory_summary` string and long-term memory
in `user_memory_facts`. EPIC 4.2b needs a real pyramidal model:

- short-term memory stays derived from raw messages
- working memory becomes a first-class persisted layer
- long-term memory continues to reuse `user_memory_facts`

`docs/DATA_MODEL.md` already defines `SessionMemory` and `AvatarSessionMemory` as separate
concepts. This prompt makes those stores real.

## Scope

**In scope:**

- storage schema evolution for working memory
- repository ports and implementations for session-level and avatar-level working memory
- in-memory adapters for tests and Postgres adapters for production
- backward-compatible handling of the existing `sessions.memory_summary` field

**Out of scope:**

- async maintenance / compaction logic
- turn-context assembly
- GM memory consumption
- new endpoints

## Relevant Docs

- `docs/DATA_MODEL.md` §4, §8, §9, §10
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/TEST_STRATEGY.md`
- `docs/PROJECT_STATUS.md`

## Mandatory Pre-Implementation Check

1. Identify touched entities/contracts:
   - `Session`
   - working-memory domain types from Prompt 00
   - admin memory read model(s)
2. Search for duplicated storage-related shapes in repositories and tests.
3. Confirm the canonical owner of working-memory row/domain types.
4. Reuse existing repository patterns from `infrastructure/db/repositories/`.
5. If table naming for v2 memory is ambiguous, choose one canonical convention and update docs in
   the same change.

## Implementation Guidance

1. Add dedicated persistence for:
   - global session working memory
   - avatar-scoped working memory per `(sessionId, avatarId)`

2. Use explicit repository ports in `apps/core/src/application/ports/`, for example:
   - `ISessionMemoryRepository`
   - `IAvatarSessionMemoryRepository`

   Keep the contracts minimal:
   - `findBySessionId(...)`
   - `findBySessionIdAndAvatarId(...)`
   - `upsert(...)`
   - delete/reset helpers needed by session reset

3. Add in-memory implementations in `apps/core/src/infrastructure/db/` and Postgres
   implementations in `apps/core/src/infrastructure/db/repositories/`.

4. Prefer compact summary storage, not transcript duplication. A working-memory row should hold the
   bounded summary text plus timestamps and scope identifiers. Do **not** add raw message blobs.

5. Keep `sessions.memory_summary` temporarily as a backward-compatible cache / mirror until the
   rest of the EPIC migrates read paths. The canonical source should move toward the dedicated
   working-memory repository, but existing consumers must stay green during the transition.

6. Update reset semantics:
   - resetting a session clears session working memory
   - resetting a session clears avatar working memories for that session
   - resetting a session does **not** delete `user_memory_facts`

7. Add integration tests for the Postgres repositories and unit tests for the in-memory ones.
   Cover:
   - insert/upsert
   - overwrite/update behavior
   - per-avatar isolation
   - session reset cleanup behavior

8. Wire default adapters through server/application construction only where needed for later prompts.
   Do not prematurely thread the new repositories everywhere in this slice.

## Constraints

- no raw transcript storage in working-memory tables
- no queue or background worker introduction here
- keep repository interfaces narrow and deterministic
- preserve backward compatibility with the existing session summary field during migration
- do not create a second long-term memory store

## Deliverables

- working-memory schema additions in `infra/postgres/init.sql`
- repository ports for session and avatar working memory
- in-memory repository implementations with unit tests
- Postgres repository implementations with integration tests
- reset-path support for clearing working memory while preserving long-term facts

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- `docs/DATA_MODEL.md`
- `docs/ARCHITECTURE.md` if repository ownership or layer placement changed materially
- `docs/TEST_STRATEGY.md` / `docs/TEST_COVERAGE_PLAN.md` if repository test expectations changed

If no doc changes are needed, explicitly verify that docs still match the new storage shape.

## Acceptance Criteria

- [ ] session working memory has dedicated persistence
- [ ] avatar working memory has dedicated persistence
- [ ] session reset clears working memory but preserves long-term user facts
- [ ] in-memory and Postgres adapters implement the same contract
- [ ] repository unit/integration tests cover upsert, isolation, and cleanup behavior
- [ ] `pnpm typecheck` and relevant tests pass
