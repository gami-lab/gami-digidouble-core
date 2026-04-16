# Project Status

This document tracks the current implementation state of Gami DigiDouble Core.
Update it as epics and features are completed.

**Last updated:** April 17, 2026
**Current phase:** Phase A — MVP (April–July 2026)

---

## Overall Progress

Phase A is in progress. **EPIC 1.1 is complete. EPIC 1.2 is in progress (Prompt 01 done).**

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
- `.github/workflows/ci.yml` — GitHub Actions CI on push/PR to main: format check, lint, typecheck, test
- `CONTRIBUTING.md` — onboarding guide, daily commands, pre-commit and CI behaviour, conventions
- All quality gates verified: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` all pass

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
- `infrastructure/llm/anthropic.adapter.ts` / `mistral.adapter.ts` — stubs that reject with `LlmError('not implemented')`
- `infrastructure/llm/index.ts` — `createLlmAdapter(config)` factory; throws on unknown providers at startup
- `config.ts` updated: `llmProvider` (default `'null'`) and `openaiApiKey` optional fields added
- `.env.example` updated: `LLM_PROVIDER=openai` line added
- ESLint config updated: `argsIgnorePattern: '^_'` added to `no-unused-vars`
- 10 unit tests covering: `NullLlmAdapter` (4), `OpenAiAdapter` happy-path, model override, API error wrapping, generic error wrapping, empty choices, message ordering (6)
- All quality gates pass: `pnpm lint`, `pnpm typecheck`, `pnpm test` (11/11)

---

## Phase A — Sprint Status

### Sprint 1 — Foundations

| Epic                                      | Status          | Notes                                               |
| ----------------------------------------- | --------------- | --------------------------------------------------- |
| EPIC 1.1 — Platform Bootstrap             | **Complete**    | All 5 prompts delivered and validated end-to-end    |
| EPIC 1.2 — First LLM Loop + Observability | **In progress** | Prompt 01 done: LLM provider adapter layer complete |

### Sprint 2 — Avatar + Game Master

| Epic                            | Status      | Notes                                             |
| ------------------------------- | ----------- | ------------------------------------------------- |
| EPIC 2.1 — Avatar Agent v1      | Not started | Persona, tone, direct replies, session continuity |
| EPIC 2.2 — Async Game Master v1 | Not started | Triggers, structured outputs, async directives    |
| EPIC 2.3 — Performance Baseline | Not started | Latency, TTFT, token usage benchmarks             |

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

None yet.

---

## Known Issues / Blockers

None yet.
