# EPIC 2.5 — Admin CRUD Completion + Console Integration

## Objective

Make the platform operationally manageable through complete admin CRUD flows directly usable from the console. After this EPIC, an operator can fully manage scenarios, avatars, and sessions without writing code or touching the database.

**Generated:** April 28, 2026  
**Status:** Not started  
**Depends on:** EPIC 2.2 ✅, EPIC 2.3 ✅, EPIC 2.4 ✅

---

## Prompt Execution Order

| #   | File                                                               | What it delivers                                                                          |
| --- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| 01  | [01-update-scenario-endpoint.md](./01-update-scenario-endpoint.md) | `PATCH /v1/scenarios/{scenarioId}` — use case, repository extension, route, stack-e2e     |
| 02  | [02-update-avatar-endpoint.md](./02-update-avatar-endpoint.md)     | `PATCH /v1/avatars/{avatarId}` — use case, repository extension, route, stack-e2e         |
| 03  | [03-list-reset-sessions.md](./03-list-reset-sessions.md)           | `GET /v1/sessions` + `POST /v1/sessions/{sessionId}/reset` — use cases, routes, stack-e2e |
| 04  | [04-console-admin-ui.md](./04-console-admin-ui.md)                 | Console UI: scenario edit/delete, avatar edit/delete, session list/filter/reset           |
| 05  | [05-hardening-doc-sync.md](./05-hardening-doc-sync.md)             | Full hardening pass, conflict safety review, complete doc sync                            |

---

## Prompt Dependencies

```
01 (update scenario) → independent
02 (update avatar)   → independent
03 (list + reset sessions) → depends on 01 and 02 only for API_CONTRACT consistency
04 (console UI)      → depends on 01, 02, 03 (needs all new endpoints live)
05 (hardening)       → depends on 01, 02, 03, 04 (final pass)
```

Run 01 and 02 in parallel. Run 03 after or alongside. Run 04 after 01–03 complete. Run 05 last.

---

## Definition of Done (Full EPIC)

- [ ] `PATCH /v1/scenarios/{scenarioId}` implemented, tested, documented
- [ ] `PATCH /v1/avatars/{avatarId}` implemented, tested, documented
- [ ] `GET /v1/sessions` implemented, tested, documented
- [ ] `POST /v1/sessions/{sessionId}/reset` implemented, tested, documented
- [ ] All new endpoints have stack-e2e tests (auth, validation, not-found at minimum)
- [ ] `IScenarioRepository` extended with `update()`
- [ ] `IAvatarRepository` extended with `update()`
- [ ] `ISessionRepository` extended with `list()`
- [ ] In-memory and Postgres implementations of new repository methods
- [ ] Console: scenario list shows edit + delete actions
- [ ] Console: avatar list shows edit + delete actions
- [ ] Console: session list page with filter and reset capability
- [ ] Dependency-safe delete conflict responses return `409 CONFLICT` with clear message
- [ ] `docs/API_CONTRACT.md` updated with all new endpoints
- [ ] `docs/PROJECT_STATUS.md` updated to mark EPIC 2.5 complete
- [ ] `pnpm lint && pnpm typecheck && pnpm test` pass cleanly

---

## Key Files

### Backend

| Path                                                                           | Role                               |
| ------------------------------------------------------------------------------ | ---------------------------------- |
| `apps/core/src/application/ports/IScenarioRepository.ts`                       | Add `update()`                     |
| `apps/core/src/application/ports/IAvatarRepository.ts`                         | Add `update()`                     |
| `apps/core/src/application/ports/ISessionRepository.ts`                        | Add `list()`                       |
| `apps/core/src/application/use-cases/update-scenario/`                         | New use case                       |
| `apps/core/src/application/use-cases/update-avatar/`                           | New use case                       |
| `apps/core/src/application/use-cases/list-sessions/`                           | New use case                       |
| `apps/core/src/application/use-cases/reset-session/`                           | New use case                       |
| `apps/core/src/api/routes/scenarios.ts`                                        | Add PATCH handler                  |
| `apps/core/src/api/routes/avatars.ts`                                          | Add PATCH handler                  |
| `apps/core/src/api/routes/sessions.ts`                                         | Add GET list + POST reset handlers |
| `apps/core/src/infrastructure/db/in-memory-scenario.repository.ts`             | Add `update()`                     |
| `apps/core/src/infrastructure/db/in-memory-avatar.repository.ts`               | Add `update()`                     |
| `apps/core/src/infrastructure/db/in-memory-session.repository.ts`              | Add `list()`                       |
| `apps/core/src/infrastructure/db/repositories/postgres-scenario.repository.ts` | Add `update()`                     |
| `apps/core/src/infrastructure/db/repositories/postgres-avatar.repository.ts`   | Add `update()`                     |
| `apps/core/src/infrastructure/db/repositories/postgres-session.repository.ts`  | Add `list()`                       |

### Console

| Path                                      | Role                                       |
| ----------------------------------------- | ------------------------------------------ |
| `apps/console/src/api/scenarios.ts`       | Add `updateScenario()`, `deleteScenario()` |
| `apps/console/src/api/sessions.ts`        | Add `listSessions()`, `resetSession()`     |
| `apps/console/src/pages/ScenarioPage.tsx` | Add edit + delete flow                     |
| `apps/console/src/pages/AvatarPage.tsx`   | Add edit + delete flow                     |
| `apps/console/src/pages/SessionPage.tsx`  | Add list + reset flow                      |

---

## Background Context

The following endpoints already exist from earlier EPICs:

- `GET /v1/scenarios` ✅ — `ListScenariosUseCase`
- `POST /v1/scenarios` ✅ — `CreateScenarioUseCase`
- `GET /v1/scenarios/{scenarioId}` ✅ — via scenarios route
- `DELETE /v1/scenarios/{scenarioId}` ✅ — `DeleteScenarioUseCase`
- `POST /v1/scenarios/{scenarioId}/avatars` ✅ — `CreateAvatarUseCase`
- `GET /v1/scenarios/{scenarioId}/avatars` ✅ — `ListScenarioAvatarsUseCase`
- `DELETE /v1/avatars/{avatarId}` ✅ — `DeleteAvatarUseCase`
- `POST /v1/sessions` ✅ — `StartSessionUseCase`
- `GET /v1/sessions/{sessionId}` ✅ — `GetSessionUseCase`

Missing from this EPIC: `PATCH /v1/scenarios/{id}`, `PATCH /v1/avatars/{id}`, `GET /v1/sessions`, `POST /v1/sessions/{id}/reset`.
