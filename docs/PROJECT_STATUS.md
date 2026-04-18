# Project Status

This document tracks the current implementation state of Gami DigiDouble Core.
Update it as epics and features are completed.

**Last updated:** April 18, 2026
**Current phase:** Phase A — MVP (April–July 2026)

---

## Overall Progress

Phase A is in progress. **EPIC 1.1 is complete. EPIC 1.2 is complete.**

Monorepo workspace bootstrap is done:

- pnpm + Turborepo workspace with `apps/*` and `packages/*`
- Root TypeScript strict configuration (NodeNext, strict, noUncheckedIndexedAccess)
- Root ESLint flat config with typescript-eslint strict rules + complexity/line limits
- `apps/core` package (`@gami/core`) — main application skeleton
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
- LLM errors are propagated unmodified; observability failures are swallowed and logged to stderr; `// TODO(EPIC-2.2): trigger GM observation` added after avatar message persistence
- Unit tests cover happy path, session/avatar not found, closed session, history ordering, LLM error propagation, observability failure swallowing, and user message persistence ordering before LLM call

EPIC 2.1 — Prompt 04 (API endpoint for send message) is done:

- `api/routes/messages.ts` — `POST /v1/conversations/:sessionId/messages` with API-key auth, body schema validation (`avatarId`, `message.content`), `SendMessageUseCase` wiring, response DTO mapping to `SendMessageResponse`, and error mapping (`404`/`409`/`502`/`500`)
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
  - Persona-driven prompt assembly (`domain/avatar/persona-prompt.service.ts`) with fixture support (`domain/avatar/avatar.fixtures.ts`)
  - Conversation orchestration use case (`application/use-cases/send-message/send-message.use-case.ts`) with session validation, avatar loading, history assembly, and message persistence
  - HTTP endpoint `POST /v1/conversations/:sessionId/messages` (`api/routes/messages.ts`) with auth, validation, contract mapping, and error mapping
- Key design decisions locked in EPIC 2.1:
  - History limit hard-capped to 20 messages before LLM invocation
  - `avatarId` is required in request body for Sprint 2 (temporary until scenario-defaulted avatar flow in Sprint 4)
  - Non-blocking observability tracing; LLM errors propagate; observability failures are swallowed/logged
  - Explicit `// TODO(EPIC-2.2): trigger GM observation` marker after avatar message persistence
- Test and quality summary for EPIC closure:
  - Core unit suite: 91 tests across 15 test files (`corepack pnpm --filter @gami/shared build && corepack pnpm --filter @gami/core test:coverage`)
  - Coverage: 94.90% statements, 85.64% branches, 100% functions, 94.90% lines
  - Route coverage includes `messages.test.ts` and optional real-provider `messages.e2e.test.ts` (`describe.skipIf(!OPENAI_API_KEY)`)
  - All Sprint 2 documentation targets synchronized to implementation (PROJECT_STATUS, API_CONTRACT, DATA_MODEL, ARCHITECTURE, TEST_STRATEGY)

Test coverage hardening (post-EPIC 1.2):

- `@vitest/coverage-v8` installed; coverage thresholds enforced at 80% lines/branches/functions/statements
- `vitest.config.ts` updated: coverage enabled with `reporter: ['text', 'lcov']`; type-only files (ports, domain types, cache/db stubs) correctly excluded from measurement
- `pnpm test:coverage` script added to `apps/core/package.json`
- `api/routes/exchange.test.ts` expanded: 8 tests now covering auth (missing/wrong key), validation (missing field, empty message), error paths (502 via `LlmError`, 500 via unexpected error), and systemPrompt forwarding
- `api/routes/exchange.e2e.test.ts` added: 3 real E2E tests (OpenAI, Anthropic, Mistral) exercising the full HTTP → LLM → response path with no mocks; each `skipIf` guarded by the respective API key environment variable
- Achieved: 94.38% statement coverage, 87.91% branch coverage, 100% function coverage (67 tests across 15 test files)

---

## Phase A — Sprint Status

### Sprint 1 — Foundations

| Epic                                      | Status       | Notes                                                                              |
| ----------------------------------------- | ------------ | ---------------------------------------------------------------------------------- |
| EPIC 1.1 — Platform Bootstrap             | **Complete** | All 5 prompts delivered and validated end-to-end                                   |
| EPIC 1.2 — First LLM Loop + Observability | **Complete** | Full loop validated end-to-end, docs synchronized, shutdown flush wiring finalized |

### Sprint 2 — Avatar + Game Master

| Epic                            | Status       | Notes                                                                                                                                                                                                                                        |
| ------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EPIC 2.1 — Avatar Agent v1      | **Complete** | Prompt 01 done; Prompt 02 done: persona prompt assembly service + unit tests; Prompt 03 done: SendMessage use case; Prompt 04 done: `POST /v1/conversations/:sessionId/messages`; Prompt 05 done: tests + hardening + coverage gate retained |
| EPIC 2.2 — Async Game Master v1 | Not started  | Triggers, structured outputs, async directives                                                                                                                                                                                               |
| EPIC 2.3 — Performance Baseline | Not started  | Latency, TTFT, token usage benchmarks                                                                                                                                                                                                        |

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

### Sprint 4 — RAG + Context

| Epic                              | Status      | Notes                                                      |
| --------------------------------- | ----------- | ---------------------------------------------------------- |
| EPIC 4.1 — Knowledge Pipeline v1  | Not started | PDF/Markdown/text ingestion, chunking, pgvector, retrieval |
| EPIC 4.2 — Context Manager v1     | Not started | Unified context assembly, memory injection, token budgets  |
| EPIC 4.3 — AVA Content Validation | Not started | Test on real scenario assets                               |

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

1. **Sprint 2** — Avatar Agent v1 (EPIC 2.1) + Async Game Master v1 (EPIC 2.2) + Performance Baseline (EPIC 2.3)
2. **Sprint O** — O1 (health), O2 (session inspector), O3 (test console + reset/replay), O4 (metrics dashboard), O5 (ingestion visibility)
3. **Sprint 3** — Memory Layer v1 + Public Core API + Streaming UX
4. **Sprint 4** — RAG + Context Intelligence
5. **Sprint 5** — Back-office v1 (builds on O3/O4 foundations)
6. **Sprint 6** — Stabilization + Summer Demo

Operations is deliberately ordered before Memory and API, because:

- Memory bugs are invisible without session inspection tools
- API design quality improves when operators can replay and inspect real traffic
- The team cannot iterate on GM and Avatar quality without a manual test console
