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

## 1. Modular Monolith First

We start with one deployable application.

Why:

- fastest delivery path for a small team
- easier debugging
- simpler local development
- simpler refactoring

Internal boundaries must be clean enough that modules could later be extracted if justified.

---

## 2. Clean Boundaries Over Fancy Patterns

Use architecture to reduce coupling, not to impress.

We prefer:

- explicit interfaces
- simple services
- small modules
- testable business logic
- clear ownership

We avoid:

- unnecessary layers
- speculative abstractions
- framework-driven architecture

---

## 3. Replaceable Infrastructure

Business logic must not depend directly on vendors.

We use abstraction layers for:

- LLM providers
- database access
- logging / observability
- cache / queue (when needed)
- embeddings provider

This allows change without rewriting core logic.

---

## 4. Headless Core

The Core is not the frontend.

It exposes APIs and events.

External layers may include:

- back-office
- player UI
- voice systems
- media systems
- future SDKs

---

## 5. Async Where Valuable

Not everything should block user responses.

Use async processing for:

- Game Master triggers
- memory compaction
- logging flush
- analytics
- background evaluations

---

# High-Level System View

```text
Clients / Tools
    |
    v
API Layer
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

- HTTP / WebSocket entry points
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

Replaceable without touching domain logic.

---

# Main Modules

---

## Module: Conversation

Owns runtime conversations.

Contains:

- sessions
- messages
- streaming responses
- session lifecycle

Key use cases:

- start session
- send message
- close session
- reset session

---

## Module: Avatar

Owns the speaking entity.

Contains:

- persona configuration
- avatar prompt building
- style behavior
- response generation

The Avatar speaks.

The Avatar does not own global orchestration.

---

## Module: Game Master

Owns orchestration.

Contains:

- trigger decisions
- progression logic
- directive generation
- scenario pacing
- state transitions

The Game Master guides.

The Game Master should remain lightweight in MVP.

---

## Module: Memory

Owns persistence of useful memory.

Contains:

- session summary
- user facts
- retrieval of relevant memories
- compaction jobs

Avoid storing noise.

---

## Module: Context

Builds runtime context for each turn.

Combines:

- recent messages
- memory summary
- user facts
- scenario config
- retrieved knowledge
- GM directives

Produces bounded context payloads.

---

## Module: Knowledge

Owns source ingestion and retrieval.

Contains:

- file registration
- chunking
- embeddings
- vector search
- source metadata

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
- **Ingestion job monitor** — status, retry, error detail for knowledge pipeline jobs
- **Admin actions** — reset session, replay last turn, retry failed job
- **Audit log** — who triggered which admin action and when
- **Metrics overview** — token usage, cost, latency aggregates, error rates

### Admin API vs Public API

The Core exposes two API surfaces:

- **Public API** (`/v1/conversations`, `/v1/scenarios`, `/v1/knowledge-sources`)
  → used by product clients, SDKs, future UIs
  → user-facing, stable, versioned

- **Admin API** (`/v1/admin/*`)
  → used by back-office, operators, internal tools
  → not user-facing, may expose internal state
  → same auth model but may require additional guards (IP allowlist, role, etc.)

These surfaces must stay clearly separated in routing and responsibility.

---

# Request Flow (Normal Message)

```text
1. Client sends message
2. API validates request
3. SendMessage use case starts
4. Load session + scenario
5. Context module builds runtime context
6. Avatar generates streamed response
7. Message saved
8. Async tasks launched:
   - Game Master review
   - memory update
   - logs / metrics
9. Response completes
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

  domain/
    conversation/        → Session and message logic
    avatar/              → Persona configuration, response generation
    game-master/         → Trigger logic, state management, guidance injection
    memory/              → Session summary + persistent user facts
    context/             → Context assembly (memory + scenario + knowledge)
    knowledge/           → Ingestion, chunking, embeddings, RAG retrieval
    scenario/            → Config-driven experience templates
    operations/          → Health aggregation, dependency probes, metrics summaries

  infrastructure/        → Concrete adapter implementations
    db/                  → PostgreSQL repositories (pgvector included)
    cache/               → Redis adapters
    llm/                 → Provider abstraction layer + adapters
    observability/       → Langfuse wrapper, logging, structured event emission
```

Keep folders boring and predictable.

---

# Port / Adapter Contracts

## LLM Port

```ts
generate(input): Promise<Result>
stream(input): AsyncIterable<Token>
embed(input): Promise<Vector[]>
```

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

---

# Database Strategy

Use PostgreSQL as source of truth.

Use pgvector for embeddings.

Use JSONB for flexible evolving fields:

- scenario config
- metadata
- event payloads

Prefer relational columns for stable concepts.

---

# Redis Strategy

Use only where useful.

Initial uses:

- hot session cache
- pub/sub for async signals
- rate limiting later
- short-lived locks if needed

If Redis adds no value, keep usage minimal.

---

# Logging / Observability Strategy

Never call vendor SDKs directly from domain logic.

Use Logger Port.

Track:

- request ids
- latency
- model used
- token usage
- costs
- failures
- trigger frequency

This allows replacing tools later.

Current implementation baseline (EPIC 1.2):

- `POST /v1/exchange` records one trace per request (`llm.completion`)
- trace payload includes request id, latency, token usage, and model metadata
- process shutdown path flushes the same observability adapter instance used during requests

---

# LLM Strategy

All providers accessed through one internal abstraction.

Capabilities:

- provider selection
- retries
- timeouts
- fallback model
- structured JSON mode
- streaming mode

Use different models by role when useful:

- Avatar model
- Game Master model
- background evaluator later

---

# Testing Strategy

## Unit Tests

For:

- domain services
- Game Master decisions
- memory logic
- context builders

## Integration Tests

For:

- API endpoints
- repository implementations
- LLM adapters (mocked or sandbox)

## End-to-End Tests

For:

- full conversation flows
- scenario setup
- back-office critical paths

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
