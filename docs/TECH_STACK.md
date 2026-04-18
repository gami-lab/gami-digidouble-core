# TECH_STACK.md

## Purpose

Define the technical stack for the MVP Core, starting with **Phase A** and making explicit what is already decided versus what still needs validation.

This is a working document — decisions can evolve, but the current direction is now much clearer.

---

## Core Constraints

- Language: **TypeScript only**
- Team: **2–3 devs**
- Priority: **speed of iteration > performance > completeness**
- Architecture: **modular monolith**
- Principle: **we own the architecture, not a framework**
- MVP target: **Scenario A = API + back-office first**
- Core style: **headless, API-first, self-hostable**

---

## 1. Runtime & Backend

### Choice

- **Node.js (LTS)**
- **TypeScript (strict)**

### Why

- aligned with team constraints and roadmap
- one language across core and back-office
- fast enough for MVP while keeping iteration simple

### Validation

- async performance on conversational flows
- stability under long-running sessions
- support for streaming and background tasks

---

## 2. Monorepo & Tooling

### Choice

- **pnpm** — workspace package manager
- **Turborepo** — task orchestration (build, lint, typecheck, test, format)

### Why

- aligned with team constraints and roadmap
- supports a clean separation between core modules, back-office, shared types, and tooling
- good fit for a small TS-only team

### Validation

- dev ergonomics
- simple local setup
- CI friendliness

---

## 2b. Developer Quality Tooling

### Choice

- **ESLint 9** with `typescript-eslint` `strictTypeChecked` preset
- **Prettier 3** for consistent formatting
- **simple-git-hooks** + **lint-staged** for pre-commit enforcement
- **GitHub Actions** CI: format check → lint → typecheck → test on every push/PR

### Code Quality Rules Enforced

- `complexity` ≤ 10 (cyclomatic)
- `max-lines` ≤ 300 per file (excluding blanks and comments)
- `max-lines-per-function` ≤ 50 (excluding blanks and comments)
- `no-floating-promises` — all async calls must be awaited or handled
- `explicit-module-boundary-types` — all exported functions must declare return types

### Why

- small team benefits from hard guardrails over convention
- pre-commit hooks catch issues before CI
- enforced rules prevent complexity from accumulating silently

---

## 3. API Layer

### Choice

- **Fastify**

### Why

- lightweight
- fast
- strong TypeScript support
- good fit for REST + WebSocket in a headless core

### Scope

The API layer is the single entry point to the Core.

Expected early responsibilities:

- session start
- send message
- history retrieval
- state/debug endpoints
- metrics/debug endpoints

### Validation

- request overhead
- WebSocket support
- clean contract design
- local DX for fast iteration

---

## 4. Orchestration (Core Engine)

### Choice

- **Custom orchestration (from scratch)**

### Components

We implement:

- **Game Master**
- **Avatar Agent**
- **Context Manager**
- **Memory / State update flow**

### Rule

External frameworks must **not** control:

- state
- flow
- decision logic
- orchestration semantics

### Why

The roadmap and core architecture now clearly favor:

- an **async Director–Actor model**
- explicit control over orchestration
- modular A/B-testable architecture
- no heavy LLM framework in the MVP

### Alternative (later only)

- **LangGraph**, only if the graph/state complexity genuinely justifies it in Phase B or later

### Validation

- can model async GM triggers cleanly
- remains debuggable
- supports headless evolution toward nodes / multi-scenarios later

---

## 5. Conversation Architecture

### Choice

- **Async Director–Actor pattern**
  - **Avatar** answers directly in most exchanges
  - **Game Master** observes and intervenes asynchronously by triggers
  - **Context Manager** assembles the 3 context dimensions
  - **State update / memory save** should not block response when avoidable

### Why

This is now one of the strongest architectural decisions in the roadmap:

- lower perceived latency
- clearer role separation
- better fit for experience orchestration than a single merged agent

### Validation

- Avatar-only latency remains acceptable
- GM triggers improve quality without harming responsiveness
- async behavior remains understandable in code and logs

---

## 6. LLM Layer (CRITICAL)

### Choice

- **Direct provider SDKs by default**
- optional use of **Vercel AI SDK** only if it simplifies streaming/provider handling without taking over architecture
- **thin internal wrapper is mandatory**

### Wrapper Responsibilities

- provider abstraction
- model selection by role
- retries / timeouts
- fallback strategy
- JSON enforcement for structured calls
- observability hooks
- cost / token accounting
- streaming abstraction

### Rule

- Wrapper is mandatory
- SDKs are replaceable
- architecture must never depend on LangChain, LangGraph, or another framework abstraction

### Why

The updated roadmap explicitly reinforces **systematic wrappers** for LLM, logging, and storage.

### Validation

- switch provider with config-level changes
- structured output reliability for GM
- robust timeout / fallback handling
- streaming works consistently across providers

Current implementation baseline (EPIC 1.2):

- provider wrapper implemented and active for `openai`, `anthropic`, `mistral`, and deterministic `null`
- first non-session loop exposed via `POST /v1/exchange`
- every successful call returns and traces `model`, `inputTokens`, `outputTokens`, and `latencyMs`

---

## 7. LLM Providers (Initial)

### Setup

Use **LLM by role**:

- **Avatar** → conversation model
- **Game Master** → fast reasoning / orchestration model
- **Quality agent** (later) → background evaluation model

### Initial candidates

- **OpenAI**
  - GPT-4o-mini for frugal development baseline
  - GPT-4o / stronger model when quality demands it
- **Anthropic**
  - Claude Sonnet as comparison / fallback
- **Mistral**
  - optional European/open alternative
- aggregator/proxy support later if useful:
  - **OpenRouter**
  - **Featherless**
- local/self-hosted SLM later if justified

### Why

The roadmap explicitly recommends:

- **frugal models for development**
- **role-based model allocation**
- provider comparison as part of validation

### Validation

- latency per role
- cost per interaction
- in-character quality
- GM structured reliability
- provider swap readiness

---

## 8. Persistence

### Choice

- **PostgreSQL**
- **pgvector**

### Rule

- single datastore for MVP
- no dedicated vector DB in Phase A

### Why

This is now a confirmed architecture decision:

- one relational + vector store
- lower operational complexity
- enough for MVP volumes

### Scope

Store:

- users
- sessions
- exchanges
- user memory
- avatar state
- scenario config references
- embeddings / retrieval metadata

### Validation

- retrieval latency
- schema simplicity
- migration path if vector needs outgrow pgvector later

---

## 9. Cache / Session / Event Layer

### Choice

- **Redis**

### Usage

- session cache
- context prefetch / hot data
- pub/sub for async internal events
- optional coordination for background workers

### Why

Redis is explicitly part of the 3-container MVP architecture.

### Validation

- measurable latency improvement
- simple operational model
- no accidental architecture drift toward distributed complexity

---

## 10. Context / RAG

### Choice

- **Simple in-house RAG pipeline**

### Components

- ingestion
- chunking
- embeddings
- retrieval
- retrieval filtering based on current context
- compacted injection into GM / Avatar flow

### Inputs

- PDF
- markdown
- text
- media metadata / descriptions

### Rule

- no heavy RAG framework at MVP stage
- RAG is a subsystem, not the architecture

### Optional helpers

- loaders or embeddings helpers from libraries only if they stay replaceable

### Why

The roadmap confirms:

- Sprint 4 = RAG + Sources/Knowledge
- sources include documents and media metadata
- the real challenge is retrieval relevance + token discipline, not framework sophistication

### Validation

- retrieval relevance
- latency
- token impact
- operational simplicity

---

## 11. Memory Strategy

### Choice

Start with **2 layers**:

- **Session memory**
  - sliding window
  - cumulative summary
- **User memory**
  - persistent structured facts / preferences

### Later

- **Node-level memory** in Phase B

### Why

This is now explicitly the roadmap baseline, and it directly addresses the main technical risk: context explosion over long sessions.

### Rule

- memory must be useful, not exhaustive
- structured facts are preferred over raw transcript accumulation

### Validation

- 30+ exchanges without major degradation
- memory coherence across sessions
- compacted context stays within budget

---

## 12. Observability — LLM Traces (CRITICAL)

### Choice

- **Langfuse (self-hosted preferred)**
- wrapped behind an internal logging / observability abstraction

### Scope

**Langfuse covers LLM traces only.**

It captures:

- prompts and responses
- latency and TTFT
- token counts
- cost estimates
- model metadata per call
- context size by role / session / scenario

It does **not** cover:

- general system health
- session or GM state inspection
- ingestion job status
- admin actions
- endpoint metrics
- dependency health

Those belong to the **Operational Stack** (see section 12b) and the **Operations module**.

### Later additions

- thumbs up / down user feedback
- background quality analysis on a sample of conversations

### Why

The roadmap explicitly says **observability from Sprint 1** and via **wrapper abstraction**, not direct coupling.

### Validation

- debugging usefulness
- comparison between models / prompts / architectures
- low friction for dev workflow

---

## 12b. Operational Stack

### Purpose

Beyond LLM traces, the platform needs operational visibility across the whole system.

### Tooling

| Concern                  | Tool / Approach                                                            |
| ------------------------ | -------------------------------------------------------------------------- |
| Structured logs          | JSON stdout (Pino / Fastify built-in) — already in place                   |
| Health endpoints         | `GET /health` (flat), `GET /v1/admin/dependencies` (rich)                  |
| Admin inspection API     | Fastify admin routes — `/v1/admin/*`                                       |
| Metrics overview         | Lightweight in-DB aggregation (session count, error rate, latency P50/P95) |
| Dashboards               | Grafana or embedded back-office charts — Phase A simple                    |
| Audit log                | `AdminActionLog` table — persisted in PostgreSQL                           |
| Ingestion job visibility | `IngestionJob` table — status, attempts, error detail                      |

### Constraints

- No separate metrics server (Prometheus/Grafana) in Phase A unless it becomes clearly necessary
- Keep admin API as part of the Core — not a separate service
- Back-office UI reads admin API — no direct DB access from UI

### Validation

- operator can diagnose a failed session without a database query
- operator can retry a failed ingestion job through the admin API
- dependency health check covers postgres, redis, and LLM provider reachability

---

## 13. Streaming

### Choice

- **WebSocket**
- fallback / simpler cases: **SSE** if needed

### Why

The roadmap explicitly calls for:

- REST API + **WebSocket** for streaming
- low perceived latency through streamed responses

### Validation

- perceived latency improvement
- frontend compatibility
- simplicity vs SSE tradeoff

---

## 14. Back-office (Phase A UI)

### Choice

- **Next.js (TypeScript)** preferred for maintainable back-office
- **Lovable / Bolt / vibe-coded UI** acceptable for acceleration if quality is sufficient

### Goal

Allow a non-dev to:

- configure a scenario
- edit avatar / storyworld / objectives
- upload source documents
- launch test conversations
- inspect logs and metrics

### Why

This matches the recommended MVP Scenario A: **API + back-office first**, no voice yet.

### Validation

- usable by non-dev
- does not slow down Core delivery
- reuses API contracts cleanly

---

## 15. Infra / Deployment

### Phase A choice

- **docker-compose**
- **3 core containers**
  - app (TypeScript modular monolith)
  - PostgreSQL + pgvector
  - Redis

### Optional local dev extras

- Langfuse may run alongside in local/dev environments, but it should remain an attached tool, not something that changes the 3-container core architecture

### Deployment direction

- local-first in Phase A
- Coolify / datacenter / European cloud later
- self-hosting remains a hard requirement

### Why

The roadmap now clearly states:

- local-first development in Phase A
- 3-container MVP architecture
- no microservices
- production evolution later only if justified

### Validation

- full stack boot reliability
- reproducible local environments
- easy migration to self-hosted environments later

---

## 16. Media Handling

### Choice

- media files stay **outside** the Core
- Core stores:
  - metadata
  - references
  - vectorized descriptions

### Likely examples

- video on Gumlet
- external images / docs
- player handled by outer layers

### Why

This is now an explicit architecture rule: the Core is headless and does not become a media storage system.

### Validation

- media can be triggered cleanly from conversation state
- Core remains decoupled from rendering

---

## 17. Testing & Validation

### Test Runner

- **Vitest 3** — fast, native TypeScript, Node environment
- Tests colocated with source files (`*.test.ts` next to the file under test)
- Unit tests are deterministic — no LLM calls

### Phase A minimum

- unit tests for core logic
- integration tests for conversation API
- manual scenario testing
- latency / cost tracking
- provider comparison

### Required trajectory

- golden conversation regression tests
- LLM-as-judge evaluations
- memory smoke tests
- architecture A/B comparisons
- load tests later in Phase B

### Why

The roadmap now includes an explicit validation framework and benchmarking strategy.

---

## 18. Security / Auth

### Phase A

- **basic API key auth** is enough

### Then

- stronger auth later
- JWT / refresh tokens in later phases
- multi-tenant isolation in Phase C

### Why

This reflects the roadmap: keep security proportional in Phase A, harden later.

---

## 19. Decisions Now Locked

1. **TypeScript only**
2. **Modular monolith**
3. **Custom orchestration**
4. **No heavy LLM framework in MVP**
5. **Wrapper-first design**
6. **PostgreSQL + pgvector**
7. **Redis**
8. **REST API + WebSocket streaming**
9. **Observability from day 1**
10. **Scenario A first: API + back-office**
11. **Local-first Phase A**
12. **Headless core, media external**

---

## 20. Open Decisions / To Validate Early

1. **Fastify** confirmed in practice after Sprint 1
2. Direct provider SDKs vs light use of **Vercel AI SDK**
3. embedding model choice
4. exact Redis role after first latency measurements
5. Next.js vs vibe-coded back-office implementation
6. concrete provider mix for GM / Avatar
7. Langfuse self-hosting ergonomics in the dev loop

---

## Final Rules

1. No framework controls the architecture
2. All LLM calls go through our wrapper
3. Observability is mandatory from day 1
4. Keep the Core headless
5. Start simple, but leave clean extension points
6. Optimize for learning speed, not architectural prestige

---

## Anti-Patterns (DO NOT DO)

- introducing LangChain or LangGraph as the architectural center
- splitting into microservices early
- adding voice into Phase A core scope
- storing raw full context blindly
- coupling the Core to UI or media rendering
- letting observability depend on direct vendor calls
- adding a dedicated vector DB before pgvector proves insufficient
