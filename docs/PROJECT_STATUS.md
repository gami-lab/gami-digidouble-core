# PROJECT_STATUS.md

# Project Status

This document tracks the implementation status of Gami DigiDouble Core.

Last updated: July 19, 2026
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

Status: ✅ Complete
Started on: 2026-07-05
Completed on: 2026-07-18

### Current slice completed (contract cleanup prerequisite)

- audited scenario/avatar/knowledge/model-config contracts touched by the upcoming admin app across `apps/core`, `apps/console`, `apps/web`, and `packages/shared`
- removed route-local duplicate DTOs in `apps/core/src/api/routes/scenarios.ts` and `avatars.ts` (`CreateScenarioRequest/Response`, `UpdateScenarioRequest/Response`, `CreateAvatarRequest/Response`, `UpdateAvatarRequest/Response`); routes now import the canonical shapes from `@gami/shared` instead of re-declaring them
- added the missing canonical `GetScenarioResponse` to `packages/shared/src/web-contract-types.ts` (previously only declared locally in the core route)
- fixed a real contract/behavior drift: canonical `UpdateScenarioRequest` was missing `config`, even though the route schema and use case already accepted it — normalized to match `CreateScenarioRequest`
- simplified `CreateAvatarForScenarioRequest` to reuse `CreateAvatarRequest` directly, then removed it once console switched to consuming `CreateAvatarRequest` directly (it added no value beyond an unused `scenarioId` wrapper field)
- removed the dead `UpdateAvatarRequestBody` alias from shared exports
- added a canonical `UpdateModelConfigRequest` to `packages/shared/src/runtime-inspector-types.ts`; `apps/core`'s `update-model-config` use case and `apps/console`'s model-config client/`ModelConfigPanel` now reuse it instead of each declaring their own copy of the same shape
- documented known contract gaps intentionally **not** implemented in that cleanup-only slice (deferred at the time to their owning prompts):
  - explicit GM-only world knowledge visibility (deferred in that prerequisite slice, later delivered by `03-knowledge-sources-and-visibility.md`)
- verified no regressions: `packages/shared`, `apps/core`, `apps/console`, `apps/web` all typecheck/lint clean; full test suites pass (core 659 tests, console 48 tests, web 28 tests)

### Current slice completed (scenario and avatar editors — objectives, world context, persona, visibility)

- admin scenario editor: full create + update forms with name, status, objectives list editor, and world context textarea; routes via `POST /v1/scenarios` and `PATCH /v1/scenarios/{scenarioId}` using canonical `CreateScenarioRequest` / `UpdateScenarioRequest` from `@gami/shared`
- admin avatar editor: avatar list per scenario with create + update forms covering name, personaPrompt, and status; routes via `POST /v1/scenarios/{scenarioId}/avatars` and `PATCH /v1/avatars/{avatarId}` using canonical `CreateAvatarRequest` / `UpdateAvatarRequest` from `@gami/shared`
- avatar initial visibility configuration: "Initially visible" toggle per avatar in the scenario detail view; reads from `scenario.avatarAvailability.initialAvatarIds` and persists changes via `PATCH /v1/scenarios/{scenarioId}` — single source of truth, no duplicate field on Avatar; consistent with the runtime session-start mechanism documented in `GAME_MASTER_CONTRACT.md`
- `ScenarioListPage` extended with "Create scenario" button and `onCreateScenario` callback
- `ScenarioDetailPage` redesigned as a full editor: scenario view/edit modes, avatar list with add/edit/delete actions, visibility toggle; sub-mode state machine (`view | editing-scenario | creating-avatar | editing-avatar`) keeps concerns separated without a router
- new `ScenarioCreatePage` component with form state, objective list editor, and error handling
- avatar list and visibility toggle APIs wired through new admin API functions (`createScenario`, `updateScenario`, `listScenarioAvatars`, `createAvatar`, `updateAvatar`, `deleteAvatar`) all consuming `@gami/shared` response types directly
- no new backend endpoints introduced: all editor flows use existing canonical Core API endpoints
- no new shared DTO types required: all editor state and transport mapping are explicitly typed against existing `@gami/shared` shapes
- behavior-level test coverage added for all new components (21 admin tests total): create form submission, error states, objective list editing, visibility checkbox state and toggle, edit/cancel flows
- quality gates validated: `pnpm typecheck` clean, core 659 tests pass, admin 21 tests pass

### Current slice completed (knowledge sources + visibility policy)

- added `KnowledgeVisibilityPolicy = 'all' | 'avatars' | 'none'` to `packages/shared/src/knowledge-contract-types.ts`; `'none'` is the explicit GM-only sentinel (previously there was no way to represent "no avatars")
- added `visibilityPolicy` field to `KnowledgeSourceDto`, `CreateKnowledgeSourceRequest`, and `UpdateKnowledgeSourceRequest` in `@gami/shared`
- added `UploadKnowledgeSourceRequest` and `UploadKnowledgeSourceResponse` to `@gami/shared` for base64-encoded PDF/TXT file ingestion without `@fastify/multipart` dependency
- updated domain `KnowledgeSource` entity and `IKnowledgeSourceRepository` with `visibilityPolicy`
- updated in-memory and Postgres knowledge source repositories to persist and return `visibility_policy`; rerunnable startup schema alignment now applies EPIC-added columns to already-initialized databases before repository construction
- updated typed retrieval and knowledge-source use cases to respect canonical `visibilityPolicy` semantics (`'all' | 'avatars' | 'none'`) and return `visibilityPolicy`
- added `POST /v1/knowledge-sources/upload` endpoint: validates extension (`.pdf`, `.txt`, `.text`), parses uploaded bytes through the infrastructure knowledge parser, stores extracted text as `metadata.inlineText`, creates source via existing use case; registered before the `:sourceId` route to avoid path conflicts
- admin API client `apps/admin/src/api/knowledge.ts`: wraps all knowledge source CRUD + upload + ingest-trigger endpoints using `adminRequest` with canonical `@gami/shared` types
- admin UI extended: `ScenarioDetailPage` loads and displays knowledge sources; "Add knowledge" button opens `KnowledgeSourceCreateForm` (text paste or file upload, type + visibility selectors); list table shows name/type/visibility/status with Edit / Ingest / Delete actions; `KnowledgeSourceEditForm` supports rename/visibility changes plus inline-text replacement or PDF/TXT replacement through the canonical update contract
- test coverage: GM-only retrieval unit test in `typed-retrieval.service.test.ts`; route integration tests for upload, replacement, and visibility policy in `knowledge-sources-management.test.ts`; stack-e2e upload 401 + 400 + skipped happy-path in `knowledge.stack-e2e.test.ts`; admin unit tests prove create plus edit submissions for text, file, and visibility flows
- quality gates validated: `pnpm typecheck` clean across all packages; core 668 tests pass; admin 23 tests pass

### Current slice completed (runtime model selection)

- added canonical shared model-selection ownership in `packages/shared/src/model-catalog.ts` for provider names, allowed preset catalog, scenario model-selection DTOs, and validation helpers; `apps/admin`, `apps/console`, and `apps/core` now consume the same source of truth
- added `ScenarioSummary.modelSelection`, `CreateScenarioRequest.modelSelection`, and `UpdateScenarioRequest.modelSelection` to the canonical shared contracts; persisted as `scenario.config.modelSelection` while exposed as a first-class typed field in domain/API DTOs
- admin scenario editor now supports scenario default model profile and Game Master override; admin avatar editor supports per-avatar `llmOverride`; all writes go through the canonical shared contracts only
- core route validation now enforces catalog-backed model assignments:
  - scenario `modelSelection.defaultProfile` and `modelSelection.gameMasterOverride` must use allowed `openai | anthropic | mistral | xai` provider/model pairs
  - avatar `llmOverride` requires both `provider` and `model` when set; `llmOverride: null` clears the override
- deterministic runtime precedence now implemented and unit-tested:
  - avatar runtime: `avatar.llmOverride` -> `scenario.modelSelection.defaultProfile` -> global avatar role override -> global default
  - Game Master runtime: `scenario.modelSelection.gameMasterOverride` -> `scenario.modelSelection.defaultProfile` -> global Game Master role override -> global default
  - memory runtime remains global-only: memory role override -> global default
- legacy compatibility preserved: scenarios without `modelSelection` continue to resolve through the pre-existing global model config fallback path
- runtime inspection now reports effective avatar/Game Master models with scenario-scoped selection applied
- test coverage added/updated for model resolution, scenario create/update use cases, scenario and avatar routes, scenario repository behavior, admin create/detail flows, and stack-e2e route files for the extended existing endpoints

### Current slice completed (final hardening: seed parity, tests, doc sync)

- added the deferred happy-path stack-e2e test for `POST /v1/knowledge-sources/upload` (upload → ingest → retrieve), replacing the `TODO(EPIC-6.1)` skipped placeholder; full `apps/core` stack-e2e suite (159 tests) validated green against a real Docker stack (`docker-compose.e2e.yml`)
- closed a real admin-app test gap: `apps/admin/src/api/client.ts`, `api/scenarios.ts`, and `api/knowledge.ts` were fully mocked away in every existing page-level test, so their actual request/response mapping was never executed; added direct unit tests for all three plus `api/error.ts` and `scenarios/model-selection-form.ts` (60 admin tests total, up from 25)
- removed a residual contract duplication: `apps/admin` re-declared the `'draft' | 'active' | 'archived'` status literal locally in 5 files (12 occurrences) instead of importing canonical `ScenarioStatus`/`AvatarStatus` from `@gami/shared`; `ScenarioKnowledgeSourceForms.tsx` also re-declared `KnowledgeVisibilityPolicy` as a local literal union — all now alias/import the canonical shared types
- seed-parity verification completed (checklist in `docs/TEST_COVERAGE_PLAN.md`): the murder-party seed script is itself API-first and uses the same canonical endpoints as the admin app, so parity holds by construction for scenario/avatar/knowledge-text fields; one real gap was found and fixed — the seed script and the console runtime inspector both represented GM-only knowledge visibility with a legacy sentinel (`visibleToAvatarIds: ['__GM_ONLY__']`) predating the canonical `visibilityPolicy: 'none'` field from the knowledge-visibility slice, so an admin-created GM-only source would have displayed incorrectly in the console inspector; fixed in both the seed script and `runtime-inspector-tab-content.tsx` (with backward-compatible fallback to the legacy sentinel for previously-seeded data)
- fixed two stale stack-e2e fixtures discovered while validating against a real stack: `avatars.stack-e2e.test.ts` referenced a decommissioned model id (`claude-3-7-sonnet`) no longer in the shared model catalog, and `sessions-admin.stack-e2e.test.ts`'s unlock-policy fixture still nested `avatarAvailability` inside `config` from before it was promoted to a root-level scenario field — both fixed to match current canonical contracts
- confirmed no unresolved contract duplication remains across scenario/avatar/knowledge/model-config contracts touched by EPIC 6.1
- quality gates validated for all touched workspaces: `pnpm typecheck`, `pnpm lint`, `pnpm test` (core 678, admin 60, console 48, web 28, all passing) plus a full `pnpm --filter @gami/core test:stack-e2e` run against a real Docker stack (159/159 passing)
- discovered and flagged (as a separate follow-up, out of this slice's scope) an operational risk: `infra/postgres/init.sql` only runs on a fresh Postgres data volume, so `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` migrations added after a volume already exists (e.g. `visibility_policy`) never apply to already-provisioned environments; the generic 500 error handler in `apps/core/src/api/server.ts` also does not log the underlying error, which made this hard to diagnose

### Remediation follow-up (2026-07-12)

- fixed the admin pasted-text knowledge flow: inline authoring now generates a non-empty synthetic `uriOrPath` and successfully creates knowledge sources through the canonical `POST /v1/knowledge-sources` contract
- completed admin knowledge visibility authoring: create/edit flows now support `visibilityPolicy: 'avatars'` with explicit avatar subset selection, and the detail table renders human-readable visibility labels
- centralized knowledge visibility normalization in core so `visibilityPolicy` and `visibleToAvatarIds` behave as one invariant across create, update, retrieval, and repository reads:
  - `visibleToAvatarIds` without a policy normalizes to `visibilityPolicy: 'avatars'`
  - `'all'` / `'none'` clear stale avatar IDs
  - `'avatars'` without IDs is rejected
- strengthened behavior-first coverage for the remediated slice:
  - admin page tests now prove pasted-text create, file-upload create, and knowledge visibility edit submissions
  - core use-case, route, retrieval, and repository tests now cover visibility normalization and failure paths
  - renamed `admin-model-config.stack-e2e.test.ts` to `admin-model-config.test.ts` so test naming matches the actual Fastify `inject()` tier
- clarified EPIC 6.1 seed-parity scope in docs: scenario-specific orchestration config (`scenario.config`, e.g. progression/solution fields) remains intentionally seed/API-owned and is not part of the admin surface

### Audit remediation (2026-07-18)

- completed the missing admin knowledge-update workflows:
  - inline knowledge sources can now replace pasted text content through `PATCH /v1/knowledge-sources/{sourceId}` by sending canonical `metadata.inlineText`
  - file-backed PDF/TXT sources can now replace their content through the same patch endpoint using `content` + `filename`
- moved uploaded-content parsing behind the infrastructure knowledge boundary so the route no longer imports `pdf-parse` directly
- added rerunnable Postgres startup schema alignment before repository wiring so EPIC-added columns are applied to already-initialized environments, not only fresh Docker volumes
- added unexpected-error logging for scenario and global request failures while preserving the public `INTERNAL_ERROR` envelope
- expanded behavior tests to prove operator-visible edit flows and the startup schema-alignment path

---

## EPIC 8.1 — Avatar Trait Structuring

Status: ✅ Complete
Started on: 2026-07-19
Completed on: 2026-07-19

### Current slice completed (contract and source-ownership baseline)

- audited every avatar read contract that will need a `computedTraits` field in the next slice: `packages/shared/src/entity-types.ts` (`AvatarSummary`), avatar create/update responses, and the scenario avatar list response — all already funnel through the single canonical `AvatarSummary`/`web-contract-types.ts` ownership established in EPIC 6.1, so no changes were needed there
- found and consolidated three real duplicate/near-duplicate avatar read shapes that would otherwise have needed repeated manual edits when `computedTraits` is added:
  - `packages/shared/src/conversation-contract-types.ts`: `AvailableAvatarSummary` (the player-facing "available avatars" shape) was hand-typed as a near-copy of `AvatarSummary`; converted to `Pick<AvatarSummary, ...>` so it stays in sync automatically while still deliberately excluding `config`/`llmOverride` (documented in a code comment as an intentional narrowing, not an oversight)
  - `apps/core/src/seed/murder-party/setup-via-api.api.ts`: the murder-party seed script hand-declared its own local `AvatarSummary` type instead of importing the canonical one from `@gami/shared`; now imports and re-exports it directly
  - `apps/core/src/api/routes/avatars.stack-e2e.test.ts`: five separate hand-typed response fragments (`CreateAvatarResponse`, `PatchAvatarResponse`, `ListAvatarsResponse`, plus two inline `llmOverride` assertion shapes) replaced with the canonical `CreateAvatarResponse` / `UpdateAvatarResponse` / `ListScenarioAvatarsResponse` imported from `@gami/shared`
- confirmed remaining avatar-shaped local types are legitimate, not duplicates, and left unchanged: `apps/core/src/seed/ai-guided-discovery.ts`'s `AiGuidedDiscoveryAvatarDefinition` and `apps/core/src/seed/murder-party/setup-via-api.seed.ts`'s `AvatarSeed` are creation-input fixtures (not read/response shapes); `apps/core/src/application/use-cases/list-scenario-avatars/list-scenario-avatars.types.ts`'s `ListScenarioAvatarsOutput` and `apps/core/src/application/use-cases/get-available-avatars/get-available-avatars.types.ts`'s local `AvatarSummary` alias both already import `AvatarSummary`/`AvailableAvatarSummary` from `@gami/shared` rather than redeclaring fields
- confirmed canonical source-of-truth ownership for future trait-preparation inputs (no new storage introduced, per EPIC 8.1 scope for this slice):
  - avatar author input remains the existing `avatars` fields (`description`, `tone`, `personaPrompt`, `config`)
  - scenario-wide world context remains `scenarios.world_context` (`ScenarioSummary.worldContext`)
  - supporting documents remain existing `knowledge_sources` rows, specifically `knowledgeType: 'memory' | 'world'`; no separate "avatar trait source" table, upload path, or config blob was added
- verified no regressions: `packages/shared`, `apps/core`, `apps/console`, `apps/web`, `apps/admin` all typecheck clean; `apps/core` and `packages/shared` lint clean; touched test suites pass (core 92 tests across avatar/seed/get-available-avatars files, web 18 tests, console 19 tests)
- deferred to the next EPIC 8.1 slice (per this slice's explicit scope): the `computedTraits` schema itself, persistence changes, LLM preparation behavior, new endpoint behavior, and admin UI changes

### Current slice completed (fixed trait schema and avatar persistence)

- defined the canonical `AvatarComputedTraits` type once in `packages/shared/src/entity-types.ts` — the fixed seven-field schema (`identity`, `personality`, `speakingStyle`, `background`, `timeline`, `currentSituation`, `behaviouralRules`), each `string[]`; `apps/core/src/domain/avatar/avatar.types.ts` re-exports it (not re-declares it) for domain/internal use, matching the existing `AvatarLlmOverride` pattern
- `AvatarSummary.computedTraits` is now `AvatarComputedTraits | null` (required, nullable — the canonical HTTP nullability rule); domain `Avatar`/`AvatarConfig.computedTraits` is `AvatarComputedTraits | undefined` (optional, the canonical domain nullability rule)
- added a dedicated `avatars.computed_traits JSONB` (nullable) column — never inside `config` — to `infra/postgres/init.sql` (fresh stacks) and `apps/core/src/infrastructure/db/schema-alignment.ts` (already-provisioned volumes); verified live against the running dev Postgres container that the rerunnable `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` applies correctly
- added a narrow repository write path — `IAvatarRepository.saveComputedTraits(avatarId, computedTraits | null)` — implemented in both `InMemoryAvatarRepository` and `PostgresAvatarRepository`; deliberately kept out of `CreateAvatarParams`/`UpdateAvatarParams` so trait writes can never ride along with generic author-input mutation payloads (per EPIC 8.1 guidance)
- updated every place that materializes `AvatarSummary` from a domain avatar (`create-avatar`, `update-avatar`, `list-scenario-avatars` use cases) to map `computedTraits: avatar.computedTraits ?? null`; `update-avatar` previously returned the repository's domain object directly and needed a new explicit mapping function once the domain/shared shapes diverged (optional vs. required-nullable)
- author-authored avatar fields (`personaPrompt`, `description`, `tone`, `adjustments`, `config`) are untouched by this slice — proven by repository-level tests asserting they're unchanged after `saveComputedTraits` runs
- confirmed `AvailableAvatarSummary` (the player-facing "available avatars" shape, `Pick`-derived from `AvatarSummary` since the EPIC 8.1 baseline slice) correctly excludes `computedTraits` without any change needed — it already omits it by construction
- test coverage added across all three layers: `InMemoryAvatarRepository` unit tests (store/clear/not-found), `PostgresAvatarRepository` integration tests run against a real Postgres instance (store/clear/round-trip/untouched-author-fields), and use-case/route tests proving `computedTraits: null` surfaces correctly by default through `POST /v1/scenarios/{id}/avatars`, `PATCH /v1/avatars/{id}`, and `GET /v1/scenarios/{id}/avatars`
- verified no regressions: `packages/shared`, `apps/core`, `apps/console`, `apps/web`, `apps/admin` all typecheck clean; all five packages lint clean; full `apps/core` unit suite passes (733 tests, up from 729); full `apps/core` stack-e2e suite passes against the real Docker stack (96 tests, including `avatars.stack-e2e.test.ts`); Postgres integration suite for the avatar repository passes against the real database (12 tests)
- deferred to later EPIC 8.1 slices (explicitly out of scope for this slice): LLM trait preparation/generation behavior, the explicit trigger-preparation API endpoint, and admin UI trait display

### Current slice completed (scenario avatar trait preparation service)

- added `PrepareScenarioAvatarTraitsUseCase` (`apps/core/src/application/use-cases/prepare-scenario-avatar-traits/`): a scenario-scoped, explicitly-rerunnable preparation flow — not runtime prompt assembly — that computes `AvatarComputedTraits` for every avatar in a scenario and persists them via the existing narrow `saveComputedTraits` write path
- source material is gathered exclusively from canonical existing storage, no new storage introduced: avatar author fields (`personaPrompt`, `tone`, `description`, `adjustments`), `scenario.worldContext`, and `knowledge_sources` rows with `knowledgeType: 'memory' | 'world'`, reading original preserved text from `metadata.inlineText` only (never retrieval chunks); sources without preserved inline text are silently omitted from the prompt context rather than triggering a new loader path
- the LLM call reuses the existing `'avatar'` model role end-to-end (`resolveRoleLlmCall`/`logResolvedLlmCall`, the same role-resolution path `SendMessageUseCase` uses for live avatar responses), including per-avatar `avatar.llmOverride` and `scenario.modelSelection` precedence — no new model role was added, per EPIC 8.1's explicit "don't add a role without strong reason" guidance
- parsing (`prepare-scenario-avatar-traits.parsing.ts`) is lenient and schema-locked: only the seven canonical fields are ever read from the LLM's JSON (any invented field is dropped), a missing/invalid field defaults to `[]` rather than failing the whole response, and only fundamentally unparseable JSON returns `null`
- normalization (same file) trims whitespace, drops empties, deduplicates exact repeats, and caps each field at 7 items (the EPIC's "5-7 concise items" guidance), matching the `readStringArray`/cap-and-dedupe style already used by `MemoryMaintenanceService`
- failures are isolated per avatar: one avatar's unparseable LLM response or thrown error produces a `{ status: 'failed', reason }` entry without blocking preparation for the rest of the scenario's avatars (mirrors the `LlmUserFactExtractor` fail-soft philosophy, but surfaced as a structured result instead of swallowed)
- recomputation is idempotent at the contract level: rerunning `saveComputedTraits` overwrites the derived value with a fresh result; author-authored avatar fields are never touched by this flow (proven directly by a recomputation test asserting `personaPrompt`/`description` are unchanged across two preparation runs)
- output is a compact per-avatar result list (`{ scenarioId, results: [{ avatarId, status, computedTraits | reason }] }`) rather than full re-mapped `AvatarSummary` objects — the practical-default option named in the EPIC's implementation guidance
- no new HTTP routes, admin UI, or shared/domain type duplication were introduced: the use case imports the canonical `AvatarComputedTraits` from `@gami/shared` and the existing `IScenarioRepository` / `IAvatarRepository` / `IKnowledgeSourceRepository` / `ILlmAdapter` ports directly
- test coverage (25 new tests, deterministic, no real LLM calls): parsing/normalization edge cases (fenced JSON, malformed JSON, non-object JSON, invented extra fields, non-string array items, trimming, dedup, 7-item cap), prompt-building (avatar/memory/world sections, inline-text-missing sources omitted, empty world context omits the section entirely), and use-case behavior (`NOT_FOUND` for missing scenario, multi-avatar computation and persistence, scenario/type-scoped source gathering excluding other scenarios and `media`-type sources, per-avatar failure isolation, and recomputation without mutating original avatar fields)
- verified no regressions: `packages/shared`, `apps/core`, `apps/console`, `apps/web`, `apps/admin` all typecheck clean; `apps/core` lints clean; full `apps/core` unit suite passes (758 tests, up from 733)
- deferred to later EPIC 8.1/8.2 slices (explicitly out of scope for this slice): the trigger-preparation HTTP endpoint, admin UI trait display, and EPIC 8.2 runtime prompt consumption of `computedTraits`

### Current slice completed (explicit trigger-preparation HTTP endpoint)

- added `POST /v1/scenarios/{scenarioId}/prepare-avatar-traits`, wired directly into the existing `scenariosRoute` (scenario-scoped, alongside create/list avatars) so the previously-built `PrepareScenarioAvatarTraitsUseCase` is now reachable over HTTP; the route is an explicit action only — no `GET` route triggers trait computation
- added canonical shared response ownership: `PrepareAvatarTraitsResponse` / `AvatarTraitPreparationResult` now live once in `packages/shared/src/web-contract-types.ts`; `PrepareScenarioAvatarTraitsUseCase`'s output type was updated to reuse them directly (`PrepareScenarioAvatarTraitsOutput = PrepareAvatarTraitsResponse`) instead of re-declaring the same discriminated union locally
- confirmed `AvatarSummary.computedTraits` (added in the earlier fixed-schema slice) is already consistently returned by every avatar-read surface with no further changes needed: create avatar, update avatar, and list scenario avatars all already map `computedTraits: avatar.computedTraits ?? null`
- the endpoint takes no request body (explicit no-payload action); an unexpected body field returns `400 VALIDATION_ERROR` via a small API-boundary guard in the handler rather than a JSON-schema `body` clause — Fastify runs `body` schemas even against a fully omitted body, so a strict `type: 'object'` schema would incorrectly reject the common "no body sent at all" call shape
- unknown `scenarioId` returns `404 NOT_FOUND`; a scenario with zero avatars returns `200` with an empty `results` array (no special-casing needed, since the use case already iterates `listByScenarioId`)
- route wiring reuses the same LLM role-resolution dependencies as `admin-runtime-actions` (`modelConfigRepository`, `llmAdapterRegistry`, `modelConfigFallback`) so scenario/avatar-scoped model overrides apply identically to trait preparation and to live avatar responses; `apps/core/src/index.ts` already threads all of these through `ServerAdapters`, so no production wiring changes were needed beyond `buildScenariosRouteOptions` in `apps/core/src/api/server.ts`
- test coverage added:
  - route-level unit tests (`apps/core/src/api/routes/prepare-avatar-traits.test.ts`): auth (401 x2), unexpected-body-field validation (400), no-body-at-all acceptance, `404` for unknown scenario, and a deterministic success path using a fake LLM adapter returning valid trait JSON — asserting `computedTraits` is `null` before preparation and populated after, both in the prepare response and in a subsequent `GET` avatars list
  - mandatory stack-e2e file `apps/core/src/api/routes/prepare-avatar-traits.stack-e2e.test.ts`: auth, validation, and not-found always-on; an always-on null-provider block proving the full HTTP -> use case -> DB round trip (deterministic `failed`/`unparseable_output` outcome under the default null adapter, matching the existing `exchange.stack-e2e.test.ts` always-on pattern); a `describe.skipIf(isNullProvider)` real-provider block asserting genuine non-empty `computedTraits` when the stack is started with `LLM_PROVIDER` set to a real provider
- verified no regressions: `packages/shared` and `apps/core` typecheck clean; existing `scenarios.test.ts`, `scenarios-management.test.ts`, and `avatars.test.ts` route suites still pass unchanged; full new route test file passes (7 tests)
- deferred to later EPIC 8.1/8.2 slices (still out of scope for this slice): admin UI trait display/trigger button, and EPIC 8.2 runtime prompt consumption of `computedTraits`

### Current slice completed (admin trigger and read-only trait inspection) — final EPIC 8.1 slice

- added `apps/admin/src/api/scenarios.ts#prepareAvatarTraits(scenarioId)`, a thin wrapper over `POST /v1/scenarios/{scenarioId}/prepare-avatar-traits` returning the canonical `PrepareAvatarTraitsResponse` from `@gami/shared` directly — no app-local response DTO was introduced
- added a `Prepare avatar traits` button to the existing scenario detail avatars section (`apps/admin/src/scenarios/ScenarioDetailView.tsx`), reusing the same avatar-management surface administrators already use for avatar CRUD, visibility toggling, and knowledge sources, rather than a new page
- the trigger exposes four explicit UI states via a `PrepareTraitsStatus` union (idle / preparing / success / error): the button disables and reads "Preparing…" while the request is in flight, a success message reports how many avatars were prepared (and how many failed, if any), and a failure surfaces the API error text — matching the existing `IngestUiStatus` pattern already used for knowledge ingestion feedback
- on success, `apps/admin/src/scenarios/ScenarioDetailPage.tsx` re-fetches avatars via the existing `listScenarioAvatars(scenarioId)` and replaces `data.avatars` wholesale, rather than mutating the previous avatar list from the trait-preparation response — per this slice's explicit "refresh from the API" requirement
- found and fixed a real bug while verifying the trigger against a live local stack: `apps/admin/src/api/client.ts#adminRequest` always sent `Content-Type: application/json`, even for the new bodyless `prepareAvatarTraits` call; the Core route's no-body acceptance (see the earlier trigger-preparation slice) only holds when the header is absent entirely, so the request was rejected with `400 VALIDATION_ERROR: Body cannot be empty when content-type is set to 'application/json'`. Fixed by only setting `Content-Type` when a body is actually provided; every existing caller already sends a body, so this is additive and covered by a new `client.test.ts` case
- added a `Prepared` / `Not prepared` read-only signal (`avatar.computedTraits !== null`) as a new column in the avatar list table, and a read-only "Computed traits" block in `AvatarEditForm` (`apps/admin/src/scenarios/ScenarioAvatarForms.tsx`) that renders all seven canonical trait sections as plain lists when `avatar.computedTraits` is present; both reuse the existing canonical `AvatarSummary`/`AvatarComputedTraits` shared types end-to-end with no new local types
- deliberately not built (out of scope for this slice and the EPIC's "no complex trait editing surface" non-goal): editable trait fields, scoring/approval controls, manual override inputs, bulk preparation dashboards, and preparation history/job monitoring — the trigger is a single explicit re-runnable action and the trait block is strictly read-only
- test coverage added: API client wrapper call-shape test (`apps/admin/src/api/scenarios.test.ts`); trigger loading/disabled state, success refresh (asserting `listScenarioAvatars` is re-called and the new avatar list is rendered), and failure message rendering (`apps/admin/src/scenarios/ScenarioDetailPage.trait-preparation.test.tsx`, split into its own file to stay under the project's `max-lines` lint budget, following the existing `ScenarioDetailPage.knowledge-edit.test.tsx` split pattern); read-only trait-section rendering and its absence when `computedTraits` is `null` (same file)
- verified end-to-end against a live local stack (real Postgres/Redis, Core API, `LLM_PROVIDER=null`) in a browser, not just unit tests: scenario list → detail → trigger → deterministic null-provider failure path → success-with-failures summary → edit-panel read-only block correctly absent when `computedTraits` stays `null`
- verified no regressions: `apps/admin` typechecks clean; `apps/admin` lints clean; full `apps/admin` suite passes (86 tests, up from 77)
- this completes EPIC 8.1 — Avatar Trait Structuring: the fixed trait schema, LLM-based preparation service, explicit HTTP trigger endpoint, and this admin-facing trigger/inspection slice are all delivered; EPIC 8.2 runtime prompt consumption of `computedTraits` remains a separate EPIC

### Current slice completed (test-gap closure, recomputation hardening, and doc sync) — final EPIC 8.1 slice

- audited existing coverage across all tiers before writing anything new (per this slice's mandatory pre-check): found the feature-slice commits had already added substantial deterministic coverage incrementally (unit, route, Postgres integration, stack-e2e, admin), so this pass closed a small number of narrow, real gaps rather than rebuilding coverage from scratch
- closed the one genuine recomputation-fidelity gap: the existing use-case recomputation test changed the LLM's _response_ between two `execute()` calls but never changed the avatar's _authored input_; added a test proving that editing an avatar's `personaPrompt` between two preparation runs changes the actual LLM request content on the second run (not just the stored result), while confirming the updated text becomes the new `personaPrompt` of record — this directly verifies "modify avatar author text, rerun preparation, confirm derived traits update" end-to-end, not just by inference from two separate existing tests
- closed a persistence-tier gap: `saveComputedTraits` was only ever exercised once per test in both `InMemoryAvatarRepository` and `PostgresAvatarRepository` suites; added a second-call-overwrites-the-first test to each (asserting the second value wins and `personaPrompt`/`description` stay untouched), so recomputation-overwrite is now proven at the repository layer against a real Postgres instance, not only inferred from the use-case-level in-memory test
- closed a stack-e2e gap: added a rerunnability test to `prepare-avatar-traits.stack-e2e.test.ts` that calls the endpoint twice against the running Docker stack and asserts the second call still returns `200` with a fresh persisted result (deterministic `failed`/`unparseable_output` under the null provider; `prepared` under a real provider) — verified against a real stack with a real provider key configured, not just the null-provider path
- closed a fixed-schema-stability gap: the plain avatar create/list routes (`apps/core/src/api/routes/scenarios.test.ts`, `apps/core/src/api/routes/avatars.stack-e2e.test.ts`) never asserted `computedTraits: null` directly — only the trait-preparation-specific route test did. Added direct assertions to both; while doing so, found and removed a real contract duplication — `scenarios.test.ts` hand-declared a local `CreateAvatarRouteData` type instead of importing the canonical `CreateAvatarResponse` from `@gami/shared` (the exact kind of drift this schema is supposed to prevent) — replaced it with the shared type
- closed a grounding-constraint regression gap: `TRAIT_PREPARATION_SYSTEM_PROMPT` (the only place the "never invent details" / "never copy generic world facts" / "5-7 item cap" / "fixed field set" constraints are enforced, since an LLM's actual adherence can't be unit-tested) had no test guarding its content; added assertions so a future edit that silently weakens these constraints fails a test instead of going unnoticed; also added a whitespace-only-inline-text case alongside the existing missing-inline-text case in the prompt-building tests
- verified (not just re-declared) all Definition-of-Done claims already logged in the prior slices by running the actual suites rather than trusting the doc: `pnpm lint` and `pnpm typecheck` clean across all five packages; full unit suites green (core 775 tests, up from 768; admin 86; web 28; console 48); `pnpm --filter @gami/core test:integration-e2e` green against a real Postgres instance (163 tests, including the new repository-level recomputation test); `pnpm --filter @gami/core test:coverage` passes the 80% gate; full `pnpm --filter @gami/core test:stack-e2e` green against a real Docker stack including the new rerunnability test, both under the default null provider and under a real configured LLM provider (103 tests)
- no product code changed in this slice — every change is a new or corrected test, plus the one contract-duplication fix in a test file; this matches the slice's explicit "no new product scope" constraint
- docs synced as part of this slice (not deferred): `docs/TEST_COVERAGE_PLAN.md` Avatar Trait Preparation section updated to describe the persistence-tier and stack-e2e-rerun coverage now in place; `docs/EPICS.md` EPIC 8.1 heading marked `✅ Done` to match the established convention used by other completed EPICs; `docs/API_CONTRACT.md` and `docs/DATA_MODEL.md` reviewed and found already accurate (no changes needed — the `computedTraits`/`AvatarComputedTraits`/`prepare-avatar-traits` sections already matched the shipped behavior); `docs/ARCHITECTURE.md` and `docs/TEST_STRATEGY.md` reviewed and left unchanged (no material design or test-ownership change occurred in this hardening-only slice)
- this closes out EPIC 8.1 end-to-end, including the hardening/test-closure/doc-sync gate that the EPIC's own execution plan calls for as a final step

---

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

| Date       | Milestone                                                                                       |
| ---------- | ----------------------------------------------------------------------------------------------- |
| 2026-04-22 | EPIC 1.1 — Core Platform Bootstrap                                                              |
| 2026-04-22 | EPIC 1.2 — First LLM Loop + Observability                                                       |
| 2026-04-22 | EPIC 2.1 — Avatar Agent v1                                                                      |
| 2026-04-22 | EPIC 2.2 — Scenario & Session Lifecycle                                                         |
| 2026-04-27 | EPIC 4.4 — Multi-Avatar Navigation v1                                                           |
| 2026-04-28 | EPIC 2.5 — Admin CRUD + Console Integration                                                     |
| 2026-04-28 | EPIC 2.6 — GM Debug Panel v1                                                                    |
| 2026-04-29 | EPIC 4.1 — Async Game Master v1                                                                 |
| 2026-04-30 | EPIC 3.1 — Health & Dependency Monitoring                                                       |
| 2026-04-30 | EPIC 4.3 — Performance Baseline                                                                 |
| 2026-05-02 | EPIC 5.5 — User Persona System                                                                  |
| 2026-05-05 | EPIC 4.2 — Memory Layer v1                                                                      |
| 2026-05-05 | EPIC 4.5 — Runtime State & SSE Events                                                           |
| 2026-05-06 | EPIC 4.2b — Memory System v2                                                                    |
| 2026-05-07 | EPIC 2.7 — Runtime Inspector v2                                                                 |
| 2026-05-07 | EPIC 2.8 — Console Debugging Redesign                                                           |
| 2026-05-08 | EPIC 4.2c — Episodic + Hydrated Memory System                                                   |
| 2026-05-10 | EPIC 3.2 — Inspector Consolidation & Contract Cleanup                                           |
| 2026-05-11 | EPIC 5.1 — Knowledge Substrate, Ingestion, Retrieval                                            |
| 2026-05-11 | EPIC 5.2 — Context Engine v2                                                                    |
| 2026-05-20 | EPIC 4.1c — Multi-Model Runtime Configuration                                                   |
| 2026-06-01 | EPIC 7.1 — Public User Web App v1                                                               |
| 2026-07-05 | EPIC 6.1 — Scenario Builder v1 (contract cleanup)                                               |
| 2026-07-06 | EPIC 6.1 — Scenario Builder v1 (admin app foundation)                                           |
| 2026-07-09 | EPIC 6.1 — Scenario Builder v1 (scenario/avatar editors + visibility)                           |
| 2026-07-09 | EPIC 6.1 — Scenario Builder v1 (knowledge sources + visibility policy + file upload)            |
| 2026-07-09 | EPIC 6.1 — Scenario Builder v1 (runtime model selection)                                        |
| 2026-07-09 | EPIC 6.1 — Scenario Builder v1 (final hardening: seed parity, tests, doc sync)                  |
| 2026-07-12 | EPIC 6.1 — Scenario Builder v1 (audit remediation: knowledge authoring + visibility invariants) |
| 2026-07-18 | EPIC 6.1 — Scenario Builder v1 (audit remediation: knowledge updates + schema alignment)        |
| 2026-07-19 | EPIC 8.1 — Avatar Trait Structuring (contract and source-ownership baseline)                    |
| 2026-07-19 | EPIC 8.1 — Avatar Trait Structuring (fixed trait schema and avatar persistence)                 |
| 2026-07-19 | EPIC 8.1 — Avatar Trait Structuring (scenario avatar trait preparation service)                 |
| 2026-07-19 | EPIC 8.1 — Avatar Trait Structuring (explicit trigger-preparation HTTP endpoint)                |
| 2026-07-19 | EPIC 8.1 — Avatar Trait Structuring (admin trigger and read-only trait inspection)              |
| 2026-07-19 | EPIC 8.1 — Avatar Trait Structuring (test-gap closure, recomputation hardening, doc sync)       |

---

# 5. Current Focus

Current implementation focus:

- context intelligence
- GM context assembly evolution
- media-aware retrieval
- advanced orchestration intelligence
- retrieval observability
- public web app operational hardening
- EPIC 6.1 (Scenario Builder v1 admin app) is complete for the supported scenario-builder surfaces: contract cleanup, scenario/avatar editors, knowledge source management, runtime model selection, final hardening, and audit remediation all delivered
- EPIC 8.1 (Avatar Trait Structuring) is complete: contract/source-ownership baseline, fixed `computedTraits` schema/persistence, the scenario avatar trait preparation service (`PrepareScenarioAvatarTraitsUseCase`), the explicit `POST /v1/scenarios/{scenarioId}/prepare-avatar-traits` HTTP endpoint, the admin trigger/read-only trait inspection UI, and the final test-gap-closure/recomputation-hardening/doc-sync pass are all delivered; EPIC 8.2 runtime consumption of `computedTraits` remains

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
