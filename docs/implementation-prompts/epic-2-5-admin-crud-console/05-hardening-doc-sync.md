# 05 — Hardening + Doc Sync

## Context

Prompts 01–04 deliver all the features of EPIC 2.5. This prompt is the final hardening and documentation pass. Its purpose is to catch gaps, close loose ends, and ensure the repository is fully coherent before marking the EPIC done.

Do not skip this prompt. Silent documentation drift between code and docs is treated as incomplete work in this project.

## Scope

**In scope:**

- Full review of `docs/API_CONTRACT.md` against implemented endpoints
- Full review of `docs/PROJECT_STATUS.md`
- Full review of `docs/DATA_MODEL.md` for any impacted tables
- Stack-e2e test completeness check — every new endpoint must have at minimum auth + not-found coverage
- Conflict response validation — verify delete and reset operations return `409 CONFLICT` with clear `details` payloads
- Repository interface review — confirm `IScenarioRepository`, `IAvatarRepository`, `ISessionRepository` are in sync between port, in-memory, and Postgres implementations
- Final `pnpm lint && pnpm typecheck && pnpm test` clean run

**Out of scope:**

- New features
- Postgres integration tests (those were written per-prompt in 01–03)
- Performance optimization

## Relevant Docs

- `docs/API_CONTRACT.md`
- `docs/PROJECT_STATUS.md`
- `docs/DATA_MODEL.md`
- `docs/EPICS.md` — EPIC 2.5 DoD checklist
- `apps/core/src/api/routes/scenarios.stack-e2e.test.ts`
- `apps/core/src/api/routes/avatars.stack-e2e.test.ts`
- `apps/core/src/api/routes/sessions.stack-e2e.test.ts`
- All new use case test files from prompts 01–03

## Implementation Guidance

### 1. API Contract Review

Open `docs/API_CONTRACT.md` and verify the following sections exist and are accurate:

| Endpoint                              | Contract section present? | Request shape correct? | Response shape correct? | Error mapping complete? |
| ------------------------------------- | ------------------------- | ---------------------- | ----------------------- | ----------------------- |
| `PATCH /v1/scenarios/{scenarioId}`    | □                         | □                      | □                       | □                       |
| `PATCH /v1/avatars/{avatarId}`        | □                         | □                      | □                       | □                       |
| `GET /v1/sessions`                    | □                         | □                      | □                       | □                       |
| `POST /v1/sessions/{sessionId}/reset` | □                         | □                      | □                       | □                       |

For each new endpoint, ensure:

- The HTTP method is correct (PATCH, not PUT)
- All optional fields are marked optional
- `updatedAt` is present in PATCH response shapes
- `400 VALIDATION_ERROR` is listed for empty-body PATCH
- `409 CONFLICT` is documented where applicable (scenario delete, avatar delete)
- Reset semantics are documented (what gets cleared, what stays)

Also verify the `PATCH` for scenarios replaces the old `PUT` section if it was there.

### 2. Data Model Review

Open `docs/DATA_MODEL.md` and verify:

- The `sessions` table documents `gm_notes`, `active_avatar_id`, `unlocked_avatar_ids` as nullable/clearable fields (relevant for reset)
- The `scenarios` table `updated_at` column is documented with auto-update behavior
- The `avatars` table `updated_at` column is documented with auto-update behavior

If any of the above are undocumented or imprecise, update the doc.

### 3. Stack-E2E Test Completeness

For each new endpoint, verify the stack-e2e file covers at minimum:

**Auth enforcement (all four new endpoints):**

- `no API key → 401`
- `wrong API key → 401`

**Schema validation:**

- `PATCH /v1/scenarios/:id` with `{}` → `400`
- `PATCH /v1/avatars/:id` with `{}` → `400`

**Not-found:**

- `PATCH /v1/scenarios/nonexistent → 404`
- `PATCH /v1/avatars/nonexistent → 404`
- `POST /v1/sessions/nonexistent/reset → 404`

**Happy path:**

- Each PATCH endpoint has at least one success-path test
- `GET /v1/sessions` returns `200` (even empty)
- `POST /v1/sessions/:id/reset` returns `200` with session record after seeding

If any of the above are missing, add them now.

### 4. Conflict Response Detail

Verify that `409 CONFLICT` responses include useful `details` in the error envelope. For example:

```json
{
  "data": null,
  "error": {
    "code": "CONFLICT",
    "message": "Cannot delete scenario: 2 avatar(s) and 1 session(s) exist.",
    "details": {
      "avatarCount": 2,
      "sessionCount": 1
    }
  }
}
```

If the existing `DeleteScenarioUseCase` and `DeleteAvatarUseCase` throw a plain `DomainError` without details, enrich the error message to include counts. The route handler can pass `details` to `fail()` if the `@gami/shared` `fail()` helper supports it — check the signature. If not, inline the detail in the `message` string.

### 5. Repository Interface Sync

Verify all three pairs are in sync:

| Interface             | In-memory                    | Postgres                     |
| --------------------- | ---------------------------- | ---------------------------- |
| `IScenarioRepository` | `InMemoryScenarioRepository` | `PostgresScenarioRepository` |
| `IAvatarRepository`   | `InMemoryAvatarRepository`   | `PostgresAvatarRepository`   |
| `ISessionRepository`  | `InMemorySessionRepository`  | `PostgresSessionRepository`  |

Each method in the interface must exist in both implementations. TypeScript will catch this at compile time — run `pnpm typecheck` as the verification step.

### 6. Console API Index Exports

Verify `apps/console/src/api/index.ts` exports all new functions:

- `updateScenario`, `deleteScenario`, `updateAvatar`, `deleteAvatar`
- `listSessions`, `resetSession`

### 7. Final Quality Gate

Run the full suite and confirm clean exit:

```bash
pnpm lint && pnpm typecheck && pnpm test
```

All 3 must pass with exit code 0.

### 8. PROJECT_STATUS.md Update

Update `docs/PROJECT_STATUS.md` to:

1. Mark EPIC 2.5 complete in the overall progress section
2. Add a dated entry describing what was implemented:
   - `PATCH /v1/scenarios/{scenarioId}` — partial update
   - `PATCH /v1/avatars/{avatarId}` — partial update
   - `GET /v1/sessions` — list with optional filter
   - `POST /v1/sessions/{sessionId}/reset` — hard reset of session state
   - Console: inline edit/delete for scenarios and avatars
   - Console: session admin panel with list, filter, and reset

## Constraints

- Do not introduce new code in this prompt — fix gaps and update docs only
- If tests reveal a bug, fix it here and document it
- If TypeScript catches interface drift, fix all three layers (port + in-memory + Postgres) together

## Deliverables

1. `docs/API_CONTRACT.md` — all 4 new endpoints documented with correct shapes
2. `docs/PROJECT_STATUS.md` — EPIC 2.5 marked complete, dated entry added
3. `docs/DATA_MODEL.md` — verified/updated for `sessions`, `scenarios`, `avatars`
4. Stack-e2e tests — all gaps filled
5. `pnpm lint && pnpm typecheck && pnpm test` — clean exit confirmed

## Mandatory Final Step — Documentation Update

This prompt IS the documentation update. After running all checks, explicitly confirm in `PROJECT_STATUS.md`:

> EPIC 2.5 — Admin CRUD Completion + Console Integration: **complete**

## Acceptance Criteria

- [ ] `docs/API_CONTRACT.md` covers all 4 new endpoints with correct method, shape, and error mapping
- [ ] `docs/PROJECT_STATUS.md` marks EPIC 2.5 complete with a dated implementation note
- [ ] `docs/DATA_MODEL.md` accurately reflects nullable/clearable session fields
- [ ] All new endpoints have stack-e2e auth + not-found coverage
- [ ] All new PATCH endpoints have stack-e2e happy-path coverage
- [ ] `409 CONFLICT` error messages are descriptive (include counts or context)
- [ ] `IScenarioRepository`, `IAvatarRepository`, `ISessionRepository` are fully implemented by both in-memory and Postgres adapters
- [ ] `apps/console/src/api/index.ts` exports all new API functions
- [ ] `pnpm lint && pnpm typecheck && pnpm test` pass cleanly with exit code 0
