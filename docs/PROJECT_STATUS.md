# PROJECT_STATUS.md

# Project Status

This document tracks the implementation status of Gami DigiDouble Core.

Last updated: May 12, 2026
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

Status: 🚧 In progress

### Current slice completed

- contract cleanup baseline completed before Avatar v2 feature work
- canonical shared ownership established for session/conversation HTTP DTOs in `packages/shared/src/conversation-contract-types.ts`
- duplicated local API contract types removed from core route and console adapters (`send-message`, `history`, `available-avatars`, `switch-avatar`)
- imports normalized to shared canonical contracts across `apps/core`, `apps/console`, and `packages/shared`
- nullability policy preserved: `undefined` for internal optional fields, explicit `null` only where API contract requires it
- quality gates validated for this slice: `pnpm lint`, `pnpm typecheck`, `pnpm test`

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
- deterministic precedence policy with token-budget selection telemetry added to Context Engine (no hard trimming)
- machine-readable selection/trimming trace added for debugging of kept/trimmed segments
- deterministic conflict resolution added for long-term fact keys and retrieval chunk-id duplicates
- send-message avatar prompt assembly now routes through Context Engine output mapping
- run-game-master context input now consumes Context Engine gm projection (or preassembled context from turn path)
- avatar and gm context paths share one assembly contract while preserving async non-blocking GM execution
- admin session-context inspection now exposes bounded explainable `contextTrace` metadata (kept/trimmed/policy)
- context trace mapping is canonicalized through shared DTO ownership with explicit boundary redaction/allowlisting
- regression hardening completed for precedence, non-trimming selection behavior, layer exclusion deltas, projection consistency, and trace structure
- gm recent-messages path simplified to keep chronological exchanges only (working memory remains in context.memory)
- shared runtime inspector trace contracts now use bounded segment-id typing to reduce drift
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

---

# 5. Current Focus

Current implementation focus:

- context intelligence
- GM context assembly evolution
- media-aware retrieval
- advanced orchestration intelligence
- retrieval observability

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
