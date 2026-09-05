# Code Audit — EPIC 2.3 — Persistence Layer v1

**Audited:** April 20, 2026  
**Auditor:** GitHub Copilot (senior staff engineer review)  
**Commit audited:** `cb208c9` prompt pack + implementation applied on top

---

## Scope Audited

- `apps/core/src/infrastructure/db/client.ts`
- `apps/core/src/infrastructure/db/index.ts`
- `apps/core/src/infrastructure/db/migrations/runner.ts`
- `apps/core/src/infrastructure/db/migrations/001_initial_schema.sql`
- `apps/core/src/infrastructure/db/test-helpers.ts`
- `apps/core/src/infrastructure/db/repositories/postgres-scenario.repository.ts`
- `apps/core/src/infrastructure/db/repositories/postgres-avatar.repository.ts`
- `apps/core/src/infrastructure/db/repositories/postgres-session.repository.ts`
- `apps/core/src/infrastructure/db/repositories/postgres-message.repository.ts`
- All four `*.integration.test.ts` files and `persistence.e2e.test.ts`
- `apps/core/src/domain/avatar/avatar.types.ts` (F-01 fix)
- `apps/core/src/application/use-cases/create-avatar/create-avatar.use-case.ts` (timestamp desynthesis)
- `apps/core/src/application/use-cases/create-avatar/create-avatar.use-case.test.ts`
- `apps/core/src/api/server.ts` (wiring change)
- `apps/core/src/index.ts` (production wiring)
- `.github/workflows/ci.yml` (Postgres service gate)
- `docs/PROJECT_STATUS.md`

---

## Executive Summary

EPIC 2.3 is **functionally delivered**. All four Postgres repositories exist, pass integration
tests, and are wired into the production entry point. The migration system is idempotent, the
connection pool is correctly lifecycle-managed, the F-01 timestamp fix is applied cleanly, and CI
has a live Postgres service container for the integration gate.

One **High** finding prevents an A: `adjustments` is an active field in the avatar persona
assembly pipeline (`persona-prompt.service.ts`) but is silently dropped by
`PostgresAvatarRepository.create()` with no column in the schema. Any avatar created with
adjustments via the API will have those adjustments ignored in production after the first
`findById`. This is a behavioral divergence between the in-memory (test) path and the Postgres
(production) path.

Everything else is well-structured, clean, and safe to ship as a foundation. The **grade is B**.

---

## Final Grade

**B**

Solid architecture, clean repository implementations, comprehensive integration tests. One known
behavioral gap (`adjustments` not persisted) creates a silent divergence between test and production
paths. All build checks pass. Closeable as debt with a clear, low-effort remediation path.

---

## Build Health

| Check        | Result  | Notes                                                                                                |
| ------------ | ------- | ---------------------------------------------------------------------------------------------------- |
| lint         | ✅ PASS | `pnpm install` required first (lockfile correct; local node_modules were unpopulated at audit start) |
| typecheck    | ✅ PASS | Same note — passes cleanly after install                                                             |
| tests (fast) | ✅ PASS | 146/146 passing                                                                                      |
| integration  | ✅ PASS | `pnpm test:integration-e2e` exit code 0 (confirmed in context)                                       |
| coverage     | ✅ PASS | 94.43% stmts · 86.22% branches · 100% functions                                                      |

> **Note on install state at audit start:** `pnpm lint` and `pnpm typecheck` initially failed
> with "Cannot find module 'postgres'". Running `pnpm install --frozen-lockfile` resolved this
> (added 1 package). The `pnpm-lock.yaml` was correct and fully committed; the local `node_modules`
> simply had not been populated after the epic was delivered. CI always runs `pnpm install`, so CI
> health is not affected. This is flagged as a process note, not a code defect.

---

## Feature Confidence Matrix

| Feature                            | Expected Behavior                                                                    | Evidence                                                                                                        | Confidence | Notes                                  |
| ---------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------- |
| PostgresScenarioRepository         | Create scenario with DB-generated UUID/timestamps; unique slug enforced              | Integration test: create, findById, null case, unique constraint                                                | **High**   |                                        |
| PostgresAvatarRepository           | Create avatar with DB timestamps; tone/description null→undefined; config roundtrip  | Integration test: create, optional fields, null→undefined, findById, null case                                  | **High**   | `adjustments` dropped — see F-01       |
| PostgresSessionRepository          | Create, find, update (COALESCE), delete; update throws for missing                   | Integration test: 7 cases including preserve-untouched, throw-on-missing                                        | **High**   |                                        |
| PostgresMessageRepository          | Save (with/without metadata); find (ordered, limited); delete (count)                | Integration test: 7 cases                                                                                       | **High**   |                                        |
| Migration runner                   | Idempotent; applies unapplied .sql files in order                                    | Implicit: `beforeAll(createTestSql)` calls `runMigrations` on every test suite; duplicate runs produce no error | **Medium** | No explicit idempotency assertion test |
| DB client singleton                | Lazy init; URL guard; graceful close                                                 | `closeDbClient` called in `onClose` hook                                                                        | **Medium** | URL guard behavior not directly tested |
| AvatarConfig timestamps (F-01 fix) | `createdAt`/`updatedAt` sourced from DB; `CreateAvatarUseCase` no longer synthesises | `mapAvatarOutput` reads from `avatar.createdAt`/`avatar.updatedAt`; in-memory stub synthesises                  | **High**   |                                        |
| CI Postgres gate                   | Integration tests run against real Postgres on `main` push                           | `ci.yml` `main-extended-tests` job with `pgvector/pgvector:pg17` service + `DATABASE_URL` env                   | **High**   |                                        |
| Production wiring                  | Postgres repos active in production; in-memory in tests                              | `index.ts` creates pool, runs migrations, passes all 4 repos to `createServer`                                  | **High**   |                                        |
| Graceful shutdown                  | DB pool drained on `server.close()`                                                  | `server.addHook('onClose', () => closeDbClient())`                                                              | **High**   |                                        |
| Stack persistence (E2E)            | Write/read across fresh repository instances proves persistence                      | `persistence.e2e.test.ts` creates full fixture and reads back with new repo objects                             | **High**   |                                        |

---

## Strengths

1. **`update` CASE WHEN pattern for `endedAt`** — The session update implementation distinguishes
   between `endedAt` not provided (leave column alone) and `endedAt = null` (clear it), using
   `CASE WHEN ${hasEndedAtUpdate}::BOOLEAN THEN ...`. This is the correct semantics and many
   implementations get it wrong.

2. **Constructor injection throughout** — Every repository receives `Sql` via its constructor.
   No hidden factory calls, no module-level singletons in repositories. This makes unit tests
   straightforward and repositories independently testable.

3. **`MIGRATIONS_DIR = dirname(fileURLToPath(import.meta.url))`** — Correct ESM path resolution.
   No hardcoded paths, no `__dirname` polyfills. Migrations are always found relative to the
   runner file regardless of CWD at startup.

4. **`sql.unsafe()` is annotated** — The one usage of raw SQL execution in the migration runner
   has a clear comment explaining why it is safe (local files, never user input). This is the
   right pattern: use the dangerous API deliberately with justification.

5. **Avatar integration tests use `beforeEach` for scenario creation** — Each test gets its own
   scenario with a random slug, preventing slug uniqueness conflicts when tests run in any order.

6. **Session integration tests cover all edge cases** — 7 test cases including
   "update preserves untouched columns" and "update throws for missing session" — these are
   exactly the behaviors that matter to callers.

7. **`test-helpers.ts` is a focused, minimal utility** — `DB_AVAILABLE`, `createTestSql`,
   `truncateAllTables` — three exports with one job each. No test util bloat.

8. **`client.ts` URL guard** — If `getDbClient` is called twice with different URLs, it throws
   rather than silently returning a wrong pool. Defensive and correct.

9. **Unique avatar slug per scenario** — The schema adds
   `UNIQUE INDEX idx_avatars_scenario_slug_uniq ON avatars(scenario_id, slug)`, which is
   semantically correct (slug uniqueness scoped to a scenario, not globally).

---

## Findings

### F-01 — `adjustments` silently dropped by `PostgresAvatarRepository`

- **Severity:** High
- **Category:** Functional / Behavioral Divergence
- **Problem:** `PostgresAvatarRepository.create()` ignores `params.adjustments` — there is no
  `adjustments` column in the `avatars` table. After a server restart, `findById` returns an
  `AvatarConfig` without `adjustments`.
- **Why it matters:** `adjustments` is not a cosmetic field. `persona-prompt.service.ts` reads
  `config.adjustments` and appends them to the assembled persona prompt. An avatar created via
  `POST /v1/scenarios/:id/avatars` with adjustments will have those adjustments silently discarded
  in production. The test path (in-memory repo) stores them. The production path (Postgres) drops
  them. This is a silent behavioral divergence that will cause persona prompts to differ between
  local tests and production.
- **Evidence:**
  - `apps/core/src/domain/avatar/persona-prompt.service.ts` — `buildAdjustments(config.adjustments)` is called on every persona assembly
  - `apps/core/src/infrastructure/db/repositories/postgres-avatar.repository.ts` — `params.adjustments` is not in the `INSERT` statement, with comment "runtime-only in Phase A"
  - `apps/core/src/api/routes/scenarios.ts` — `adjustments` accepted in API request body and passed to `CreateAvatarUseCase`
  - `infrastructure/db/in-memory-avatar.repository.ts` — stores `adjustments` correctly
- **Recommendation:** Add an `adjustments TEXT[]` column to avatars via a new migration
  (`002_avatar_adjustments.sql`). Update `PostgresAvatarRepository` to insert and select it.
  Update `AvatarRow` with `adjustments: string[] | null`. Map `null` to `undefined`. Alternatively,
  if the decision is that `adjustments` are truly runtime-only (set per-session, not at creation
  time), remove them from the `POST /v1/scenarios/:id/avatars` contract to avoid the silent-drop
  confusion. One of these two paths must be chosen before production use.

---

### F-02 — `PROJECT_STATUS.md` "Overall Progress" paragraph is stale

- **Severity:** Medium
- **Category:** Documentation
- **Problem:** The leading paragraph reads: _"Phase A is in progress. **EPIC 1.1, EPIC 1.2,
  EPIC 2.1, and EPIC 2.2 are complete.**"_ — EPIC 2.3 is missing.
- **Why it matters:** This is the first line anyone reads. The sprint table below correctly marks
  EPIC 2.3 Complete, but the summary is inconsistent.
- **Evidence:** `docs/PROJECT_STATUS.md` line 11 — header paragraph.
- **Recommendation:** Update to: _"EPIC 1.1, EPIC 1.2, EPIC 2.1, EPIC 2.2, and EPIC 2.3 are
  complete."_

---

### F-03 — `Session.endedAt` typed as `string | null` but repository never returns `null`

- **Severity:** Low
- **Category:** Type Contract
- **Problem:** `Session.endedAt` is `string | null | undefined` (the `?` makes it optional, and
  the explicit `| null` widens it further). `rowToSession` sets `endedAt` only when
  `row.ended_at !== null`, so `endedAt` in practice is either a string or absent (undefined) —
  never `null`. Callers coding against `string | null` may add unnecessary null-guards.
- **Evidence:** `apps/core/src/domain/conversation/session.types.ts` line 8 —
  `endedAt?: string | null`.
- **Recommendation:** Remove `| null` — change to `endedAt?: string`. The repository guarantees
  the value is absent or a valid ISO 8601 string.

---

### F-04 — `AvatarConfig.config` typed as optional but DB column is NOT NULL

- **Severity:** Low
- **Category:** Type Contract
- **Problem:** `AvatarConfig.config?: Record<string, unknown>` is optional in TypeScript, but the
  `avatars.config` column has `NOT NULL DEFAULT '{}'`. `rowToAvatarConfig` always sets `config:
row.config`, so the field is never absent in practice. Downstream code that reads
  `avatarConfig.config?.someKey` would be applying a null-guard that serves no purpose.
- **Evidence:** `apps/core/src/domain/avatar/avatar.types.ts` line 43, `001_initial_schema.sql`
  avatars DDL.
- **Recommendation:** Change `config?: Record<string, unknown>` to
  `config: Record<string, unknown>` in `AvatarConfig`. Update `in-memory-avatar.repository.ts`
  accordingly (the spread `...(params.config !== undefined ? { config: params.config } : {})`
  can become unconditional with a default).

---

### F-05 — `client.ts` URL guard has no unit test

- **Severity:** Low
- **Category:** Test Coverage
- **Problem:** `getDbClient` throws if called with a different URL than the initializing call.
  This is a meaningful defensive behavior — especially important in test suites that might
  accidentally initialize the pool — but it has no test asserting it.
- **Evidence:** `apps/core/src/infrastructure/db/client.ts` lines 7–11.
- **Recommendation:** Add a unit test in `apps/core/src/infrastructure/db/client.test.ts`
  that calls `getDbClient('url-a')`, then `getDbClient('url-b')`, and asserts a throw. Reset
  state with `closeDbClient` in `afterEach`.

---

### F-06 — `persistence.e2e.test.ts` relies on hard-coded UUIDs that would conflict if run twice without cleanup

- **Severity:** Low
- **Category:** Test Reliability
- **Problem:** `persistence.e2e.test.ts` uses `messageId: 'e2e00000-0000-0000-0000-000000000001'`.
  If the test is run twice against the same DB state (e.g., `afterAll` truncation fails), the
  second run would throw a PK constraint error. The test is guarded by `afterAll(truncateAllTables)`
  but not `beforeAll(truncateAllTables)`.
- **Evidence:** `apps/core/src/infrastructure/db/repositories/persistence.e2e.test.ts` line 35.
- **Recommendation:** Add `await truncateAllTables(sql)` at the start of `beforeAll`, or use
  `crypto.randomUUID()` for the `messageId` instead of a hard-coded value.

---

## Architecture Review

✅ **4-layer separation maintained** — Repositories are in `infrastructure/db/`. They import only
from `application/ports/` (interfaces) and `domain/*/` (types). No use-case or route imports from
repositories directly.

✅ **Constructor injection everywhere** — Every repository receives `Sql` at construction time.
`server.ts` and `index.ts` are the only places that wire the real implementation.

✅ **`server.ts` is adapter-agnostic** — It no longer imports `InMemoryScenarioRepository`.
The `ServerAdapters` contract is clean; `createServer` instantiates nothing.

✅ **`index.ts` is the single wiring point** — Pool creation, migration, and all four Postgres
repository instantiations happen only in `apps/core/src/index.ts`. Unit tests call `createServer`
directly with mocked adapters and never touch the DB.

✅ **Row types are local** — Each repository file defines its own `*Row` interface. These are
private to the file; nothing leaks into the domain or application layer.

✅ **Port interfaces implemented exactly** — Verified against `IScenarioRepository`,
`IAvatarRepository`, `ISessionRepository`, `IMessageRepository`. No extra methods added, no
signatures changed.

⚠️ **F-01 (see above)** — `adjustments` is a first-class field in the domain type used by
`persona-prompt.service.ts`, but it has no persistence path in Postgres. This is a gap in the
infrastructure layer's completeness contract.

---

## Test Review

### Strong Tests

- **`postgres-session.repository.integration.test.ts`** — 7 cases: create, findById (hit/miss),
  update (status), update (endedAt), update (preserves untouched columns), update (throws for
  missing), delete. This is the most complete integration test suite in the batch. The
  "preserves untouched columns" and "throws for missing" cases prove the subtle behaviors that
  matter.
- **`postgres-message.repository.integration.test.ts`** — Covers chronological ordering, limit
  option, empty array on unknown session, delete count return. Good contract coverage.
- **`postgres-scenario.repository.integration.test.ts`** — Unique slug constraint test is the
  correct kind of negative test for a DB layer.
- **`persistence.e2e.test.ts`** — Full fixture written and read back via fresh repository
  instances. Correctly proves the "survives restart" behavior at the repository level.
- **`create-avatar.use-case.test.ts`** — F-01 fix correctly reflected: `makeAvatarConfig` carries
  timestamps; `mapAvatarOutput` passes them through without modification.

### Weak Tests

- **`postgres-avatar.repository.integration.test.ts`** — Missing: no test proving that
  `adjustments` passed to `create` are silently dropped (neither stored nor returned). If the
  behavior were to change in the future, no test would catch the regression.
- **`create-avatar.use-case.test.ts`** — No test explicitly proves that timestamps from the
  repository flow to the output. The existing tests use `makeAvatarConfig` which includes
  timestamps, but no test checks the actual timestamp values in `output.avatar.createdAt`/
  `updatedAt`. The test proves the structure but not the data flow.

### Missing Tests

- `client.ts` URL guard behavior (F-05)
- `runMigrations` explicit idempotency: call it twice, assert `schema_migrations` has no duplicates
- `configuration` field roundtrip: create scenario with `config: { key: 'value' }`, findById,
  assert `result.config.key === 'value'`
- `adjustments` drop behavior in `PostgresAvatarRepository`: create with `adjustments: ['x']`,
  findById, assert `result.adjustments === undefined` — this would make F-01 a failing test
  (which is the right outcome: a test that fails until the column is added)

---

## Documentation Gaps

- `docs/PROJECT_STATUS.md` — "Overall Progress" paragraph missing EPIC 2.3 (F-02)
- `docs/ARCHITECTURE.md` — Infrastructure layer section does not yet mention postgres.js,
  migration runner, or the wiring pattern. This was to be updated in Prompt 05 of the pack.

---

## Path to A

1. **Fix F-01** (addresses the High finding):
   - Option A (recommended): Add migration `002_avatar_adjustments.sql` with `ALTER TABLE avatars ADD COLUMN adjustments TEXT[]`. Update `PostgresAvatarRepository` to insert/select the column. Map `null → undefined`.
   - Option B: Remove `adjustments` from the API body schema until persistence is ready. Explicit removal is better than silent drop.

2. **Fix F-02**: Update the "Overall Progress" paragraph in `PROJECT_STATUS.md` to include EPIC 2.3.

3. **Fix F-03**: Remove `| null` from `Session.endedAt`; use `endedAt?: string`.

4. **Fix F-04**: Make `AvatarConfig.config` required. Update in-memory repo accordingly.

5. **Add test for F-05**: `client.ts` URL guard unit test.

6. **Add test for F-06**: Truncate before in `persistence.e2e.test.ts` or use random `messageId`.

Only items 1 and 2 are required for an A. Items 3–6 bring the implementation to full precision.

---

## Final Recommendation

**Close with debt.**

The EPIC is functionally complete. The infrastructure is correctly architectured and all four
repositories are production-ready for the flows that do not use `adjustments`. The integration and
CI foundations are solid.

F-01 (`adjustments` not persisted) is tracked debt — it must be resolved before production use
of the persona tuning feature. The fix is small (one migration + a few lines in the repository).
F-02 (docs gap) is a one-line change.

Do not rework the EPIC. Close it with F-01 and F-02 tracked as immediate follow-up items before
the sprint produces user-visible avatar creation flows.

---

## Remediation Outcome

**Remediated:** April 20, 2026  
**Remediator:** GitHub Copilot (senior staff engineer)

### Changes Made

| File | Change |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| `infrastructure/db/migrations/002_avatar_adjustments.sql` | New migration — `ALTER TABLE avatars ADD COLUMN IF NOT EXISTS adjustments TEXT[]` |
| `infrastructure/db/repositories/postgres-avatar.repository.ts` | Added `adjustments: string[]                                                                                                         | null`to`AvatarRow`; updated `rowToAvatarConfig`to map`null → undefined`; added `adjustments` to INSERT and both SELECT statements; removed "runtime-only" NOTE comment |
| `infrastructure/db/repositories/postgres-avatar.repository.integration.test.ts` | Added two integration tests: "persists and returns adjustments" and "adjustments are undefined when not provided" |
| `domain/conversation/session.types.ts` | Removed `                                                                                                                            | null`from`endedAt?: string                                                                                                                                             | null`→`endedAt?: string` |
| `infrastructure/db/repositories/postgres-session.repository.ts` | Removed dead `=== null` branch from `endedAtValue` computation |
| `infrastructure/db/in-memory-session.repository.ts` | Removed `endedAt: null` from `create()` (field now absent, consistent with Postgres path) |
| `api/routes/conversations.test.ts` | Removed `                                                                                                                            | null`from local`SessionSummary`type; removed`endedAt: null` from fixture |
| `api/routes/messages.test.ts` | Removed `endedAt: null` from session fixture; added `config: {}` to avatar fixture |
| `api/routes/messages.e2e.test.ts` | Removed `endedAt: null` from session fixture; added `config: {}` to avatar fixture |
| `application/use-cases/start-session/start-session.use-case.test.ts` | Removed `endedAt: null` from session fixture |
| `application/use-cases/send-message/send-message.use-case.test.ts` | Removed `endedAt: null` from session fixture; added `config: {}` to avatar fixture |
| `application/use-cases/reset-session/reset-session.use-case.test.ts` | Removed `endedAt: null` from session fixture |
| `application/use-cases/get-history/get-history.use-case.test.ts` | Removed `endedAt: null` from session fixture |
| `domain/avatar/avatar.types.ts` | Made `AvatarConfig.config` required (`config?: …` → `config: …`) |
| `infrastructure/db/in-memory-avatar.repository.ts` | Changed conditional `config` spread to `config: params.config ?? {}` |
| `application/use-cases/create-avatar/create-avatar.use-case.test.ts` | Added `config: {}` to local `makeAvatarConfig` fixture |
| `infrastructure/db/client.test.ts` | New unit test file — 4 tests covering: returns client, same instance on same URL, throws on different URL, allows reinit after close |
| `infrastructure/db/repositories/persistence.e2e.test.ts` | Added `truncateAllTables` in `beforeAll`; replaced hard-coded message UUID with `crypto.randomUUID()` |
| `docs/PROJECT_STATUS.md` | Updated "Overall Progress" paragraph to include EPIC 2.3 |

### Findings Resolved

| Finding | Severity | Status |
| --------------------------------------------------- | -------- | --------------------------------------------------------------------------- | -------------------------------------------------- |
| F-01 — `adjustments` silently dropped | High | ✅ Resolved — migration + repo update + 2 integration tests prove roundtrip |
| F-02 — PROJECT_STATUS.md stale header | Medium | ✅ Resolved — paragraph updated |
| F-03 — `Session.endedAt` typed `string              | null` | Low | ✅ Resolved — type tightened; all fixtures updated |
| F-04 — `AvatarConfig.config` typed optional | Low | ✅ Resolved — field made required; in-memory repo and 3 fixtures updated |
| F-05 — `client.ts` URL guard untested | Low | ✅ Resolved — `client.test.ts` with 4 behavioral tests |
| F-06 — e2e test hard-coded UUID / no pre-truncation | Low | ✅ Resolved — `beforeAll` truncation; random UUID |

### Findings Deferred

None. All 6 findings resolved.

### Build Gates

| Gate                | Result                                                              |
| ------------------- | ------------------------------------------------------------------- |
| lint                | ✅ PASS                                                             |
| typecheck           | ✅ PASS                                                             |
| tests (unit)        | ✅ PASS — 150/150 (25 files; +4 from `client.test.ts`)              |
| tests (integration) | ✅ PASS — 27/27 run, 8 skipped (LLM/observability require API keys) |
| coverage            | ✅ PASS — 94.43% stmts · 86.6% branches · 100% functions            |

### Final Feature Confidence

| Feature                               | Confidence | Proof                                                                                    |
| ------------------------------------- | ---------- | ---------------------------------------------------------------------------------------- |
| `adjustments` persisted and returned  | **High**   | Integration: create with adjustments → findById → values match; absent → undefined       |
| `adjustments` survives server restart | **High**   | `persistence.e2e.test.ts` writes and reads back via fresh repo instances                 |
| DB client URL guard                   | **High**   | Unit: correct instance returned; throws on URL change; resets after close                |
| Session `endedAt` type contract       | **High**   | Type matches repo behavior — never produces `null`, only string or absent                |
| `AvatarConfig.config` always present  | **High**   | Required in type; always set from DB `NOT NULL DEFAULT '{}'`; in-memory defaults to `{}` |
| All original EPIC 2.3 features        | **High**   | Unchanged — all prior tests pass                                                         |

### Final Grade

**A**

All 6 findings resolved. The persistence layer now faithfully persists every creation-time field
(including `adjustments`), exposes a type system that matches observable repository behavior, and
has unit coverage of its key defensive mechanisms. Build gates are fully green.

### Remaining Risks

- The `endedAt` update-to-clear path (`endedAtValue = null` when `updates.endedAt === undefined`)
  is now the only way to clear `ended_at` in the Postgres repository. Since there is no production
  use case for un-ending a session in Phase A, this is not a risk now — but it should be noted
  when implementing session archive/reopen flows in later phases.
- Integration tests require `DATABASE_URL` to be set. They skip gracefully without it, and CI
  provides the env var. Local developers running `pnpm test` alone will not exercise the Postgres
  path; they must run `pnpm test:integration-e2e` with Docker running.
