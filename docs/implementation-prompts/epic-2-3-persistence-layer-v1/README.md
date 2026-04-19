# EPIC 2.3 — Persistence Layer v1: Implementation Prompt Pack

## EPIC Definition

**Goal:** Replace in-memory stubs with production-grade PostgreSQL repositories for all four core
domain aggregates: Scenario, Avatar, Session, and Message.

**Sprint:** 2 — Core Conversation Engine  
**Epic ID:** EPIC 2.3  
**Depends on:** EPIC 2.1 (Avatar Agent v1), EPIC 2.2 (Scenario & Session Lifecycle v1)

---

## Why This EPIC Exists

The engine currently uses `InMemoryAvatarRepository`, `InMemorySessionRepository`, and
`InMemoryMessageRepository` throughout the application layer. These stubs are intentionally
disposable — they let unit tests run without infrastructure — but they cannot survive process
restarts, and there is no `InMemoryScenarioRepository` at all.

EPIC 2.3 completes the persistence foundation. After it lands:

- Every core domain object survives restarts.
- The application layer talks to real PostgreSQL in CI and production, and continues talking to
  in-memory stubs in unit tests without any change to those tests.
- The F-01 finding from the EPIC 2.2 audit (`AvatarConfig` lacking timestamps) is resolved — the
  Postgres repository is the correct place to source DB-generated timestamps.

---

## Execution Order

The five prompts in this pack must be applied sequentially. Each prompt leaves the codebase in a
fully passing state before handing off to the next.

| Prompt | File                                              | Scope                                                                |
| ------ | ------------------------------------------------- | -------------------------------------------------------------------- |
| 01     | `01-db-client-and-migrations.md`                  | Choose + install pg client; write migration runner; write schema DDL |
| 02     | `02-postgres-scenario-and-avatar-repositories.md` | `PostgresScenarioRepository`, `PostgresAvatarRepository`, F-01 fix   |
| 03     | `03-postgres-session-and-message-repositories.md` | `PostgresSessionRepository`, `PostgresMessageRepository`             |
| 04     | `04-server-wiring.md`                             | Wire Postgres repos into `ServerAdapters`; update `db/index.ts`      |
| 05     | `05-hardening-and-doc-sync.md`                    | Migration in CI; stack-e2e verification; doc sync                    |

---

## Dependencies Between Prompts

```
Prompt 01
  └─ Prompt 02  (needs DB pool and migrations from 01)
       └─ Prompt 03  (needs schema from 01; parallels 02 structurally)
            └─ Prompt 04  (needs all four repos from 02 and 03)
                 └─ Prompt 05  (verifies the fully wired stack end-to-end)
```

---

## Definition of Done (EPIC 2.3)

- [ ] `postgres` (postgres.js) client installed and pooled; `DATABASE_URL` wires into pool
- [ ] SQL migration files exist in `apps/core/src/infrastructure/db/migrations/`; a lightweight runner
      applies them at server startup (production) and in integration tests (via helper)
- [ ] All four tables exist in PostgreSQL: `scenarios`, `avatars`, `sessions`, `messages`
- [ ] `PostgresScenarioRepository` implements `IScenarioRepository` (create, findById)
- [ ] `PostgresAvatarRepository` implements `IAvatarRepository` (create, findById); returns
      DB-generated `createdAt` / `updatedAt`
- [ ] `AvatarConfig` type updated: `createdAt: string`, `updatedAt: string` added
- [ ] `CreateAvatarUseCase` no longer synthesises timestamps — reads them from the returned entity
- [ ] `PostgresSessionRepository` implements `ISessionRepository` (create, findById, update, delete)
- [ ] `PostgresMessageRepository` implements `IMessageRepository` (save, findBySessionId,
      deleteBySessionId)
- [ ] Integration tests exist for all four repositories (`*.integration.test.ts`); each uses
      `describe.skipIf(!dbAvailable)` and cleans up rows after each test
- [ ] `ServerAdapters` wires Postgres in production (`NODE_ENV !== 'test'`); in-memory in test
- [ ] `infrastructure/db/index.ts` exports all four Postgres repositories; stale "EPIC 3.2"
      placeholder comment removed
- [ ] All 146 existing unit tests continue to pass without change
- [ ] `docs/PROJECT_STATUS.md` marks EPIC 2.3 as Complete
- [ ] `docs/DATA_MODEL.md`, `docs/ARCHITECTURE.md` updated to reflect implemented persistence
- [ ] No `any`, no implicit types — TypeScript strict mode throughout
- [ ] Each new source file ≤ 300 lines; each function ≤ 50 lines

---

## Key Technical Decisions

These are **already decided for this EPIC** — do not revisit them in the prompts:

| Decision                  | Choice                                                                            |
| ------------------------- | --------------------------------------------------------------------------------- |
| PostgreSQL client         | `postgres` (postgres.js) — ESM-native, TypeScript-friendly, no callback legacy    |
| Migration strategy        | Plain SQL files in `apps/core/src/infrastructure/db/migrations/`; custom runner   |
| Migration runner          | A minimal `runMigrations(sql)` function that applies unapplied files in order     |
| Connection pool max       | 10 (dev/prod default), via `postgres({ max: 10 })` — no new env var needed        |
| Timestamps source         | DB-generated (`NOW()` defaults) — application layer never synthesises them        |
| `AvatarConfig` timestamps | Add `createdAt: string`, `updatedAt: string` — resolves F-01 from EPIC 2.2 audit  |
| Unit test isolation       | In-memory stubs unchanged — repos only wired via `ServerAdapters`, not hard-coded |

---

## Files Touched Across This EPIC

```
apps/core/
  package.json                                             ← add postgres dep
  src/
    domain/
      avatar/avatar.types.ts                               ← add createdAt/updatedAt to AvatarConfig
    application/
      use-cases/avatar/create-avatar.use-case.ts           ← remove timestamp synthesis
    infrastructure/
      db/
        index.ts                                           ← export Postgres repos; remove stale comment
        client.ts                                (new)     ← postgres.js pool singleton
        migrations/
          runner.ts                              (new)     ← apply unapplied SQL files in order
          001_initial_schema.sql                 (new)     ← DDL for all 4 tables
        repositories/
          postgres-scenario.repository.ts        (new)
          postgres-avatar.repository.ts          (new)
          postgres-session.repository.ts         (new)
          postgres-message.repository.ts         (new)
          postgres-scenario.repository.integration.test.ts  (new)
          postgres-avatar.repository.integration.test.ts    (new)
          postgres-session.repository.integration.test.ts   (new)
          postgres-message.repository.integration.test.ts   (new)
  api/server.ts                                            ← wire Postgres in ServerAdapters

docs/
  DATA_MODEL.md                                            ← update implementation status
  ARCHITECTURE.md                                          ← update infrastructure layer notes
  PROJECT_STATUS.md                                        ← EPIC 2.3 → Complete
```
