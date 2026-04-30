# EPIC 5.5 — User Persona System

## Objective

Allow users to define their role in the experience (friend, coach, psychologist, etc.) through a
lightweight persona model persisted in a `users` table. The persona is injected into avatar
prompt assembly and Game Master reasoning so that responses adapt to who the user is, not just
what they say.

## Generated

2026-04-30

## Dependencies

This EPIC has no blocking predecessors in the current implementation order. It is designed to
be implemented before EPIC 4.2 (Memory Layer), EPIC 5.2 (Context Engine v2), and EPIC 2.1b
(Avatar Agent v2), which all benefit from persona being available as a first-class context input.

---

## Execution Order

| Step | File                                    | Description                                                                                                    |
| ---- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 1    | `01-user-domain-and-persistence.md`     | User domain type, `IUserRepository` port, in-memory stub, DB schema migration, `PostgresUserRepository`        |
| 2    | `02-persona-api-endpoints.md`           | `PUT /v1/users/{userId}/persona` (upsert), `GET /v1/users/{userId}/persona` (read), use cases, stack-e2e tests |
| 3    | `03-persona-avatar-prompt-injection.md` | Thread persona through `SendMessageUseCase` into `assemblePersonaPrompt`                                       |
| 4    | `04-gm-persona-context.md`              | Thread persona into `RunGameMasterInput` and `GameMasterInput` for GM reasoning                                |
| 5    | `05-tests-and-doc-sync.md`              | Integration tests for `PostgresUserRepository`, hardening edge cases, full doc sync                            |

Each prompt depends on the previous one being complete.

---

## Definition of Done

- [ ] `users` table exists in `infra/postgres/init.sql` with `persona JSONB` column
- [ ] `IUserRepository` port defined; `InMemoryUserRepository` and `PostgresUserRepository` implemented
- [ ] `UpsertUserPersonaUseCase` and `GetUserPersonaUseCase` implemented and tested
- [ ] `PUT /v1/users/:userId/persona` — creates or replaces persona, returns updated user; auth enforced
- [ ] `GET /v1/users/:userId/persona` — returns persona (or empty object if none set); auth enforced
- [ ] Stack-E2E file exists covering auth enforcement and not-found cases
- [ ] `assemblePersonaPrompt` accepts optional `userPersona` and emits a persona context sentence when `role` is set
- [ ] `SendMessageUseCase` loads the user by `session.userId` and injects persona into prompt assembly; gracefully degrades if user not found
- [ ] `GameMasterInput.context` includes `userPersona?: UserPersona`; `SendMessageUseCase` threads it through to `RunGameMasterUseCase`
- [ ] Unit tests cover: prompt assembly with/without persona, GM input with/without persona, graceful fallback (no user record)
- [ ] Integration tests validate `PostgresUserRepository` against a real DB
- [ ] `docs/API_CONTRACT.md` updated with the two new endpoints
- [ ] `docs/DATA_MODEL.md` updated with User entity implementation status
- [ ] `docs/ARCHITECTURE.md` updated to reference `domain/user/` module
- [ ] `docs/PROJECT_STATUS.md` updated
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` all pass
