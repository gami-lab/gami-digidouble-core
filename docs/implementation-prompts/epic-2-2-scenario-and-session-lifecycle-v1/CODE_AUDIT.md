# CODE_AUDIT.md — EPIC 2.2 — Scenario & Session Lifecycle v1

**Audited:** 2026-04-19  
**Auditor:** GitHub Copilot  
**EPIC:** 2.2 — Scenario & Session Lifecycle v1  
**Commit range:** post-`be3d187` (prompt pack) through current HEAD

---

## Quality Gate Results

| Gate                  | Result    | Notes                                      |
| --------------------- | --------- | ------------------------------------------ |
| `pnpm lint`           | ✅ PASS   | 0 errors, 0 warnings                       |
| `pnpm typecheck`      | ✅ PASS   | 0 TypeScript errors (strict mode)          |
| `pnpm test`           | ✅ PASS   | 141/141 tests passing across 24 test files |
| Coverage (statements) | ✅ 94.05% | Gate: ≥80%                                 |
| Coverage (branches)   | ✅ 81.38% | Gate: ≥80%                                 |
| Coverage (functions)  | ✅ 100%   | All exported functions called              |

---

## Definition of Done — Verification

| DoD Item                                                                           | Status |
| ---------------------------------------------------------------------------------- | ------ |
| `POST /v1/scenarios` creates a scenario and returns it                             | ✅     |
| `POST /v1/scenarios/:scenarioId/avatars` creates an avatar scoped to a scenario    | ✅     |
| `POST /v1/conversations/start` creates a session with a valid scenarioId           | ✅     |
| `GET /v1/conversations/:sessionId/history` returns session + ordered messages      | ✅     |
| `DELETE /v1/conversations/:sessionId` resets messages and returns count            | ✅     |
| `messages.stack-e2e.test.ts` happy-path covers the full lifecycle                  | ✅     |
| `scenarios.stack-e2e.test.ts` — auth, validation, 200 create                       | ✅     |
| `avatars.stack-e2e.test.ts` — auth, validation, 404 (unknown scenario), 200 create | ✅     |
| `conversations.stack-e2e.test.ts` — start → history → reset lifecycle              | ✅     |
| `IAvatarRepository` updated with `create` method                                   | ✅     |
| `IMessageRepository` updated with `deleteBySessionId` method                       | ✅     |
| `IScenarioRepository` port created                                                 | ✅     |
| `InMemoryScenarioRepository` created                                               | ✅     |
| `scenarioRepository` added to `ServerAdapters` in `server.ts`                      | ✅     |
| Coverage gate (≥80%) still passes                                                  | ✅     |
| `pnpm lint`, `pnpm typecheck`, `pnpm test` all pass                                | ✅     |
| `docs/API_CONTRACT.md` synced                                                      | ✅     |
| `docs/PROJECT_STATUS.md` synced                                                    | ✅     |

---

## File-by-File Review

### `application/ports/IScenarioRepository.ts` — ✅ Clean

- Port interface is minimal and correct: `create(params)` + `findById(scenarioId)`.
- `CreateScenarioParams` carries `status?` and `config?` as optional — appropriate.
- No issues.

### `application/ports/IAvatarRepository.ts` — ✅ Clean

- `create(params: CreateAvatarParams): Promise<AvatarConfig>` added correctly alongside the pre-existing `findById`.
- `CreateAvatarParams` is comprehensive (all optional fields represented).
- No issues.

### `application/ports/IMessageRepository.ts` — ✅ Clean

- `deleteBySessionId(sessionId: string): Promise<number>` added correctly.
- Return type `number` (deleted count) is correct and consistent with `ResetSessionOutput`.
- No issues.

### `application/use-cases/create-scenario/create-scenario.use-case.ts` — ✅ Clean

- Validation is thorough: trims name/slug, checks non-empty, validates slug pattern `/^[a-z0-9-]+$/`, validates status enum.
- `SCENARIO_SLUG_PATTERN` and `ALLOWED_SCENARIO_STATUSES` exported as named constants — readable.
- Error codes: `VALIDATION_ERROR` for bad input — correct.
- No issues.

### `application/use-cases/create-avatar/create-avatar.use-case.ts` — ⚠️ F-01

- `normalizeAndValidateInput()` helper cleanly separates validation — good structure.
- Scenario existence check (`scenarioRepository.findById`) before `avatarRepository.create` — correct guard.
- **F-01**: `const now = new Date().toISOString()` is generated **before** `avatarRepository.create()` is called, then injected via `mapAvatarOutput(avatar, now)`. `AvatarConfig` does not carry `createdAt`/`updatedAt` fields, so the repository cannot return them. The response timestamps are synthesized in the application layer, not derived from the persistence record. See Findings section.

### `application/use-cases/start-session/start-session.use-case.ts` — ⚠️ F-02

- Simple and correct: validates non-empty `userId` and `scenarioId`, calls `sessionRepository.create`, maps to `SessionSummary`.
- **F-02**: `// TODO(EPIC-X): expand to full StartSessionRequest shape (nested user, initialContext)` — the `X` is a placeholder that was never replaced with a concrete EPIC number. Low impact but should be fixed.

### `application/use-cases/get-history/get-history.use-case.ts` — ✅ Clean

- Correctly fetches session, returns NOT_FOUND if missing, then fetches messages.
- `TODO(EPIC-4.2)` for memory summary — properly tagged with a real EPIC number.
- No issues.

### `application/use-cases/reset-session/reset-session.use-case.ts` — ✅ Clean

- Correctly fetches session (404 guard), calls `messageRepository.deleteBySessionId`, returns structured output.
- `TODO(EPIC-4.2)` and `TODO(EPIC-3.3)` for session memory and events — properly tagged.
- No issues.

### `infrastructure/db/in-memory-scenario.repository.ts` — ✅ Clean

- `create()` generates `scenarioId` via `crypto.randomUUID()`, sets `createdAt`/`updatedAt` from `new Date().toISOString()` — consistent with the `Scenario` type.
- `findById()` uses `Map.get()` with nullish coalescing — correct.
- No issues.

### `infrastructure/db/in-memory-avatar.repository.ts` — ℹ️ Note (linked to F-01)

- `create()` does **not** set `createdAt`/`updatedAt` because `AvatarConfig` does not have these fields.
- Optional fields (`tone`, `description`, `adjustments`, `config`) use conditional spread correctly.
- This is a downstream consequence of F-01, not a standalone issue with the repository.

### `api/routes/scenarios.ts` — ⚠️ F-03

- Route handlers are clean; schema-level validation covers required fields and slug format.
- Error mapping (`VALIDATION_ERROR` → 400, `NOT_FOUND` → 404, other → 500) is consistent.
- **F-03**: Uses `preHandler: [authenticateApiKey(config)]` as a per-route option on each `app.post` call. `conversations.ts` uses the plugin-level `app.addHook('preHandler', ...)` approach instead. Both are correct, but the inconsistency increases cognitive overhead for future maintainers.

### `api/routes/conversations.ts` — ✅ Clean

- Plugin-level `app.addHook('preHandler', authenticateApiKey(config))` — all three routes are protected automatically.
- Separate JSON schemas for body (`startSessionBodySchema`) and params (`sessionParamsSchema`) — good separation.
- `getDomainErrorStatus` maps `NOT_FOUND → 404`, `VALIDATION_ERROR → 400`, other → 500 — correct and consistent.
- No issues.

### `api/server.ts` — ⚠️ F-04

- `scenariosRoute` registration correctly passes `scenarioRepository` and `avatarRepository`.
- `conversationsRoute`, `messagesRoute`, and other routes are correctly registered.
- **F-04**: Uses `...(adapters.avatarRepository !== undefined ? { avatarRepository: adapters.avatarRepository } : {})` for the avatar repository spread. Since `scenariosRoute` already defaults `avatarRepository` to `new InMemoryAvatarRepository()` when absent, passing `undefined` explicitly would work equally well. The defensive spread is safe but adds unnecessary complexity.

### Test files — ✅ Overall Good

#### `api/routes/scenarios.test.ts`

- Covers auth (missing key, wrong key), validation (missing name, missing slug, bad slug format, bad status), and success (201 with expected shape).
- Avatar creation test uses the same `app` instance to create a scenario first — correctly tests cross-route state sharing via shared in-memory repositories.
- 11 tests, all passing.

#### `api/routes/conversations.test.ts`

- Covers auth (401), validation (blank userId, blank scenarioId), and happy paths for all three routes.
- Uses `makeApp({ sessions })` factory for clean test isolation.
- Correctly tests the closed-session edge cases (history and reset work on closed sessions).
- 13 tests, all passing.

#### `api/routes/scenarios.stack-e2e.test.ts`

- Covers auth (no key, wrong key), validation (missing name, missing slug, bad slug format), and 201 happy path with unique slug per run.
- Appropriate for stack-e2e scope.

#### `api/routes/avatars.stack-e2e.test.ts`

- Covers auth, validation (missing name, missing personaPrompt, invalid slug), 404 on unknown scenario, and 201 happy path (creates scenario first, then avatar).
- Correctly chains scenario creation to avatar creation.

#### `api/routes/conversations.stack-e2e.test.ts`

- Covers auth, validation, 404 for unknown session, and the full lifecycle: start → history-before-reset → reset → history-after-reset.
- Clean and readable happy-path test.

---

## Findings Summary

### F-01 — `AvatarConfig` type missing timestamps forces use-case timestamp synthesis

**Severity:** Medium  
**File:** `application/use-cases/create-avatar/create-avatar.use-case.ts` (line 24), `domain/avatar/avatar.types.ts`, `infrastructure/db/in-memory-avatar.repository.ts`

**Description:**  
`AvatarConfig` lacks `createdAt`/`updatedAt` fields (unlike the `Scenario` entity which does carry them). Because the repository cannot return timestamps it doesn't store, `CreateAvatarUseCase` synthesizes them: `const now = new Date().toISOString()` is captured before `avatarRepository.create()` is called, then injected into the response via `mapAvatarOutput(avatar, now)`.

This creates a semantic inconsistency:

- The timestamps in the API response are not from the persistence record.
- The `InMemoryAvatarRepository` stores no timestamps — so if a future path fetches the avatar back and tries to return its timestamps, it will not have them.
- This contrasts with `InMemoryScenarioRepository`, which correctly sets `createdAt`/`updatedAt` on the stored record.

**Recommendation (defer to real Postgres adapter):**  
When implementing `PostgresAvatarRepository`, add `createdAt` and `updatedAt` to `AvatarConfig` (or rename it to `AvatarRecord` and keep `AvatarConfig` as the runtime-only subset). Have the repository return the DB-generated timestamps. Update `CreateAvatarUseCase` to read timestamps from the returned `avatar` object and remove the `timestamp` parameter from `mapAvatarOutput`.

**Not a blocker for Phase A** — wall-clock timestamps are accurate for the in-memory case.

---

### F-02 — Stale `TODO(EPIC-X)` placeholder in `StartSessionUseCase`

**Severity:** Low  
**File:** `application/use-cases/start-session/start-session.use-case.ts` (line ~30)

**Description:**  
`// TODO(EPIC-X): expand to full StartSessionRequest shape (nested user, initialContext)` — the placeholder `X` was never replaced with a concrete EPIC reference.

**Recommendation:**  
Replace `EPIC-X` with the actual EPIC that will expand `StartSessionRequest` (e.g. `EPIC-3.x` or `EPIC-4.x`). If no EPIC is decided yet, note it as `TODO(deferred)` rather than `TODO(EPIC-X)`.

---

### F-03 — Auth hook pattern inconsistency between `scenariosRoute` and `conversationsRoute`

**Severity:** Low  
**Files:** `api/routes/scenarios.ts`, `api/routes/conversations.ts`

**Description:**  
Two different patterns are used to apply `authenticateApiKey` middleware:

- `scenarios.ts`: `app.post('/', { preHandler: [authenticateApiKey(config)] }, handler)`
- `conversations.ts`: `app.addHook('preHandler', authenticateApiKey(config))`

Both patterns are functionally correct and secure. The inconsistency makes the codebase harder to reason about for new contributors and increases the risk of forgetting auth on new routes added to `scenarios.ts`.

**Recommendation:**  
Standardize to `app.addHook('preHandler', ...)` at the plugin level in both files. Apply during next cleanup pass.

---

### F-04 — Unnecessary conditional spread for `avatarRepository` in `server.ts`

**Severity:** Low  
**File:** `api/server.ts` (lines ~60–64)

**Description:**  
The `avatarRepository` is conditionally spread into the `scenariosRoute` options:

```ts
...(adapters.avatarRepository !== undefined
  ? { avatarRepository: adapters.avatarRepository }
  : {})
```

Since `scenariosRoute` already defaults to `new InMemoryAvatarRepository()` when `avatarRepository` is absent, passing `undefined` directly is safe. The conditional spread is defensive but adds visual noise without adding safety.

**Recommendation:**  
Simplify to `avatarRepository: adapters.avatarRepository` and let the route plugin's default handle the `undefined` case.

---

## Coverage Notes

| File                        | Stmts | Branches | Notes                                                                             |
| --------------------------- | ----- | -------- | --------------------------------------------------------------------------------- |
| `create-avatar.use-case.ts` | 88%   | 65.5%    | Optional field spreads (`tone`, `description`, `adjustments`) not fully exercised |
| `scenarios.ts`              | 92.3% | 45.8%    | Optional field mapper branches and error-path branches uncovered                  |
| `conversations.ts`          | 89.3% | 76.9%    | `getDomainErrorStatus` fallback (`INTERNAL_ERROR`) path uncovered                 |
| All other EPIC 2.2 files    | ≥95%  | ≥83%     | Well covered                                                                      |

All branch gaps are in optional-field paths (tone, description, config) or internal error fallbacks. None affect correctness. Overall branch coverage of 81.38% clears the 80% gate.

---

## Architecture Compliance

| Rule                                                        | Status |
| ----------------------------------------------------------- | ------ |
| 4-layer architecture respected (API → App → Domain → Infra) | ✅     |
| No cross-layer shortcuts                                    | ✅     |
| TypeScript strict mode, no `any`                            | ✅     |
| All external inputs validated at API boundary               | ✅     |
| Standard `ApiResponse<T>` envelope used                     | ✅     |
| No hard-coded credentials or provider names                 | ✅     |
| Ports/adapters pattern used throughout                      | ✅     |
| Game Master untouched (async concern, deferred to EPIC 4.1) | ✅     |

---

## Verdict

**EPIC 2.2 is complete and production-ready for Phase A.** All DoD items are fulfilled. Quality gates pass. Four findings are documented: one medium (timestamp synthesis design smell, deferred to the Postgres adapter phase), three low (TODO placeholder, auth pattern inconsistency, verbose conditional spread). None are blockers.

The next EPIC can proceed.

---

## Remediation Outcome

**Remediated:** 2026-04-19

### Changes Made

| File                                                                 | Change                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `application/use-cases/start-session/start-session.use-case.ts`      | Fixed `TODO(EPIC-X)` → `TODO(EPIC-4.2)`                                                                                                                                                                                                                      |
| `api/routes/scenarios.ts`                                            | Moved auth from per-route `preHandler` option to plugin-level `app.addHook('preHandler', ...)`, matching `conversations.ts` pattern                                                                                                                          |
| `application/use-cases/create-avatar/create-avatar.use-case.test.ts` | Added `describe('CreateAvatarUseCase — optional fields')` with test proving `tone`, `description`, `adjustments` are passed to repository and returned in output                                                                                             |
| `api/routes/scenarios.test.ts`                                       | Added import for `IScenarioRepository`; extended `CreateAvatarRouteData` type with optional fields; added 4 new tests: scenario with explicit `status`, scenario with `config`, avatar with optional fields, and 500 fallback on unexpected repository error |

### F-04 Closure (WNF)

F-04 ("unnecessary conditional spread for `avatarRepository` in `server.ts`") was reversed after attempting the simplification. TypeScript strict mode with `exactOptionalPropertyTypes: true` forbids explicitly passing `undefined` for optional properties — the conditional spread is required, not redundant. Finding closed as **not a real finding**.

### Findings Resolved

| Finding                                          | Resolution                                                                              |
| ------------------------------------------------ | --------------------------------------------------------------------------------------- |
| **F-02** (Low) — `TODO(EPIC-X)` placeholder      | ✅ Resolved — changed to `TODO(EPIC-4.2)`                                               |
| **F-03** (Low) — Auth hook pattern inconsistency | ✅ Resolved — `scenarios.ts` now uses `app.addHook` at plugin level                     |
| **F-04** (Low) — Verbose conditional spread      | ✅ Closed as WNF — conditional spread is required by `exactOptionalPropertyTypes: true` |

### Findings Deferred

| Finding                                             | Reason                                                                                                                                                                                                      |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **F-01** (Medium) — `AvatarConfig` lacks timestamps | Correctly deferred to the Postgres adapter phase. When `PostgresAvatarRepository` is implemented, `AvatarConfig` should gain `createdAt`/`updatedAt` and the use case can remove the synthesized timestamp. |

### Build Gates

| Gate                 | Result                                |
| -------------------- | ------------------------------------- |
| `pnpm lint`          | ✅ PASS                               |
| `pnpm typecheck`     | ✅ PASS                               |
| `pnpm test`          | ✅ PASS — 146/146 (5 new tests added) |
| `pnpm test:coverage` | ✅ PASS                               |

### Coverage After Remediation

| Metric                               | Before | After  | Delta   |
| ------------------------------------ | ------ | ------ | ------- |
| Statements (all files)               | 94.05% | 94.42% | +0.37%  |
| Branches (all files)                 | 81.38% | 85.88% | +4.50%  |
| `scenarios.ts` branches              | 45.83% | 80.00% | +34.17% |
| `create-avatar.use-case.ts` branches | 65.51% | 87.87% | +22.36% |
| Functions (all files)                | 100%   | 100%   | —       |

### Final Feature Confidence

| Feature                                                               | Proven By                                                                  |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `POST /v1/scenarios` auth enforcement (both routes)                   | Unit inject tests (401 without key, 401 with wrong key)                    |
| `POST /v1/scenarios` creates scenario with all fields                 | Tests for minimal, explicit status, explicit config                        |
| `POST /v1/scenarios` rejects bad input                                | Tests for missing name, missing slug, bad slug format, bad status          |
| `POST /v1/scenarios` returns 500 on unexpected error                  | New repository-throws test                                                 |
| `POST /v1/scenarios/:scenarioId/avatars` creates avatar               | Tests for minimal and all optional fields (tone, description, adjustments) |
| `POST /v1/scenarios/:scenarioId/avatars` validates scenario existence | Test for unknown scenario → 404                                            |
| Optional fields flow into repository and response                     | Unit test in `create-avatar.use-case.test.ts`                              |
| `POST /v1/conversations/start` creates session                        | Tests for 201 + correct session shape                                      |
| `GET /v1/conversations/:sessionId/history` returns history            | Tests for 200 + correct envelope                                           |
| `DELETE /v1/conversations/:sessionId` resets messages                 | Tests for 200 + deleted count                                              |
| All routes enforce API key auth                                       | Auth tests across all 5 endpoints                                          |

### Final Grade

**A**

### Remaining Risks

- **F-01 deferred**: `AvatarConfig` timestamp synthesis will need to be resolved when `PostgresAvatarRepository` is introduced. The response timestamps are wall-clock accurate but not derived from the DB write. Tag: `EPIC that introduces PostgresAvatarRepository`.
- `scenarios.ts` branches at 80% (exactly at target) — the `INTERNAL_ERROR` path for the avatar creation route (distinct from scenario creation) is not yet tested. Low risk; pattern is identical to the tested scenario creation fallback.
