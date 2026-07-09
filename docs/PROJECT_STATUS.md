# PROJECT_STATUS.md

# Project Status

This document tracks the implementation status of Gami DigiDouble Core.

Last updated: June 3, 2026
Current phase: Phase A — MVP (April → July 2026)

---

# 1. Overall Status

Phase A is actively in progress.

The platform now includes:

- modular monorepo architecture
- API-first backend
- async Game Master orchestration
- layered memory system
- runtime observability
- operational admin tooling
- SSE runtime events
- multi-avatar session management
- deterministic lifecycle management
- runtime inspection and debugging tools

The system is now a fully operational conversational runtime with:

- bounded memory
- inspectable orchestration
- deterministic runtime state
- async GM execution
- operational observability
- production-grade persistence

See `ARCHITECTURE.md` for the current architecture, `MEMORY_SYSTEM_SPEC.md` for memory design, and `TECH_STACK.md` for the technology stack.

---

# 2. EPIC Status

---

## EPIC 1.1 — Core Platform Bootstrap

Status: ✅ Complete
Completed on: 2026-04-22

### Includes

- monorepo bootstrap
- Docker local stack
- PostgreSQL + Redis + pgvector
- strict TypeScript configuration
- CI/CD quality gates
- modular monolith structure
- shared contracts package
- health endpoint
- developer tooling
- workspace conventions

---

## EPIC 1.2 — First LLM Loop + Observability

Status: ✅ Complete
Completed on: 2026-04-22

### Includes

- provider abstraction layer
- OpenAI / Anthropic / Mistral adapters
- observability abstraction
- Langfuse integration
- `/v1/exchange`
- API-key authentication
- latency/token metrics
- non-blocking tracing
- provider isolation

---

## EPIC 2.1 — Avatar Agent v1

Status: ✅ Complete
Completed on: 2026-04-22

### Includes

- avatar domain model
- persona prompt assembly
- multi-turn conversation flow
- message persistence
- chronological history assembly
- `POST /v1/conversations/{conversationId}/messages`
- observability integration
- conversation validation

---

## EPIC 2.1b — Avatar Agent v2 (Memory + Persona + RAG Awareness)

Status: ✅ Complete
Completed on: 2026-05-13

### Current slice completed

- contract cleanup baseline completed before Avatar v2 feature work
- canonical shared ownership established for session/conversation HTTP DTOs in `packages/shared/src/conversation-contract-types.ts`
- duplicated local API contract types removed from core route and console adapters (`send-message`, `history`, `available-avatars`, `switch-avatar`)
- imports normalized to shared canonical contracts across `apps/core`, `apps/console`, and `packages/shared`
- nullability policy preserved: `undefined` for internal optional fields, explicit `null` only where API contract requires it
- quality gates validated for this slice: `pnpm lint`, `pnpm typecheck`, `pnpm test`
- avatar-context contracts now expose canonical additive typed retrieval sections (`memory|world|media`) alongside merged retrieval items to reduce domain/shared/console drift
- avatar prompt assembly v2 now uses one deterministic canonical path (`SendMessageUseCase` -> `ContextEngine` -> `assemblePersonaPrompt`)
- system prompt injection now includes bounded persona, short-term exchanges, working memory, long-term facts, and typed retrieval snippets
- send-message path now loads typed retrieval via `TypedRetrievalService` and injects it through context assembly (no ad-hoc prompt builder)
- deterministic unit coverage added for persona-driven prompt deltas and typed-retrieval prompt inclusion
- send-message flow now enriches Avatar context end-to-end from memory selection + typed retrieval with stable fallbacks when layers are absent
- turn-completed observability payload now includes non-sensitive context-selection metadata (counts/flags only; no raw prompt or sensitive content)
- runtime inspector and console now consume canonical shared `contextTrace` contracts and expose bounded trace diagnostics for operators
- stack-e2e coverage exists for the Avatar-v2-added inspector endpoint (`GET /v1/admin/sessions/{sessionId}/context`) across auth, not-found, and happy-path envelope/shape
- final hardening gates validated for deterministic and contract-safe behavior: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm --filter @gami/core test:coverage`
- environment-gated suites (`test:integration-e2e`, `test:stack-e2e`) remain part of CI/nightly execution and require reachable DB/stack runtime

---

## EPIC 2.2 — Scenario & Session Lifecycle

Status: ✅ Complete
Completed on: 2026-04-22

### Includes

- scenarios
- avatars
- sessions
- conversations
- lifecycle APIs
- explicit conversation model
- session reset
- session listing
- avatar CRUD
- scenario CRUD
- conversation close semantics
- implicit end detection
- compaction triggers

### Key Decisions

- Session ≠ Conversation
- conversations are bounded dialogue episodes
- memory compaction occurs at closure
- transcript replay avoided

---

## EPIC 2.5 — Admin CRUD + Console Integration

Status: ✅ Complete
Completed on: 2026-04-28

### Includes

- admin CRUD APIs
- session admin tooling
- inline scenario/avatar editing
- operational reset tooling
- console integration
- conflict-safe deletes
- filtering and session management

---

## EPIC 2.6 — GM Debug Panel v1 + Observability APIs

Status: ✅ Complete
Completed on: 2026-04-28

### Includes

- GM event inspection
- transition history
- unlocked avatar inspection
- GM notes
- admin session inspection
- safe observability APIs
- event filtering
- operational debugging surfaces

---

## EPIC 2.7 — Runtime Inspector v2

Status: ✅ Complete
Completed on: 2026-05-07

### Includes

- unified runtime inspector
- assembled context inspection
- runtime metrics
- memory inspection
- SSE event integration
- runtime admin actions
- replay tooling
- persona inspection
- typed composition layer
- canonical shared DTO ownership

### Runtime Actions

- GM replay
- memory refresh
- memory clear

---

## EPIC 2.8 — Console Debugging Redesign

Status: ✅ Complete
Completed on: 2026-05-07

### Includes

- unified debugging shell
- memory evolution workspace
- GM causality trace
- turn profiler
- working-memory and long-term-memory timestamps in the inspector
- GM unlock diagnostics with avatar names, reasons, and rejected/applied outcomes
- turn profiler conversation alignment plus per-turn retrieval timing
- clearer context-assembly copy in the inspector
- persona-first flow
- consolidated debug navigation
- inspector cleanup
- audit remediation
- runtime visualization redesign

---

## EPIC 3.1 — Health & Dependency Monitoring

Status: ✅ Complete
Completed on: 2026-04-30

### Includes

- dependency probes
- admin health endpoint
- degraded-state reporting
- Redis/Postgres/LLM checks
- runtime dependency inspection

---

## EPIC 3.2 — Inspector Consolidation & Contract Cleanup

Status: ✅ Complete
Completed on: 2026-05-10

### Includes

- inspector contract ownership cleanup
- DTO canonicalization
- backend route consolidation
- console flow unification
- runtime-state shared contracts
- duplicate DTO removal
- inspector hardening tests
- redaction verification
- single canonical inspection flow

---

## EPIC 4.1 — Async Game Master v1

Status: ✅ Complete
Completed on: 2026-04-29

### Includes

- async GM orchestration
- avatar unlock logic
- routing decisions
- GM directives
- event-driven orchestration
- AI Guided Discovery reference scenario
- runtime GM observability

---

## EPIC 4.1c — Multi-Model Runtime Configuration

Status: ✅ Complete
Completed on: 2026-05-20

### Includes

- `ModelConfig` domain type, `ModelRole`, `ProviderName` canonical types
- `ModelResolutionService` — three-level deterministic resolution
- `model_config` single-row persistence table
- `GET /v1/admin/model-config` and `PUT /v1/admin/model-config` admin endpoints
- Per-avatar `llmOverride` in `avatar.config` JSONB
- `AvatarSummary.llmOverride` in shared DTO
- `LlmAdapterRegistry` — per-provider adapter map
- Role-based LLM adapter selection in `SendMessageUseCase`, `RunGameMasterUseCase`, memory compaction use cases
- `effectiveProvider` + `effectiveModel` in observability trace metadata
- `effectiveModels` in admin session inspect response
- Console model config editor (global default + role overrides)
- Console avatar form `llmOverride` fields
- Runtime inspector `effectiveModels` display

### Key Decisions

- Avatar overrides stored in `avatar.config.llmOverride` JSONB — no new DB column
- `model_config` uses single-row constraint (CHECK id = 1)
- Resolution falls back to env `LLM_PROVIDER` when no DB row exists
- No automatic model routing — configuration-driven only

---

## EPIC 5.2 — Context Engine v2

Status: ✅ Complete
Completed on: 2026-05-11

### Current slice completed

- context contract ownership map added
- internal context snapshot contracts centralized in `domain/context`
- API/shared context DTO ownership preserved in `packages/shared`
- explicit API boundary mapper added for session context route
- use-case output ownership moved from shared DTO typing to internal domain contract
- duplicate inline scenario-context shape removed from GM use case in favor of context-domain type
- dedicated deterministic Context Engine module introduced with explicit input/output/trace contracts
- session context assembly routed through one Context Engine pass for both Avatar and GM projections
- baseline unit coverage added for deterministic assembly behavior and contract composition
- deterministic precedence policy with enforced token-budget selection and deterministic trimming added to Context Engine
- machine-readable selection/trimming trace added for debugging of kept/trimmed segments
- deterministic conflict resolution added for long-term fact keys and retrieval chunk-id duplicates
- send-message avatar prompt assembly now routes through Context Engine output mapping
- run-game-master context input now consumes Context Engine gm projection (or preassembled context from turn path)
- avatar and gm context paths share one assembly contract while preserving async non-blocking GM execution
- admin session-context inspection now exposes bounded explainable `contextTrace` metadata (kept/trimmed/policy)
- context trace mapping is canonicalized through shared DTO ownership with explicit boundary redaction/allowlisting
- regression hardening completed for precedence, deterministic budget trimming behavior, layer exclusion deltas, projection consistency, and trace structure
- gm recent-messages path simplified to keep chronological exchanges only (working memory remains in context.memory)
- shared runtime inspector trace contracts now use bounded segment-id typing to reduce drift
- console runtime inspector now consumes canonical `contextTrace` contracts and surfaces bounded trace/context-selection diagnostics
- quality gates validated for this slice: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:coverage`

### Key Decisions

- GM never blocks avatar responses
- unlock logic fully GM-owned
- orchestration separated from interaction

---

## EPIC 4.2 — Memory Layer v1

Status: ✅ Complete
Completed on: 2026-05-05

### Includes

- user memory facts
- fact extraction
- long-term user memory
- memory injection into prompts
- memory admin APIs

---

## EPIC 4.2b — Memory System v2

Status: ✅ Complete
Completed on: 2026-05-06

### Includes

- layered memory contracts
- working memory storage
- async maintenance pipeline
- working-memory repositories
- avatar memory context assembly
- memory inspection APIs
- deterministic layered memory injection

---

## EPIC 4.2c — Episodic + Hydrated Memory System

Status: ✅ Complete
Completed on: 2026-05-08

### Includes

- episodic persistence
- hydration pipeline
- deterministic memory selection
- GM memory integration
- memory observability
- conversation working memory
- hydration diagnostics
- memory selection policies
- canonical memory ownership cleanup
- hardening and coverage closure

### Key Decisions

- hydration replaces transcript replay
- episodic memories scoped by user + avatar + scenario
- deterministic memory selection
- asynchronous maintenance boundaries

---

## EPIC 4.3 — Performance Baseline

Status: ✅ Complete
Completed on: 2026-04-30

### Includes

- turn metrics
- GM metrics
- latency tracking
- token tracking
- metrics aggregation
- admin metrics endpoint
- event-log timing persistence

---

## EPIC 4.4 — Multi-Avatar Navigation v1

Status: ✅ Complete
Completed on: 2026-04-27

### Includes

- unlockable avatars
- avatar switching
- session-scoped unlock progression
- avatar awareness
- AI Guided Discovery scenario
- availability APIs

---

## EPIC 4.5 — Runtime State & SSE Events

Status: ✅ Complete
Completed on: 2026-05-05

### Includes

- runtime state endpoint
- SSE event streaming
- async runtime events
- processing state tracking
- runtime pub/sub layer

---

## EPIC 5.5 — User Persona System

Status: ✅ Complete
Completed on: 2026-05-02

### Includes

- user personas
- persona persistence
- avatar persona injection
- GM persona injection
- persona APIs

---

## EPIC 5.1 — Knowledge Substrate, Ingestion, Retrieval, And API Surfaces

Status: ✅ Complete
Completed on: 2026-05-11

### Includes delivered in current slices

- canonical knowledge/retrieval contract ownership (`domain` + `shared DTOs`)
- persistence schema and repositories for knowledge sources, chunks, and ingestion jobs
- typed ingestion lifecycle (`queued -> running -> completed|failed`) with retry entrypoints
- type-specific retrieval (`memory|world|media`) with deterministic merge and trace metadata
- API endpoints:
  - `POST /v1/knowledge-sources`
  - `GET /v1/scenarios/{scenarioId}/knowledge-sources`
  - `POST /v1/knowledge-sources/{sourceId}/ingest`
  - `GET /v1/knowledge-sources/{sourceId}/ingestion-jobs`
  - `GET /v1/ingestion-jobs/{ingestionJobId}`
  - `POST /v1/admin/knowledge/retrieval`
- stack-e2e baseline coverage for auth, validation, and not-found paths on knowledge routes
- Session Admin console workflow for knowledge source registration, ingestion trigger/status inspection, and retrieval diagnostics
- retrieval debug payload hardening (bounded content) plus retrieval lifecycle observability events

---

## EPIC 5.1b — Avatar-Scoped Knowledge Visibility

Status: ✅ Complete
Completed on: 2026-05-21

### Current slice completed (contract cleanup)

- touched contract inventory completed across avatar/scenario/session-context, knowledge source/chunk, retrieval, and inspector/admin surfaces
- canonical ownership reaffirmed:
  - domain-internal contracts in `apps/core/src/domain/*`
  - API/shared DTO contracts in `packages/shared/src/*`
- duplicate route/use-case-local request/response fragments reduced before visibility-field work:
  - `CreateKnowledgeSourceInput` now reuses `CreateKnowledgeSourceRequest` from shared contracts
  - `GetTypedRetrievalInput` now reuses `QueryKnowledgeRetrievalRequest` and output now reuses `TypedKnowledgeRetrievalDto`
  - `RegisterKnowledgeSourceOutput` now reuses canonical domain `KnowledgeSource` and `IngestionJob` entities instead of inline copies
- compact ownership notes added in touched use-case contract files to make boundary ownership explicit
- strict typecheck validated (`pnpm -w typecheck`) with no functional behavior changes introduced

### Current slice completed (visibility metadata model + persistence)

- lightweight avatar visibility metadata added to knowledge source/chunk contracts:
  - canonical field: `visibleToAvatarIds?: string[]`
  - deterministic default/backward-compatible interpretation: undefined or empty => visible to all avatars
- persistence schema updated for existing and new environments:
  - `knowledge_sources.visible_to_avatar_ids TEXT[]` (nullable)
  - `knowledge_chunks.visible_to_avatar_ids TEXT[]` (nullable)
  - `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` alignment for existing local volumes
- domain and repository contracts extended end-to-end to read/write visibility metadata without retrieval filtering behavior changes
- shared/API contracts extended for create/read flows and retrieval debug payloads where visibility is exposed
- ingestion now propagates source-level visibility metadata to created chunks by default inheritance
- repository and service coverage added for default visibility and explicit visibility round-trip behavior (in-memory + postgres)

### Current slice completed (avatar-scoped retrieval filtering in context assembly)

- typed retrieval now applies deterministic avatar visibility filtering via active avatar identity before context assembly
- send-message and session-context flows now pass active avatar identity into typed retrieval so avatar switching deterministically updates retrieval scope
- non-visible knowledge is excluded before avatar prompt/context composition and does not reach avatar-facing context payloads
- bounded visibility explainability metadata added:
  - typed retrieval trace per type (`consideredChunkCount`, `excludedChunkCount`)
  - context trace selected-input visibility exclusion counters
  - turn-completed context selection observability visibility counters
- deterministic unit coverage added for avatar-scoped filtering behavior and avatar-switch scope transitions

### Current slice completed (GM omniscience + visibility diagnostics)

- context assembly now uses asymmetric retrieval channels:
  - avatar channel: visibility-filtered by active avatar
  - GM channel: unrestricted visibility for orchestration omniscience
- runtime/admin visibility diagnostics expanded with bounded counters:
  - avatar exclusion counts per retrieval type
  - GM retrieval counts per retrieval type
  - explicit `gmUnrestricted` marker
- turn-completed observability context-selection metadata aligned with visibility decisions (counts/flags only, no raw hidden content)
- tests added/updated to verify avatar filtering enforcement and GM omniscient retrieval asymmetry

### Current slice completed (console visibility management)

- Session Admin knowledge operations now support visibility metadata input for source registration using canonical shared DTOs
- console source/retrieval summaries now surface visibility state with backward-compatible default handling (`all avatars` when unset)
- retrieval diagnostics probe in console now supports optional active avatar scope input for operator validation workflows
- runtime inspector context tab now renders bounded visibility diagnostics (`excludedCounts`, `gmRetrievalCounts`, `gmUnrestricted`) and item visibility tags
- console tests updated for visibility form validation, API payload mapping, and diagnostics rendering

### Current slice completed (hardening, coverage closure, and doc sync)

- fixed admin typed retrieval scope wiring so `activeAvatarId` from canonical shared request contracts is forwarded end-to-end into typed retrieval filtering
- added deterministic regression tests for admin retrieval avatar-scope behavior:
  - use-case coverage proving `activeAvatarId` filtering is enforced
  - stack-e2e knowledge route coverage proving avatar-scope retrieval behavior via HTTP path
- revalidated visibility safety invariants in touched suites:
  - avatar privacy filtering remains deterministic
  - GM visibility remains unrestricted with bounded diagnostics only
- confirmed no new EPIC 5.1b endpoint surfaces were introduced beyond existing knowledge/admin routes; mandatory auth/validation/not-found stack-e2e baselines remain on those routes

---

## EPIC 7.1 — Public User Web App v1

Status: ✅ Complete
Completed on: 2026-06-01

### Current slice completed (contract cleanup prerequisite)

- canonical web-facing client contract helpers now live in `packages/shared/src/web-contract-types.ts`
- duplicated console-local request/response helper DTOs for scenarios, avatars, sessions, conversations, messages, and user persona flows were consolidated to shared exports
- console API client modules now import those shared helpers directly, creating a single canonical path for future `apps/web` consumers
- nullability alignment confirmed:
  - `SessionSummary.activeAvatarId` remains optional (`undefined` when absent)
  - explicit `null` remains limited to contracts that intentionally use it (`currentAvatarId`, persona payloads, lifecycle transitions, and related admin/runtime payloads)

### Current slice completed (web shell + local identity baseline)

- new `apps/web` workspace package scaffolded with monorepo-standard scripts (`dev`, `build`, `typecheck`, `lint`, `test`, `preview`) and Vite + React + strict TypeScript setup
- onboarding flow implemented for browser-owned identity creation:
  - internal auto-generated `userId` (`user_xxxxxxxx`) kept off the public UI
  - optional canonical `UserPersona` fields (`name`, `roleInWorld`, `avatarRelationships`, `dialogGuidance`)
- identity state model is explicit and deterministic:
  - `onboarding` mode (identity creation)
  - `active` mode (identity loaded and ready)
- local persistence implemented with stable versioned contract ownership in shared types:
  - `LocalWebIdentity` now owned by `packages/shared/src/web-contract-types.ts`
  - local storage key fixed to `gami.web.identity.v1`
- restore-on-load and reset flows implemented:
  - identity is rehydrated from local storage on startup
  - reset clears persisted identity and returns app to onboarding mode
- onboarding now persists persona to backend canonical user contract before activation:
  - `PUT /v1/users/{userId}/persona` is called from `apps/web` using shared contract types
  - onboarding remains blocked with user-visible error if persona sync fails
- deterministic unit coverage added for identity normalization, storage round-trip, invalid payload handling, and reset behavior

### Current slice completed (scenario and avatar discovery)

- public web app now loads active scenarios after local identity is established and keeps onboarding separate from runtime discovery surfaces
- scenario selection state is explicit and session-scoped:
  - selected scenario ID is tracked in web UI state
  - session is created or reused per `(userId, scenarioId)` via canonical shared session contracts
- avatar discovery is now availability-driven and dynamic:
  - avatar list is sourced from `GET /v1/sessions/{sessionId}/available-avatars`
  - hidden/locked avatars are excluded by contract (no fallback to raw scenario avatar inventory)
  - runtime-event subscription (`GET /v1/sessions/{sessionId}/events/stream`) drives live availability refreshes when avatars are unlocked and reconnects automatically after disconnects
- public web app contract usage remains canonical with no local DTO duplication:
  - scenario/session/avatar request/response shapes are consumed from `@gami/shared`
  - web-specific local API helpers are transport-only and isolated under `apps/web/src/api`

### Current slice completed (single chat runtime + live updates)

- public web app now exposes one active thread at a time for runtime play:
  - no conversation history browser is rendered
  - old conversations are not discoverable from the public surface
- active chat flow wired to existing backend contracts/endpoints:
  - `POST /v1/sessions/{sessionId}/conversations` to open current thread for selected avatar
  - `POST /v1/conversations/{conversationId}/messages` for user turns
- send-message UX now models runtime states explicitly:
  - optimistic user message is inserted immediately
  - processing indicator is shown while avatar response is in flight
  - avatar response is appended to the same active thread on completion
  - failed sends remain visible with explicit failed state
- avatar availability live updates remain active during chat sessions via the session runtime event stream, so newly unlocked avatars can appear without page reload
- runtime continuity now persists across refresh for the same local identity:
  - selected scenario, active avatar, session id, and current conversation id are stored in local browser state
  - page reload rehydrates and restores the active thread from canonical conversation history
- explicit conversation-ending control added to public web chat:
  - `POST /v1/sessions/{sessionId}/conversations/{conversationId}/end` is called from the web UI
  - ending a conversation clears active avatar/thread selection and returns chat to idle state
- no new backend endpoints were added; implementation reuses canonical shared conversation/session/message contracts from `@gami/shared`

### Current slice completed (tests, hardening, and docs sync)

- public web app deterministic test coverage expanded beyond identity helpers:
  - scenario visibility filtering (`active` scenarios only)
  - avatar visibility filtering by selected scenario
  - scenario-selection reset state hardening (clears stale avatar/session discovery state)
  - chat runtime state transitions:
    - current-thread reset on new avatar selection (no old-chat carryover)
    - optimistic pending user message insertion
    - processing-state transition during send
    - success reconciliation and avatar append
    - failed-send state marking
- web runtime helpers now expose explicit pure-state transformers used by tests to validate consumer-visible behavior without brittle implementation-mirroring
- behavior-level web tests now validate user-observable flows end-to-end:
  - onboarding success path activates runtime shell only after persona sync and persists identity
  - onboarding failure path keeps user in onboarding with explicit error messaging
  - discovery hook validates live avatar updates from runtime unlock events, stream reconnect resyncs, and the absence of interval polling
  - active-chat runtime validates optimistic send pending state, success/failure reconciliation, and end-conversation reset transitions
- documentation synced for EPIC 7.1 closure expectations:
  - `docs/TEST_COVERAGE_PLAN.md` now includes a dedicated `apps/web` coverage checklist

### Current slice completed (deployment and final hardening)

- production-readiness checks validated for `apps/web`:
  - monorepo build compatibility confirmed with package-scoped build/typecheck/test gates
  - runtime contract remains stable across rebuild and refresh boundaries (identity persisted, chat thread ephemeral by design)
- Coolify deployment assumptions clarified to remove ambiguity:
  - `web` now documents both required runtime env vars (`VITE_API_URL`, `VITE_API_KEY`)
  - explicit `apps/web` build command and publish directory documented for static deployment
  - refresh/routing behavior documented for the single-page public runtime surface
- `apps/console` remains explicitly excluded from Coolify production routing and deployment

---

## EPIC 6.1 — Scenario Builder v1

Status: 🔄 In Progress
Started on: 2026-07-05

### Current slice completed (contract cleanup prerequisite)

- audited scenario/avatar/knowledge/model-config contracts touched by the upcoming admin app across `apps/core`, `apps/console`, `apps/web`, and `packages/shared`
- removed route-local duplicate DTOs in `apps/core/src/api/routes/scenarios.ts` and `avatars.ts` (`CreateScenarioRequest/Response`, `UpdateScenarioRequest/Response`, `CreateAvatarRequest/Response`, `UpdateAvatarRequest/Response`); routes now import the canonical shapes from `@gami/shared` instead of re-declaring them
- added the missing canonical `GetScenarioResponse` to `packages/shared/src/web-contract-types.ts` (previously only declared locally in the core route)
- fixed a real contract/behavior drift: canonical `UpdateScenarioRequest` was missing `config`, even though the route schema and use case already accepted it — normalized to match `CreateScenarioRequest`
- simplified `CreateAvatarForScenarioRequest` to reuse `CreateAvatarRequest` directly, then removed it once console switched to consuming `CreateAvatarRequest` directly (it added no value beyond an unused `scenarioId` wrapper field)
- removed the dead `UpdateAvatarRequestBody` alias from shared exports
- added a canonical `UpdateModelConfigRequest` to `packages/shared/src/runtime-inspector-types.ts`; `apps/core`'s `update-model-config` use case and `apps/console`'s model-config client/`ModelConfigPanel` now reuse it instead of each declaring their own copy of the same shape
- documented known contract gaps intentionally **not** implemented in this slice (deferred to their owning prompts, not in scope for cleanup-only work):
  - explicit GM-only world knowledge visibility (currently only representable as "all" vs "subset" via `visibleToAvatarIds`) — owned by `03-knowledge-sources-and-visibility.md`
  - scenario-level default runtime model assignment (no field exists yet on `Scenario`/`ScenarioSummary`) — owned by `04-runtime-model-selection.md`
- verified no regressions: `packages/shared`, `apps/core`, `apps/console`, `apps/web` all typecheck/lint clean; full test suites pass (core 659 tests, console 48 tests, web 28 tests)

### Current slice completed (admin app foundation and vertical skeleton)

- new `apps/admin` workspace scaffolded as a first-class app (not a mode inside `apps/web` or `apps/console`), with monorepo-standard scripts (`dev`, `build`, `typecheck`, `lint`, `test`, `preview`) and Vite + React + strict TypeScript setup, matching `apps/web`/`apps/console` conventions
- environment-driven Core connection (`VITE_API_URL`, `VITE_API_KEY`) reused via an app-local `env.ts` + `adminRequest` transport client, following the same `ApiResponse` envelope handling already used by `apps/web` and `apps/console`
- minimal app shell (`AppShell`) with a left-hand navigation listing scenario-builder modules (`Scenarios` active; `Knowledge Sources` and `Model Config` shown as "coming soon" placeholders for `03-knowledge-sources-and-visibility.md` and `04-runtime-model-selection.md`)
- first vertical skeleton flow implemented end-to-end against existing canonical endpoints (no new backend endpoints introduced):
  - scenario list (`GET /v1/scenarios`) with loading/error/empty states
  - scenario detail placeholder (`GET /v1/scenarios/{scenarioId}`) showing name, status, world context, and objectives, with a note that avatar/knowledge/model-config editing arrive in later slices
  - simple in-app view-state routing (list ↔ detail) consistent with the state-based navigation pattern already used by `apps/console` (no router dependency added, per KISS/YAGNI)
- no shared DTO duplication introduced: `apps/admin` consumes `ScenarioSummary`, `ListScenariosResponse`, and `GetScenarioResponse` directly from `@gami/shared`
- no new admin endpoints were introduced by this slice, so no additional stack-e2e coverage was required beyond what already exists for `GET /v1/scenarios` and `GET /v1/scenarios/{scenarioId}`
- deterministic behavior-level test coverage added for the new app (loading/success/error states for both list and detail, row-click navigation, back navigation)
- verified end-to-end manually against the running local Core API (live scenario data loaded and rendered through list → detail → back)
- quality gates validated across the full monorepo after adding the new workspace: `pnpm lint`, `pnpm typecheck`, `pnpm test` (core 659 tests, console 48 tests, web 28 tests, admin 10 tests)

---

# 3. Current Public API Surface

## Sessions & Conversations

- `POST /v1/sessions`
- `GET /v1/sessions`
- `POST /v1/sessions/{sessionId}/conversations`
- `POST /v1/conversations/{conversationId}/messages`
- `GET /v1/conversations/{conversationId}/history`
- `POST /v1/sessions/{sessionId}/conversations/{conversationId}/end`
- `POST /v1/sessions/{sessionId}/reset`

---

## Runtime

- `GET /v1/sessions/{sessionId}/runtime-state`
- `GET /v1/sessions/{sessionId}/events/stream`

---

## Inspector APIs

- `GET /v1/admin/sessions/{sessionId}/inspect`
- `GET /v1/admin/sessions/{sessionId}/events`
- `GET /v1/admin/sessions/{sessionId}/context`
- `GET /v1/admin/sessions/{sessionId}/memory`
- `GET /v1/admin/sessions/{sessionId}/memory-layers`
- `GET /v1/admin/sessions/{sessionId}/metrics`

---

## Runtime Actions

- `POST /v1/admin/sessions/{sessionId}/gm/replay`
- `POST /v1/admin/sessions/{sessionId}/memory/refresh`
- `POST /v1/admin/sessions/{sessionId}/memory/clear`

---

## Personas

- `GET /v1/users/{userId}/persona`
- `PUT /v1/users/{userId}/persona`

---

## Health

- `GET /health`
- `GET /v1/admin/health`

---

## Knowledge

- `POST /v1/knowledge-sources`
- `GET /v1/scenarios/{scenarioId}/knowledge-sources`
- `POST /v1/knowledge-sources/{sourceId}/ingest`
- `GET /v1/knowledge-sources/{sourceId}/ingestion-jobs`
- `GET /v1/ingestion-jobs/{ingestionJobId}`
- `POST /v1/admin/knowledge/retrieval`

---

# 4. Timeline

| Date       | Milestone                                             |
| ---------- | ----------------------------------------------------- |
| 2026-04-22 | EPIC 1.1 — Core Platform Bootstrap                    |
| 2026-04-22 | EPIC 1.2 — First LLM Loop + Observability             |
| 2026-04-22 | EPIC 2.1 — Avatar Agent v1                            |
| 2026-04-22 | EPIC 2.2 — Scenario & Session Lifecycle               |
| 2026-04-27 | EPIC 4.4 — Multi-Avatar Navigation v1                 |
| 2026-04-28 | EPIC 2.5 — Admin CRUD + Console Integration           |
| 2026-04-28 | EPIC 2.6 — GM Debug Panel v1                          |
| 2026-04-29 | EPIC 4.1 — Async Game Master v1                       |
| 2026-04-30 | EPIC 3.1 — Health & Dependency Monitoring             |
| 2026-04-30 | EPIC 4.3 — Performance Baseline                       |
| 2026-05-02 | EPIC 5.5 — User Persona System                        |
| 2026-05-05 | EPIC 4.2 — Memory Layer v1                            |
| 2026-05-05 | EPIC 4.5 — Runtime State & SSE Events                 |
| 2026-05-06 | EPIC 4.2b — Memory System v2                          |
| 2026-05-07 | EPIC 2.7 — Runtime Inspector v2                       |
| 2026-05-07 | EPIC 2.8 — Console Debugging Redesign                 |
| 2026-05-08 | EPIC 4.2c — Episodic + Hydrated Memory System         |
| 2026-05-10 | EPIC 3.2 — Inspector Consolidation & Contract Cleanup |
| 2026-05-11 | EPIC 5.1 — Knowledge Substrate, Ingestion, Retrieval  |
| 2026-05-11 | EPIC 5.2 — Context Engine v2                          |
| 2026-05-20 | EPIC 4.1c — Multi-Model Runtime Configuration         |
| 2026-06-01 | EPIC 7.1 — Public User Web App v1                     |
| 2026-07-05 | EPIC 6.1 — Scenario Builder v1 (contract cleanup)     |
| 2026-07-06 | EPIC 6.1 — Scenario Builder v1 (admin app foundation) |

---

# 5. Current Focus

Current implementation focus:

- context intelligence
- GM context assembly evolution
- media-aware retrieval
- advanced orchestration intelligence
- retrieval observability
- public web app operational hardening
- Scenario Builder v1 admin app (EPIC 6.1): contract cleanup and admin app foundation/vertical skeleton complete; scenario/avatar editors, knowledge sources, and runtime model selection workflows next

---

# 6. Architectural Direction

The project is evolving toward:

- persistent AI-guided conversational worlds
- multi-avatar orchestrated interactions
- layered long-term memory
- inspectable AI runtime systems
- deterministic orchestration boundaries
- operationally debuggable AI systems
- modular context intelligence

The long-term goal is a production-grade conversational runtime platform where:

- avatars remain responsive and character-consistent
- Game Masters orchestrate experiences asynchronously
- memory evolves continuously over time
- operators can fully inspect and debug runtime behavior
- orchestration remains deterministic and observable
