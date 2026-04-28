# Project Status

This document tracks the current implementation state of Gami DigiDouble Core.
Update it as epics and features are completed.

**Last updated:** April 28, 2026
**Current phase:** Phase A — MVP (April–July 2026)

---

## Overall Progress

Phase A is in progress. **EPIC 1.1, EPIC 1.2, EPIC 2.1, EPIC 2.2, EPIC 2.3, EPIC 2.4, EPIC 4.1 (Async Game Master v1), EPIC 4.4 (Multi-Avatar Navigation v1), and all associated tests and hardening are complete.**

### Console Admin UI — Full CRUD for Scenarios, Avatars, and Sessions (April 28, 2026)

The `@gami/console` operator UI now supports full admin CRUD flows:

**API client extensions (`apps/console/src/api/`):**

- `scenarios.ts` — `updateScenario(scenarioId, updates)` → `PATCH /v1/scenarios/{scenarioId}`, `deleteScenario(scenarioId)` → `DELETE /v1/scenarios/{scenarioId}`, `updateAvatar(avatarId, updates)` → `PATCH /v1/avatars/{avatarId}`, `deleteAvatar(avatarId)` → `DELETE /v1/avatars/{avatarId}`
- `sessions.ts` — `listSessions(filter?)` → `GET /v1/sessions`, `resetSession(sessionId)` → `POST /v1/sessions/{sessionId}/reset`
- `client.ts` — `HttpMethod` extended to include `'PATCH'`
- `index.ts` — all new functions and `ListSessionsFilter` type re-exported

**Page updates:**

- `ScenarioPage.tsx` — scenario list uses `ScenarioRow` with inline edit (pre-filled name + status form) and delete (window.confirm + 409 conflict message). Avatar section uses `AvatarRow` with inline edit (name, personaPrompt, tone, description) and delete.
- `AvatarPage.tsx` — avatar list uses `AvatarRow` with inline edit and delete.
- New `SessionAdminPage.tsx` — lists all sessions (filtered by selected scenario), status dropdown filter (all/active/closed/archived), Refresh button, per-row Reset button (window.confirm + optimistic row update on success).

**New shared component files:**

- `pages/scenario-row.tsx` — `ScenarioRow`, `ScenarioEditForm`, async update/delete helpers
- `pages/avatar-row.tsx` — `AvatarRow`, `AvatarEditForm`, async update/delete helpers (shared by `ScenarioPage` and `AvatarPage`)

**Navigation (`App.tsx`):**

- `'session-admin'` added to `Page` type and breadcrumb bar
- `ScenarioPageWithActions` component wraps `ScenarioPage` + "Session Admin" and "Open Scenario Test Bench" action buttons
- Session Admin page receives the currently selected `scenarioId` as an optional filter

**Quality gates:** `pnpm --filter @gami/console lint` and `pnpm --filter @gami/console typecheck` both pass cleanly.

### Session Admin Endpoints (April 28, 2026)

Two session admin endpoints have been implemented for console and operational use:

- `GET /v1/sessions` — list all sessions with optional filtering by `scenarioId`, `userId`, or `status`, ordered by `lastActivityAt DESC`
- `POST /v1/sessions/{sessionId}/reset` — hard reset of a session's runtime state: deletes all conversations and messages, clears `activeAvatarId`, `unlockedAvatarIds`, `gmNotes`, resets `status` to `'active'`

Implementation details:

- `ISessionRepository.list(filter?)` port method added with `ListSessionsFilter` type
- `IConversationRepository.deleteBySessionId(sessionId)` port method added
- In-memory and Postgres repository implementations updated for both new methods
- `ListSessionsUseCase` in `application/use-cases/list-sessions/`
- `ResetSessionUseCase` in `application/use-cases/reset-session/`
- `SessionUpdate.activeAvatarId` type extended to allow `null` for explicit clearing
- Stack-e2e coverage in `sessions-admin.stack-e2e.test.ts` (auth, not-found, happy-path)

### AI Guided Discovery reference scenario (April 27, 2026)

A new post-EPIC-4.4 reference acceptance scenario is now implemented and seedable.

- Seed module added: `apps/core/src/seed/ai-guided-discovery.ts`
- Seed command added: `pnpm --filter @gami/core seed:ai-guided-discovery`
- Scenario includes one always-available guide avatar plus two unlockable specialists (`Theo` technical, `Eva` ethics)
- Session state now supports `unlockedAvatarIds` for deterministic per-session avatar availability progression
- Session routes now return `403 FORBIDDEN` when opening/switching to locked avatars in unlock-enabled sessions
- `GET /v1/sessions/{sessionId}/available-avatars` now reflects unlock progression
- `SendMessageUseCase` now applies deterministic topic-signal unlock rules and bounded-competence policy redirects
- Acceptance suite added: `apps/core/src/application/use-cases/ai-guided-discovery.acceptance.test.ts`
- Core unit suite validation after implementation: `pnpm --filter @gami/core test` passes (`255/255`)

### Session vs Conversation model refactor (April 22, 2026)

The core model has been refactored to remove the old ambiguity:

- Session is now an experience-run container.
- Conversation is now a first-class bounded dialogue episode inside a session.
- Messages are now owned by conversation (not by session timeline).

Public API surface now uses:

- `POST /v1/sessions`
- `GET /v1/sessions/:sessionId`
- `POST /v1/sessions/:sessionId/conversations`
- `GET /v1/sessions/:sessionId/conversations`
- `POST /v1/conversations/:conversationId/messages`
- `GET /v1/conversations/:conversationId/history`

Deprecated ambiguous routes (`/v1/conversations/start`, message/history by `{sessionId}`) were removed.

Monorepo workspace bootstrap is done:

- pnpm + Turborepo workspace with `apps/*` and `packages/*`
- Root TypeScript strict configuration (NodeNext, strict, noUncheckedIndexedAccess)
- Root ESLint flat config with typescript-eslint strict rules + complexity/line limits
- `apps/core` package (`@gami/core`) — main application skeleton
- `apps/console` package (`@gami/console`) — internal manual test console consuming Core API contracts
- `packages/shared` package (`@gami/shared`) — shared types placeholder
- Root scripts: `build`, `dev`, `test`, `lint`, `typecheck`, `clean`, `format`, `format:check`
- `.env.example` with full environment variable contract
- `.nvmrc` pinned to Node.js 22 LTS
- All workspace packages typecheck cleanly

Modular monolith skeleton is done:

- `apps/core/src/` layered structure: `api/`, `application/`, `domain/`, `infrastructure/`
- Domain types: conversation (Session, Message), avatar, game-master (Input/Output/State), memory, context, knowledge, scenario
- Application port interfaces: ISessionRepository, IMessageRepository, ILlmAdapter, ICacheAdapter, IObservabilityAdapter
- API: Fastify bootstrap, `/health` route returning `ApiResponse<T>` envelope
- Config: `loadConfig()` with fail-fast env validation
- Infrastructure stubs: db, cache, llm, observability (placeholders for EPIC 1.2+)
- `packages/shared`: `ApiResponse<T>`, `ErrorCode`, `ok()` / `fail()` helpers
- Smoke test: `GET /health` → 200, standard envelope, error null
- `pnpm typecheck` and `pnpm test` pass cleanly across all workspace packages

Developer workflow & CI guardrails are done:

- Prettier 3 with `.prettierrc.json` and `.prettierignore`
- `format` / `format:check` scripts wired through Turborepo
- `lint-staged` configured for staged TypeScript and config files
- `simple-git-hooks` pre-commit hook runs lint-staged on every commit
- `.github/workflows/ci.yml` now uses separated CI gates with PR/main/nightly behavior:
  - PR/push gates: static checks (`format:check`, `lint`, `typecheck`), fast test suite (`pnpm test`), coverage floor (`pnpm --filter @gami/core test:coverage`), dependency vulnerability review (PR), and secrets scan (gitleaks)
  - main-only heavier gate: dedicated integration + E2E run (`pnpm --filter @gami/core test:integration-e2e`) to surface critical-path regressions explicitly
  - nightly scheduled checks: real-provider smoke path (via existing gated integration/E2E tests) and secrets scan, with TODO markers for mutation/regression/performance suites
  - concurrency cancellation enabled for superseded PR runs; coverage report uploaded as workflow artifact
- `CONTRIBUTING.md` — onboarding guide, daily commands, pre-commit and CI behaviour, conventions
- All quality gates verified: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm --filter @gami/core test:coverage` all pass

Foundation validated end-to-end:

- Clean install from scratch (`pnpm install`) succeeds
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` all pass after clean install
- Docker stack starts cleanly: postgres healthy, redis PONG, pgvector 0.8.2 confirmed
- Application starts with `pnpm dev` and responds correctly to `GET /health`
- Health response: `{ "data": { "status": "ok", ... }, "error": null }` — correct `ApiResponse<T>` envelope
- Bootstrap reproducible from `CONTRIBUTING.md` onboarding steps alone
- Documentation synchronized: ARCHITECTURE.md code structure, TECH_STACK.md developer tooling, README setup steps all updated to match reality

EPIC 1.2 — Prompt 01 (LLM provider adapter) is done:

- `infrastructure/llm/llm.error.ts` — `LlmError` class (provider, message, optional statusCode)
- `infrastructure/llm/openai.adapter.ts` — `OpenAiAdapter` implements `ILlmAdapter`, 30s timeout, latency measurement, wraps SDK errors in `LlmError`
- `infrastructure/llm/null.adapter.ts` — `NullLlmAdapter` for tests — deterministic, zero network calls
- `infrastructure/llm/anthropic.adapter.ts` / `mistral.adapter.ts` — concrete adapters with provider error wrapping and latency/token extraction
- `infrastructure/llm/index.ts` — `createLlmAdapter(config)` factory; throws on unknown providers at startup
- `config.ts` updated: `llmProvider` (default `'null'`) and `openaiApiKey` optional fields added
- `.env.example` updated: `LLM_PROVIDER=openai` line added
- ESLint config updated: `argsIgnorePattern: '^_'` added to `no-unused-vars`
- 10 unit tests covering: `NullLlmAdapter` (4), `OpenAiAdapter` happy-path, model override, API error wrapping, generic error wrapping, empty choices, message ordering (6)
- All quality gates pass: `pnpm lint`, `pnpm typecheck`, `pnpm test` (11/11)

EPIC 1.2 — Prompt 02 (Observability adapter) is done:

- `infrastructure/observability/null.adapter.ts` — `NullObservabilityAdapter` — no-op, used in all tests
- `infrastructure/observability/console.adapter.ts` — `ConsoleObservabilityAdapter` — structured JSON stdout, used when Langfuse keys absent
- `infrastructure/observability/langfuse.adapter.ts` — `LangfuseObservabilityAdapter` — records traces + generations to Langfuse; SDK errors silently swallowed; `flush()` idempotent (calls `shutdownAsync()` once)
- `infrastructure/observability/index.ts` — `createObservabilityAdapter(config)` factory; `ObservabilityConfig` exported
- `config.ts` updated: optional `langfusePublicKey`, `langfuseSecretKey`, `langfuseHost` fields added
- `apps/core/src/index.ts` updated: `SIGTERM`/`SIGINT` handlers flush pending traces before process exit; startup error path also flushes
- `langfuse` SDK installed in `apps/core`; all SDK imports confined to `infrastructure/observability/`
- 20 unit tests: `NullObservabilityAdapter` (3), `ConsoleObservabilityAdapter` (4), `LangfuseObservabilityAdapter` (7), factory `createObservabilityAdapter` (5) — no live Langfuse instance required
- All quality gates pass: `pnpm lint`, `pnpm typecheck`, `pnpm test` (46/46)

EPIC 1.2 — Prompt 03 (First exchange use case) is done:

- `application/use-cases/send-raw-message/send-raw-message.types.ts` — `SendRawMessageInput` / `SendRawMessageOutput` DTOs
- `application/use-cases/send-raw-message/send-raw-message.use-case.ts` — `SendRawMessageUseCase.execute()`: generates UUID requestId, calls `ILlmAdapter`, fires non-blocking observability trace, returns output DTO
- Application layer depends only on `application/ports/` — no infrastructure imports
- Default system prompt: `"You are a helpful assistant."` (to be replaced by persona in EPIC 2.1)
- Observability failures caught and logged to stderr — never propagate to caller
- 10 unit tests: happy path, UUID format, uniqueness, trace call count, trace payload, default/custom system prompt, message forwarding, observability error swallowed, LLM error propagated
- All quality gates pass: `pnpm lint`, `pnpm typecheck`, `pnpm test` (56/56)

EPIC 1.2 — Prompt 04 (Expose exchange via API endpoint) is done:

- `api/hooks/authenticate.ts` — reusable `authenticateApiKey` preHandler using constant-time comparison (`crypto.timingSafeEqual`)
- `api/routes/exchange.ts` — `POST /v1/exchange` route with Fastify body schema validation and `SendRawMessageUseCase` wiring
- `api/server.ts` — route registration and validation error envelope mapping (`VALIDATION_ERROR`)
- `api/routes/exchange.test.ts` — integration tests via Fastify `inject()`: success, missing/wrong API key, and invalid body
- `createServer()` supports adapter overrides for tests to inject `NullLlmAdapter` + `NullObservabilityAdapter` and avoid live LLM calls
- `packages/shared` error codes updated with `VALIDATION_ERROR` and `EXTERNAL_SERVICE_ERROR`
- `docs/API_CONTRACT.md` updated with `POST /v1/exchange` contract and endpoint-specific error mapping

EPIC 1.2 — Final closure validation is done:

- Clean install from scratch executed: `rm -rf node_modules apps/core/node_modules packages/shared/node_modules && pnpm install`
- Quality gates pass from workspace root: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`
- End-to-end loop validated for `POST /v1/exchange`: HTTP route → use case → LLM adapter → observability trace → API response
- Metrics confirmed in both API output and observability traces: latency, input/output tokens, model
- Startup/shutdown flush path validated and aligned: the same observability adapter instance is used by request handling and process shutdown hooks
- Leftover EPIC 1.2 placeholder text removed from `infrastructure/llm/index.ts`
- Real-provider smoke (`OPENAI_API_KEY`) remains an environment-dependent manual step when credentials are available

EPIC 2.1 — Prompt 03 (SendMessage use case) is done:

- `application/use-cases/send-message/send-message.types.ts` — `SendMessageInput` / `SendMessageOutput` DTOs
- `application/use-cases/send-message/send-message.use-case.ts` — `SendMessageUseCase.execute()`: validates input, loads active session and avatar, assembles persona system prompt, builds chronological message history (limit 20), persists user/avatar messages, and fires non-blocking observability trace
- `application/ports/IMessageRepository.ts` updated: `findBySessionId(sessionId, { limit? })` and `save(...)` contract for persisted messages with generated IDs and timestamps
- `domain/errors.ts` — `DomainError` (`code` + `message`) for application/domain not-found and invalid-state flows
- LLM errors are propagated unmodified; observability failures are swallowed and logged to stderr; `// TODO(EPIC-4.1): trigger GM observation` added after avatar message persistence
- Unit tests cover happy path, session/avatar not found, closed session, history ordering, LLM error propagation, observability failure swallowing, and user message persistence ordering before LLM call

EPIC 2.1 — Prompt 04 (API endpoint for send message) is done:

- `api/routes/conversations.ts` — `POST /v1/conversations/:conversationId/messages` with API-key auth, conversation-scoped validation, `SendMessageUseCase` wiring, and error mapping (`404`/`409`/`502`/`500`)
- `api/server.ts` — route registered via `server.register(messagesRoute, { prefix: '/v1/conversations' })`
- `infrastructure/db/in-memory-session.repository.ts` and `infrastructure/db/in-memory-message.repository.ts` added as Sprint 2 placeholders implementing `ISessionRepository` and `IMessageRepository`
- `api/routes/messages.test.ts` — inject() tests for success, auth failures, validation failures, unknown session, closed session, `LlmError`, and unexpected error
- `docs/API_CONTRACT.md` section 2 updated to match Sprint 2 request/response and error mapping

EPIC 2.1 — Prompt 05 (tests and hardening) is done:

- `domain/avatar/persona-prompt.service.test.ts` now covers persona inclusion, name inclusion, tone placement, empty persona validation, and deterministic output
- `application/use-cases/send-message/send-message.use-case.ts` now hard-caps assembled history to 20 messages before LLM invocation, even if repository output exceeds the requested limit
- `application/use-cases/send-message/send-message.use-case.test.ts` now covers session validation (`not found` / `closed` / `archived`), avatar loading, prompt assembly, history ordering + truncation, persistence ordering + metadata, observability trace behavior, and `LlmError` propagation
- `api/routes/messages.test.ts` now follows auth/validation + session/use-case behavior blocks and covers status mappings `200`, `401`, `400`, `404`, `409`, `502`, and `500` with strict envelope assertions
- `api/routes/messages.e2e.test.ts` added with `describe.skipIf(!OPENAI_API_KEY)` for optional real-provider multi-turn context continuity checks
- Coverage threshold (≥80%) and quality gates remain validated for the workspace execution flow

EPIC 2.1 — Avatar Agent v1 closure summary:

- Delivered scope:
  - Avatar domain model and repository port (`domain/avatar/avatar.types.ts`, `application/ports/IAvatarRepository.ts`)
  - Persona-driven prompt assembly (`domain/avatar/persona-prompt.service.ts`) with fixture support (`domain/avatar/avatar.fixtures.ts`); `adjustments?: string[]` is a typed first-class field on `AvatarConfig` (no magic config keys)
  - Conversation orchestration use case (`application/use-cases/send-message/send-message.use-case.ts`) with session validation, avatar loading, history assembly, message persistence; use case output includes `session` summary (no second DB read at route level)
  - HTTP endpoint `POST /v1/conversations/:conversationId/messages` (`api/routes/conversations.ts`) with auth, validation, contract mapping, and error mapping; route defaults to empty in-memory repos (no hardcoded demo fixtures)
- Key design decisions locked in EPIC 2.1:
  - History limit hard-capped to 20 messages before LLM invocation
  - `avatarId` is required in request body for Sprint 2 (temporary until scenario-defaulted avatar flow in Sprint 4)
  - Non-blocking observability tracing; LLM errors propagate; observability failures are swallowed/logged
  - Explicit `// TODO(EPIC-4.1): trigger GM observation` marker after avatar message persistence
- Test and quality summary for EPIC closure:
  - Core unit suite: 94 tests across 15 test files
  - Coverage gate (≥80%) retained on all dimensions
  - Route coverage includes `messages.test.ts` and optional real-provider `messages.e2e.test.ts` (`describe.skipIf(!OPENAI_API_KEY)`)
  - All Sprint 2 documentation targets synchronized to implementation (PROJECT_STATUS, API_CONTRACT, DATA_MODEL, ARCHITECTURE, TEST_STRATEGY)

EPIC 2.2 — Prompt 01 (Scenario domain and endpoint) is done:

- `application/ports/IScenarioRepository.ts` added with `create` and `findById` methods
- `infrastructure/db/in-memory-scenario.repository.ts` added with constructor seed support and scenario ID generation (`scenario_<uuid>`)
- `application/use-cases/create-scenario/*` added with validation for name/status and `DomainError('VALIDATION_ERROR', ...)` mapping for invalid input
- `api/routes/scenarios.ts` added for `POST /v1/scenarios` with API-key auth, schema validation, and `201 Created` response envelope
- `api/server.ts` updated to wire `scenarioRepository` through `ServerAdapters` and register `scenariosRoute` under `/v1/scenarios`
- `api/routes/scenarios.test.ts` and `api/routes/scenarios.stack-e2e.test.ts` added covering auth, validation, and happy path

EPIC 2.2 — Prompt 02 (Avatar creation endpoint) is done:

- `application/ports/IAvatarRepository.ts` extended with typed `create(params)` and `CreateAvatarParams`
- `infrastructure/db/in-memory-avatar.repository.ts` now implements `create` with `avatar_<uuid>` ID generation and map persistence
- `application/use-cases/create-avatar/*` added with validation (`name`, `personaPrompt`), scenario existence check, and `DomainError` mapping (`VALIDATION_ERROR`, `NOT_FOUND`)
- `api/routes/scenarios.ts` extended with `POST /v1/scenarios/:scenarioId/avatars` (API-key auth, schema validation, `201` success envelope, `400/404/500` mapping)
- `api/server.ts` updated to pass `avatarRepository` through scenarios route wiring
- `api/routes/avatars.stack-e2e.test.ts` added to cover auth, validation, unknown scenario (`404`), and full success flow (`201`) by creating a scenario then an avatar via real HTTP
- `docs/API_CONTRACT.md` updated with the avatar creation contract (`POST /v1/scenarios/{scenarioId}/avatars`)

EPIC 2.2 — Prompt 02b (Update avatar endpoint) is done:

- `application/ports/IAvatarRepository.ts` extended with `update(avatarId, updates): Promise<AvatarConfig>` and `UpdateAvatarParams` type
- `infrastructure/db/in-memory-avatar.repository.ts` implements `update()` with merge semantics (`NOT_FOUND` on unknown ID, `updatedAt` always refreshed)
- `infrastructure/db/repositories/postgres-avatar.repository.ts` implements `update()` with dynamic SQL (only present columns touched, `updated_at = NOW()`)
- `application/use-cases/update-avatar/*` added with empty-body guard (`INVALID_INPUT`) and `NOT_FOUND` propagation
- `api/routes/avatars.ts` extended with `PATCH /v1/avatars/:avatarId` (API-key auth, all-optional body schema, `200/400/404/500` mapping)
- `api/routes/avatars.test.ts` extended with PATCH unit tests (happy path, not-found, empty body, no API key)
- `api/routes/avatars.stack-e2e.test.ts` extended with PATCH coverage (auth, empty body, not-found, happy path with `updatedAt` assertion)
- `docs/API_CONTRACT.md` updated with `PATCH /v1/avatars/{avatarId}` section

EPIC 2.2 — Prompt 03 (Session lifecycle endpoints) is done:

- `application/ports/IMessageRepository.ts` extended with `deleteBySessionId(sessionId): Promise<number>`
- `infrastructure/db/in-memory-message.repository.ts` now implements in-place message deletion by `sessionId` and returns deleted count
- Added use cases: `StartSessionUseCase`, `GetHistoryUseCase`, and `ResetSessionUseCase` with `DomainError` mappings for validation and not-found flows (including `scenarioId` existence validation on start session)
- Added `api/routes/conversations.ts` with:
  - `POST /v1/sessions`
  - `POST /v1/sessions/:sessionId/conversations`
  - `GET /v1/conversations/:conversationId/history`
- `api/server.ts` now registers `conversationsRoute` under `/v1/conversations` alongside `messagesRoute`
- Added `api/routes/conversations.test.ts` (inject-based route tests) for auth, validation, not-found, and success paths
- Added `api/routes/conversations.stack-e2e.test.ts` for stack lifecycle flow: start → history → reset → history (session preserved)
- Updated `docs/API_CONTRACT.md` notes for Sprint 2 simplifications/deferred fields:
  - Start Session uses flat `userId` + `scenarioId`
  - History omits `memory` (deferred to EPIC 4.2)
  - Reset hardcodes `sessionMemory=false` (EPIC 4.2) and `events=0` (EPIC 3.3)

EPIC 2.2 — Prompt 04 (Messages stack happy path) is done:

- `api/routes/messages.stack-e2e.test.ts` now includes a working happy-path stack test that creates scenario + avatar + session via HTTP, then sends a message and asserts response contract shape
- Happy-path section is guarded with `describe.skipIf(!isNullProvider)` so it runs in null-provider stack environments and skips otherwise

Test coverage hardening (post-EPIC 1.2):

- `@vitest/coverage-v8` installed; coverage thresholds enforced at 80% lines/branches/functions/statements
- `vitest.config.ts` updated: coverage enabled with `reporter: ['text', 'lcov']`; type-only files (ports, domain types, cache/db stubs) correctly excluded from measurement
- `pnpm test:coverage` script added to `apps/core/package.json`
- `api/routes/exchange.test.ts` expanded: 8 tests now covering auth (missing/wrong key), validation (missing field, empty message), error paths (502 via `LlmError`, 500 via unexpected error), and systemPrompt forwarding
- `api/routes/exchange.e2e.test.ts` added: 3 real E2E tests (OpenAI, Anthropic, Mistral) exercising the full HTTP → LLM → response path with no mocks; each `skipIf` guarded by the respective API key environment variable
- Achieved: 94.38% statement coverage, 87.91% branch coverage, 100% function coverage (67 tests across 15 test files)

GM system — Prompt 05 (Tests and hardening) is done:

- `domain/game-master/trigger-engine.test.ts` extended: all trigger paths covered — `turn_threshold` (at/below/double default threshold, custom threshold of exactly 3), `topic_repeat` (fires at 3 repeats, null with 2 each at default threshold), `progression_stalled` (empty and `'none'` progression, has text → null, below count → null, custom threshold), priority ordering (turn_threshold beats topic_repeat beats progression_stalled), and zero-state base case (`interactionCount=0`)
- `domain/game-master/gm-state-reducer.test.ts` extended: all-undefined `stateUpdate` (only `interactionCount` changes), and non-mutation of input state (original array reference and count unchanged after call)
- `application/use-cases/run-game-master/run-game-master.use-case.ts` hardened: LLM call wrapped in try/catch via extracted `callLlm` private method; LLM errors are caught silently, state is still incremented, and a `gm_skipped` event is emitted; `execute` complexity reduced by extracting triggered path to `handleTriggeredTurn`
- `application/use-cases/run-game-master/run-game-master.use-case.test.ts` extended: event log shape tests (`gm_skipped` and `gm_triggered` field verification), event payload security (confirms `userMessageText` and raw system prompt are absent from emitted payloads), and LLM error path (no exception propagates, state incremented, `gm_skipped` emitted with correct `triggerReason`)
- `infrastructure/db/repositories/postgres-gm-state.repository.integration.test.ts` added: `findBySessionId` returns null for unknown session, `save` inserts row, second `save` upserts (row count stays 1), all `GameMasterState` fields round-trip, `currentAvatarId` is `undefined` (not null) when absent
- `infrastructure/db/repositories/postgres-event-log.repository.integration.test.ts` added: `append` inserts row, row retrievable by `correlation_id`, `sessionId = null` is valid (nullable FK), JSONB payload stores and retrieves nested objects, `sessionId` with `session_` prefix stores the FK correctly
- Unit test suite: 187 tests · 35 test files (up from 175 · 35); all quality gates pass

---

## Phase A — Sprint Status

### Sprint 1 — Foundations

| Epic                                      | Status       | Notes                                                                              |
| ----------------------------------------- | ------------ | ---------------------------------------------------------------------------------- |
| EPIC 1.1 — Platform Bootstrap             | **Complete** | All 5 prompts delivered and validated end-to-end                                   |
| EPIC 1.2 — First LLM Loop + Observability | **Complete** | Full loop validated end-to-end, docs synchronized, shutdown flush wiring finalized |

### Sprint 2 — First Usable Product Slice

| Epic                                       | Status       | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------ | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EPIC 2.1 — Avatar Agent v1                 | **Complete** | Prompt 01–06 delivered. Post-audit remediation applied: `adjustments?: string[]` typed field on `AvatarConfig` (replacing untyped magic key), `SendMessageOutput` now carries session summary (eliminates second DB read in route), demo/fixture data removed from production route defaults. Test suite: 94 passing, coverage gate retained.                                                                                                                                                                                       |
| EPIC 2.2 — Scenario & Session Lifecycle v1 | **Complete** | POST /v1/scenarios, GET /v1/scenarios, POST /v1/scenarios/:scenarioId/avatars, GET /v1/scenarios/:scenarioId/avatars, DELETE /v1/avatars/:avatarId, **PATCH /v1/avatars/:avatarId**, DELETE /v1/scenarios/:scenarioId, PATCH /v1/scenarios/:scenarioId, plus refactored session/conversation lifecycle routes (`POST /v1/sessions`, `POST /v1/sessions/:sessionId/conversations`, `POST /v1/conversations/:conversationId/messages`, `GET /v1/conversations/:conversationId/history`, `GET /v1/sessions/:sessionId/conversations`). |
| EPIC 2.3 — Persistence Layer v1            | **Complete** | Postgres repository adapters (Scenario, Avatar, Session, Message), DB schema migrations, connection pooling. Replaces all in-memory stubs in production. Fixes AvatarConfig timestamp gap from EPIC 2.2.                                                                                                                                                                                                                                                                                                                            |
| EPIC 2.4 — Manual Test Console v1          | **Complete** | `@gami/console` now reflects the refactored Session/Conversation model: scenario select/create, avatar select/create, session detail, explicit conversation-start actions, session conversation list, conversation-scoped history, and conversation-level send-message flow (`/v1/conversations/:conversationId/messages`). Includes state-transition tests for multi-conversation-per-avatar behavior and history isolation, plus updated console docs.                                                                            |

### Sprint O — Operations / Control Plane

| Epic                                     | Status      | Notes                                                                    |
| ---------------------------------------- | ----------- | ------------------------------------------------------------------------ |
| EPIC O1 — Health & Dependency Monitoring | Not started | Rich `/v1/admin/health` + `/v1/admin/dependencies` per-dependency probes |
| EPIC O2 — Admin Runtime Console          | Not started | Session inspector: state, memory, GM state, events, errors, audit log    |
| EPIC O3 — Manual Test Console & Replay   | Not started | Reset + replay-turn endpoints; back-office test chat UI                  |
| EPIC O4 — Usage Analytics & Reliability  | Not started | Metrics overview endpoint; back-office dashboard charts                  |
| EPIC O5 — Ingestion Pipeline Visibility  | Not started | IngestionJob entity; job list; retry endpoint; audit log on retry        |

### Sprint 3 — Memory + API

| Epic                       | Status      | Notes                                                 |
| -------------------------- | ----------- | ----------------------------------------------------- |
| EPIC 3.1 — Memory Layer v1 | Not started | Session summary + persistent user facts               |
| EPIC 3.2 — Public Core API | Not started | REST endpoints: start, message, history, state, reset |
| EPIC 3.3 — Streaming UX    | Not started | WebSocket token streaming                             |

### Sprint 4 — Orchestration Intelligence

| Epic                                  | Status       | Notes                                                                                                                                                                                                                          |
| ------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| EPIC 4.1 — Async Game Master v1       | **Complete** | Trigger engine (turn_threshold, topic_repeat, progression_stalled), RunGameMasterUseCase, GM state persistence (PostgresGmStateRepository), event log (PostgresEventLogRepository), guidance note injection into Avatar prompt |
| EPIC 4.4 — Multi-Avatar Navigation v1 | **Complete** | Active-avatar routing, transition rules, manual+GM handoff flow, transition history endpoints, and test/doc hardening are implemented and validated                                                                            |
| EPIC 4.2 — Memory Layer v1            | Not started  | Session summary + persistent user facts                                                                                                                                                                                        |
| EPIC 4.3 — Performance Baseline       | Not started  | TTFT metrics, step timing, Avatar-only vs Avatar+GM comparison                                                                                                                                                                 |

### Sprint 5 — Back-office v1

| Epic                                | Status      | Notes                                               |
| ----------------------------------- | ----------- | --------------------------------------------------- |
| EPIC 5.1 — Scenario Builder         | Not started | Non-dev UI for config, avatars, objectives, sources |
| EPIC 5.2 — Live Test Console        | Not started | In-browser conversation testing, reset              |
| EPIC 5.3 — Logs & Metrics Dashboard | Not started | Session logs, latency charts, token/cost summaries  |

### Sprint 6 — Stabilization + Demo

| Epic                                 | Status      | Notes                                                    |
| ------------------------------------ | ----------- | -------------------------------------------------------- |
| EPIC 6.1 — Production Readiness v0   | Not started | Bug fixes, resilience, error handling, edge cases        |
| EPIC 6.2 — Benchmark Pack            | Not started | P50/P95/P99 latency, 3+ model comparison, quality review |
| EPIC 6.3 — Summer Prototype Delivery | Not started | Working text-in/out core + back-office + AVA scenario    |

---

## Implemented Modules

- API baseline (`/health`, `/v1/exchange`)
- LLM adapter layer (OpenAI, Anthropic, Mistral, Null)
- Observability adapter layer (Langfuse, Console, Null)
- Session + conversation lifecycle (session create/read, conversation start/list, message send/history by conversation)
- GM state persistence (table `gm_states`, in-memory + Postgres repositories, adapter wiring)
- GM deterministic trigger engine (`evaluateTriggers`) with policy thresholds for `turn_threshold`, `topic_repeat`, and `progression_stalled`
- GM background orchestration wired (`RunGameMasterUseCase`): non-blocking execution from `SendMessageUseCase`, state reducer persistence, and session-level director notes injection into next avatar prompt
- Event log infrastructure (table `event_log`, `IEventLogRepository` port, `InMemoryEventLogRepository`, `PostgresEventLogRepository`); `RunGameMasterUseCase` emits `gm_triggered` and `gm_skipped` events on every run; emission failures are swallowed and logged to stderr
- Scenario management (create)
- Scenario management (create, list, delete with dependency checks)
- Avatar management (create, list-by-scenario, delete with active-session safety checks)
- Manual Test Console scaffold (`apps/console`) with API connectivity check (`GET /health`)
- Manual Test Console API client layer (`apps/console/src/api`) for scenario/avatar list+create, session create/read, conversation start/list/history, and conversation message send
- Manual Test Console scenario/avatar management pages (`apps/console/src/pages/ScenarioPage.tsx`, `AvatarPage.tsx`) with explicit create-or-select flow
- Manual Test Console session page (`apps/console/src/pages/SessionPage.tsx`) with session metadata, explicit conversation start CTAs, session conversation list, open-previous-conversation flow, and conversation-scoped chat history
- Per-avatar-message debug metadata panel for `model`, `latencyMs`, `inputTokens`, and `outputTokens` when present
- Console state/model transition tests for distinct conversations per avatar and selected-conversation history isolation (`apps/console/src/pages/session-state.test.ts`)
- Global UI `ErrorBoundary` fallback for unhandled render errors with explicit reload action

**Persistence Layer (EPIC 2.3):**

- `PostgresScenarioRepository`, `PostgresAvatarRepository`, `PostgresSessionRepository`, `PostgresMessageRepository` replace in-memory stubs in production
- `postgres` (postgres.js) client with lazy singleton pool (`max: 10`)
- SQL migrations in `apps/core/src/infrastructure/db/migrations/`; applied at server startup
- All four repos have integration tests (`*.integration.test.ts`)
- `AvatarConfig` now carries `createdAt` / `updatedAt` (F-01 fix)
- `CreateAvatarUseCase` no longer synthesises timestamps
- Stack-level persistence verified by `persistence.e2e.test.ts`

## EPIC 4.4 — Multi-Avatar Navigation v1 ✅ Done

Completed multi-avatar routing and persistence hardening across domain, application, API, and Postgres adapters.

- AvatarTransitionRule types + transition-engine.ts (pure domain)
- GM-driven conversationMode: 'new' path activated in RunGameMasterUseCase
- POST /v1/sessions/:sessionId/switch-avatar — manual switch use case + route
- GET /v1/sessions/:sessionId/available-avatars
- GET /v1/sessions/:sessionId/avatar-transitions
- Full unit, integration, and stack-e2e test coverage

---

## Known Issues / Blockers

### Operational Gap (structural, not a bug)

EPIC 1.2 delivered LLM tracing foundations (Langfuse wrapper, token/latency tracking, structured logs).

However, the current system lacks production operability:

- No dependency health probe (`GET /health` is flat; no per-dependency status)
- No session inspector (operators cannot read session state, memory, or GM state without DB access)
- No ingestion job visibility (knowledge pipeline failures are silent)
- No admin actions (reset, replay, retry require engineering intervention)
- No audit trail (no record of who did what in production)
- No metrics endpoint (no token usage summary, cost, error rate at a glance)
- Langfuse captures LLM traces only — total system operability is untracked

**Resolution:** Sprint O (EPICs O1–O5) has been added to the roadmap and is now the next priority after Sprint 2.

---

## Recommended Next Execution Order

1. **Sprint 2** — Avatar Agent v1 (EPIC 2.1) + Scenario & Session Lifecycle v1 (EPIC 2.2) + Persistence Layer v1 (EPIC 2.3) + Manual Test Console v1 (EPIC 2.4)
2. **Sprint O** — O1 (health), O2 (session inspector), O3 (test console + reset/replay), O4 (metrics dashboard), O5 (ingestion visibility)
3. **Sprint 3** — Memory Layer v1 + Public Core API + Streaming UX
4. **Sprint 4** — RAG + Context Intelligence
5. **Sprint 5** — Back-office v1 (builds on O3/O4 foundations)
6. **Sprint 6** — Stabilization + Summer Demo

Operations is deliberately ordered before Memory and API, because:

- Memory bugs are invisible without session inspection tools
- API design quality improves when operators can replay and inspect real traffic
- The team cannot iterate on GM and Avatar quality without a manual test console
