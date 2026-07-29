# ARCHITECTURE.md

## Purpose

Define the target architecture for the MVP Core.

This document gives the development team a clear implementation frame while preserving flexibility.

Primary goals:

- move fast without chaos
- keep the system easy to understand
- allow parts to be replaced independently
- support experimentation
- avoid premature overengineering

This architecture is intentionally pragmatic.

---

# Core Design Principles

1. **Modular monolith first** — one deployable app with clean internal module boundaries
2. **Clean boundaries** — explicit interfaces, small modules, testable domain logic; no speculative abstractions
3. **Replaceable infrastructure** — LLM, DB, cache, observability, embeddings accessed only through abstraction layers
4. **Headless core** — exposes APIs and events; no frontend assumptions
5. **Async where valuable** — GM triggers, memory maintenance, logging flush; block only when it improves the current exchange

See `PRINCIPLES.md` for full engineering philosophy.

---

- background evaluations

---

# High-Level System View

```text
Clients / Tools
    |
    v
API Layer
    |
    +--> Event Stream (SSE)
    |        |
    |        v
    |    Client UI reacts to world changes
    |
    v
Application Layer
    |
    +--> Conversation Engine
    +--> Scenario Management
    +--> Knowledge Management
    +--> Operations / Control Plane
    |
    v
Domain Layer
    |
    +--> Session Logic
    +--> Game Master Logic
    +--> Avatar Logic
    +--> Memory Logic
    +--> Context Logic
    |
    v
Ports (Interfaces)
    |
    +--> LLM Provider
    +--> Repository Layer
    +--> Logger
    +--> Cache
    +--> Embeddings
    |
    v
Adapters
    |
    +--> OpenAI / Anthropic / Mistral
    +--> PostgreSQL
    +--> Redis
    +--> Langfuse
```

---

# Layered Architecture

## 1. API Layer

Responsibility:

- HTTP entry points (including SSE streaming endpoints)
- SSE entry points for runtime events
- auth
- request validation
- response serialization
- streaming transport

Contains:

- controllers
- route definitions
- DTO mapping

Must NOT contain:

- orchestration logic
- SQL
- prompt logic

---

## 2. Application Layer

Coordinates use cases.

Examples:

- StartSession
- SendMessage
- UploadKnowledgeSource
- RunScenarioTest
- GetSessionHistory

Responsibilities:

- transaction boundaries
- call domain services
- call ports/adapters
- assemble outputs
- publish runtime events to session-scoped stream subscribers

This layer is the main workflow coordinator.

---

## 3. Domain Layer

Heart of the product.

Contains business rules independent of infrastructure.

Examples:

- how Game Master decides triggers
- how memory is compacted
- how context is assembled
- how session state evolves
- how scenarios behave
- how runtime state is derived from session + conversation + async world status

Must remain framework-agnostic.

If this layer is clean, the product can evolve safely.

---

## 4. Infrastructure Layer

Concrete implementations of interfaces.

Examples:

- Postgres repositories
- OpenAI adapter
- Langfuse logger
- Redis cache adapter
- Dependency health probes

Replaceable without touching domain logic.

---

# Main Modules

---

## Module Map (Current)

```text
domain/
  avatar/
  context/
  conversation/
  game-master/
  health/
  knowledge/
  memory/
  metrics/      -> TurnMetrics, TurnMetricsSummary, TurnMetricsReport
  scenario/
  user/         -> User entity, UserPersona type

application/use-cases/
  get-turn-metrics/ -> Session-scoped metrics aggregation from event log
  upsert-user-persona/ -> Idempotent persona write for one user
  get-user-persona/ -> Persona read for one user
```

---

## Module: Conversation

Owns session containers, bounded conversations, and message flow boundaries.

Contains:

- session + conversation types (`domain/conversation/session.types.ts`)
- message types and metadata (`domain/conversation/session.types.ts`)
- streaming responses
- session lifecycle and conversation lifecycle
- runtime-state derivation for session-level message readiness

Key use cases:

- create session
- start conversation in session
- send message to conversation
- get conversation history
- stream runtime events (SSE)
- get runtime state snapshot

---

## Module: Avatar

Owns the speaking entity.

Contains:

- persona configuration types (`domain/avatar/avatar.types.ts`)
- persona prompt assembly (`domain/avatar/persona-prompt.service.ts`)
- deterministic avatar fixtures (`domain/avatar/avatar.fixtures.ts`)
- style behavior rules used by persona prompt assembly
- explicit, rerunnable trait preparation (`PrepareScenarioAvatarTraitsUseCase`, EPIC 8.1): derives the fixed `AvatarComputedTraits` structure from existing avatar/scenario/knowledge-source storage via the `avatar` LLM role, and persists it through `IAvatarRepository.saveComputedTraits` — a narrow write path kept separate from generic avatar create/update
- runtime avatar-identity consumption (EPIC 8.2): prompt assembly prefers prepared `computedTraits` when present and falls back to the authored `personaPrompt` for compatibility

The Avatar speaks.

The Avatar module does not own response orchestration; `SendMessageUseCase` in the application layer coordinates history + LLM invocation. Trait preparation remains a separate, explicit step; runtime orchestration now consumes the resulting structured traits through the existing prompt-assembly boundary rather than recomputing them inline.

---

## Module: Metrics

Owns turn-level performance and token reporting models for operational analysis.

Contains:

- turn metrics domain types (`domain/metrics/metrics.types.ts`)
- use-case-facing report structures for session-level turn analysis

Key use cases:

- get turn metrics report for one session

---

## Module: Game Master

Owns orchestration.

Contains:

- reasoning decisions (LLM when useful)
- deterministic policy evaluation (config + rules)
- progression logic
- directive generation
- scenario pacing
- state transitions
- avatar routing and handoff logic

The Game Master guides.

The Game Master should remain lightweight in MVP.

Runtime side effects are emitted as structured runtime events; GM itself does not push directly to clients.

### Game Master Internal Split

#### 1) Reasoning Layer

Used when interpretation is needed:

- classify user intent in context
- suggest progression moves
- draft guidance notes
- propose candidate transitions

This layer may use LLM calls.

#### 2) Policy Layer

Used for deterministic, inspectable control:

- transition rules
- priorities
- pacing rules
- allowed actions
- scenario goals
- constraints

This layer must be configurable and testable without prompt-only behavior.
Static GM system instructions and dynamic GM input rendering remain separate canonical
boundaries (`domain/game-master/gm-prompt.service.ts` and
`domain/game-master/gm-input-renderer.ts` respectively); application orchestration wires
those contracts without introducing a parallel prompt shape.
The application use case keeps workflow coordination explicit while context loading, routing
validation, and result persistence live in focused collaborators. Legacy GM topic columns remain
a persistence-compatibility concern; current runtime and inspection projections read topics from
conversation working memory only.

#### 3) Avatar Routing / Transition Engine

Owns multi-avatar navigation state per session:

- active avatar
- available avatars
- handoff logic
- content handoff directives
- transition history

Transitions must stay generic and scenario-configurable, not hardcoded per experience.

---

## Module: Memory

Owns persistence of useful memory.

Contains:

- short-term memory policy (last 3 complete exchanges, runtime-assembled)
- conversation working memory (conversation-scoped, rewritten/bounded summary)
- compatibility session/avatar summaries for existing admin/runtime surfaces
- async memory maintenance pipeline (`IMemoryMaintenancePort` / `MemoryMaintenanceService`)
- long-term user facts/events
- retrieval of relevant memories
- compaction jobs

Avoid storing noise.
No full transcript replay in context.
Working-memory compaction rejects unsupported contradicted Avatar claims before persistence; Avatar
statements are not canonical memory without user or verified-context support.

---

## Module: Context

Builds runtime context for each turn.

Combines:

- short-term memory (last 3 complete exchanges)
- working memory summary (derived from latest conversation working-memory refresh)
- long-term user facts/events
- user facts
- scenario config
- retrieved knowledge (avatar-memory / world / media)
- GM directives
- optional user persona

Produces bounded context payloads.
Context assembly is deterministic, inspectable, and testable.
Avatar runtime context is grouped into semantic sections with explicit precedence: Director Notes, Response Rules, Conversation State, User Persona, World Context, Retrieved Context, and Avatar Traits. GM context keeps its own separate projection and retrieval visibility rules.

---

## Module: Knowledge

Owns source ingestion and retrieval.

Contains:

- file registration
- chunking
- embeddings
- vector search
- source metadata
- avatar-scoped visibility filtering is applied in typed retrieval services before Context Engine assembly (not in route handlers or prompt text)
- GM context assembly consumes an unrestricted retrieval channel to preserve Director omniscience, while avatar context consumes visibility-filtered retrieval
- ingestion job lifecycle (`queued -> running -> completed | failed`) with retry
- type-specific retrieval pipelines (`memory`, `world`, `media`) with deterministic merge output
- Avatar retrieval selects one combined top-five set across memory and world items before prompt rendering, preserving one distinct best match for the user question, GM retrieval queries, and GM required facts before global fill; media remains a separate typed channel

---

## Module: Scenario

Owns configurable experiences.

Contains:

- scenario config
- objectives
- enabled avatars
- rules
- linked sources

---

## Module: Observability

Owns LLM traces, metrics, and structured event emission.

Contains:

- latency tracking
- token counts and cost accounting
- LLM-specific generation traces (Langfuse)
- structured error events
- adapter abstraction for swappable backends

LLM completion tracing is enforced at the LLM boundary via the observed adapter wrapper (`ObservedLlmAdapter`) composed by `createLlmAdapter(...)`. Application use cases pass optional trace context on `LlmRequest`; they do not own baseline completion/error trace emission.

**Scope boundary:** Observability covers instrumentation only.
It does not cover admin actions, session inspection, or recovery tools.
Those belong to the Operations module.

---

## Module: Operations / Control Plane

Owns runtime inspection, operational tools, and admin actions.

This module is distinct from Observability.
Observability emits signals. Operations exposes tools to act on those signals.

Contains:

- **Dependency health probes** — postgres, redis, LLM provider reachability
- **Session inspector** — read session state, messages, memory, GM state via admin API
  - includes bounded Context Engine trace metadata (`contextTrace`) for explainable kept/trimmed context decisions
- **Ingestion job monitor** — status, retry, error detail for knowledge pipeline jobs
- **Knowledge operator surface** — source registration, ingestion trigger, and typed retrieval inspection from the Session Admin flow
- **Admin actions** — reset session, replay GM, trigger memory refresh, clear session memory, retry failed job
- **Audit log** — who triggered which admin action and when
- **Metrics overview** — token usage, cost, latency aggregates, error rates

### Admin API vs Public API

The Core exposes two API surfaces:

- **Public API** (`/v1/sessions`, `/v1/conversations`, `/v1/scenarios`, `/v1/knowledge-sources`)
  → used by product clients, SDKs, future UIs
  → user-facing, stable, versioned

- **Admin API** (`/v1/admin/*`)
  → used by back-office, operators, internal tools
  → not user-facing, may expose internal state
  → same auth model but may require additional guards (IP allowlist, role, etc.)

These surfaces must stay clearly separated in routing and responsibility.

Console boundary (Phase A, final EPIC 3.2):

- Console is a consumer-only layer over canonical Core routes.
- Operator flow is a single `Session Inspector` path (session list -> selected session detail) and must not introduce parallel compatibility read paths.

Admin app boundary (EPIC 6.1):

- `apps/admin` is a dedicated, first-class app for scenario-builder content authoring (scenarios, avatars, knowledge sources, runtime model selection) — distinct from `apps/console` (manual test / runtime debugging console) and `apps/web` (public player-facing app).
- Like Console, it is a consumer-only layer over canonical Core public/admin routes: no direct database access, no business logic duplication, environment-driven Core connection (`VITE_API_URL`, `VITE_API_KEY`).
- Current scope: scenario list/detail editing plus scenario, avatar, knowledge, and runtime model-selection workflows through canonical Core routes.
- Scenario-scoped runtime model selection remains data-driven: persisted on `scenario.config.modelSelection`, surfaced as typed contracts, and resolved in the application/domain layers through the existing internal LLM abstraction.

---

# Request Flow (Normal Message)

```text
1. Client sends message
2. API validates request
3. SendMessage use case starts
4. Load conversation + parent session + scenario
5. Context module builds runtime context for that conversation:
   - short-term (last 3 complete exchanges) as dialogue messages
   - working memory summary as an explicit assistant-role context message
   - long-term facts/events
   - scenario + RAG + GM notes + optional user persona
6. Avatar generates a streamed response for the conversation avatar
7. User message is already persisted; the avatar message is persisted once only after terminal
   completion
8. Async tasks launched after successful completion:
   - Game Master review
   - memory update
   - logs / metrics
9. Response completes; an interrupted stream keeps the user message, discards partial avatar text,
   and skips post-turn GM/memory work
```

---

# Async Director–Actor Model

## Avatar = Actor

Directly interacts with the user.

Optimized for:

- personality
- responsiveness
- immersion
- continuity

## Game Master = Director

Observes and influences future turns.

Optimized for:

- progression
- pacing
- objective coverage
- switching context
- scenario quality

## Rule

Avatar should answer directly most of the time.

Game Master intervenes only when useful.

This preserves latency and autonomy.

Conversation boundaries are explicit signals for async memory compaction:

- explicit close endpoint
- implicit close via avatar switch/reset

Compaction remains non-blocking and never delays avatar response.

---

# Code Structure

This is the canonical structure as implemented in `apps/core/src/`.

```text
src/
  api/                   → Fastify routes, handlers, validation, serialization
    routes/              → Public API routes (/v1/conversations, /v1/scenarios, …)
    admin/               → Admin API routes (/v1/admin/*)

  application/           → Use cases (StartSession, SendMessage, ResetSession, …)
    ports/               → Port interfaces (ILlmAdapter, ICacheAdapter, …)
    use-cases/
      run-game-master/   → RunGameMasterUseCase

  domain/
    conversation/        → Session container, conversation episodes, and message logic
    avatar/              → Persona configuration and prompt assembly
    game-master/         → Reasoning + policy logic, avatar routing, state management, guidance injection
    memory/              → Layered memory (short-term policy + working summary + long-term facts)
    context/             → Deterministic context assembly (memory + scenario + knowledge + persona + GM notes)
    knowledge/           → Ingestion, chunking, embeddings, RAG retrieval
    scenario/            → Config-driven experience templates
    user/                → User entity and persona types
    operations/          → Health aggregation, dependency probes, metrics summaries

  infrastructure/        → Concrete adapter implementations
    db/                  → PostgreSQL repositories (pgvector included)
      repositories/      → postgres-gm-state.repository, postgres-event-log.repository, …
    cache/               → Redis adapters
    health/              → Postgres, Redis, and LLM dependency probes
    llm/                 → Provider abstraction layer + adapters
    observability/       → Langfuse wrapper, logging, structured event emission
```

Keep folders boring and predictable.

`apps/console/`, `apps/web/`, and `apps/admin/` are front-end consumer layers, not part of the backend 4-layer architecture.
Each consumes Core HTTP APIs and has no direct access to backend domain or infrastructure modules.
Cross-package HTTP DTO ownership for Core/console/web/admin contracts lives in `packages/shared/src/`.
Standalone tools under `tools/` are also external HTTP consumers. They may import shared wire DTOs,
but keep tool-only execution and report contracts in their own package and never import Core domain,
application repositories, provider SDKs, or infrastructure adapters.
The scripted conversation evaluator uses the authenticated public conversation lifecycle for Avatar
turns and the existing authenticated `POST /v1/exchange` boundary for provider-agnostic semantic
judging; it does not add model-selection parameters or call provider adapters directly. Its JSON
reports are local tool artifacts, not Core persistence.
Conversation message-stream DTOs are owned by
`packages/shared/src/conversation-stream-contract-types.ts`; backend execution inputs and outputs
remain under `apps/core/src/application/use-cases/`. Generic SSE frame buffering and JSON extraction
are shared from `packages/shared/src/sse.ts`, while each client retains its own subscription,
reconnect, URL, and authentication behavior.

---

# Port / Adapter Contracts

## LLM Port

```ts
complete(request): Promise<LlmResponse>
stream?(request, options?): AsyncIterable<LlmStreamEvent>
embed(input): Promise<Vector[]>
```

`LlmStreamEvent` is an internal provider contract owned by
`apps/core/src/application/ports/ILlmAdapter.ts`. It emits ordered text deltas followed by one
terminal event containing the final `LlmResponse` metadata. `LlmStreamOptions.signal` carries
cancellation to infrastructure adapters. The observed adapter traces the full stream once at
terminal completion or failure; it does not create one trace per delta. Public HTTP stream events
remain separate and are owned by `packages/shared/src/conversation-stream-contract-types.ts`.
The shared package also owns `parseMessageStreamEvent`, the runtime decoder used by browser clients
before stream events reach UI state.

The send-message application flow shares preparation and completion mechanics between
`SendMessageUseCase` and `StreamingSendMessageUseCase`. The streaming flow persists the user
message before yielding its started event, accumulates deltas server-side, persists the avatar
message only after terminal completion, and schedules post-turn GM/memory work afterward. An
abort leaves the user message persisted, skips partial avatar persistence, and yields an
interruption event when the consumer remains writable. The API route removes its request-close
listener and closes the provider iterator during cleanup, including client disconnects.

The API conversations surface exposes `POST /v1/conversations/{conversationId}/messages/stream`
as an additive SSE transport. It pulls the first application event before opening the stream so
validation and not-found failures retain the normal JSON error envelope, then maps internal events
to shared `MessageStreamEvent` DTOs and writes one JSON `data:` frame per event. Client/provider
interruption outcomes are recorded on the existing observed LLM trace with a bounded reason and
latency, while no partial avatar persistence or background turn work is allowed.

## Logger Port

```ts
info(event, data)
error(event, data)
metric(name, value, tags)
trace(payload)
```

## Repository Port

```ts
getSession(id)
saveMessage(message)
saveMemory(memory)
searchKnowledge(query)
```

Business code depends on these ports only.

Runtime provider/model choice is role-based at the application layer. The runtime roles are `avatar`, `gameMaster`, and `memory`. Each LLM-calling use case resolves an effective `{ provider, model }` through `ModelResolutionService` (avatar override → role override → global default), then fetches the concrete adapter from `LlmAdapterRegistry` in infrastructure. The observed adapter wrapper remains the single tracing boundary, and each request carries `effectiveProvider`/`effectiveModel` metadata for operations.

For technology choices (DB, Redis, observability, LLM providers), see `TECH_STACK.md`.

---

# Evolution Rules

Before adding a new service or framework, ask:

1. Is current code truly blocked?
2. Is the pain measurable?
3. Can modular refactor solve it first?
4. Is this needed now?

If not, defer.

---

# What We Intentionally Avoid (Now)

- microservices
- event bus complexity
- multiple databases
- heavy agent frameworks as architecture core
- premature plugin systems
- over-modeled domain objects
- generic abstractions with one implementation

---

# Refactoring Safety Rules

When changing architecture:

- preserve ports first
- migrate one module at a time
- keep tests green
- avoid cross-module leakage
- prefer deletion over accumulation

---

# Definition of Good Architecture Here

Good architecture means:

- new features can be added safely
- LLM provider can change quickly
- business rules are understandable
- orchestration can evolve easily
- debugging is practical
- two developers can move fast without collisions

---

# Final Rule

If a design choice adds complexity without increasing learning speed, clarity, or adaptability:

Do not add it.
