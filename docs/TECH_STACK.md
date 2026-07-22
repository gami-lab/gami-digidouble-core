# Tech Stack

## Purpose

Compact record of the technologies and constraints currently used by the Phase A core.

For architecture boundaries, read `ARCHITECTURE.md`.
For product principles, read `PRINCIPLES.md`.

## Core Constraints

- Runtime language: TypeScript only
- Runtime architecture: modular monolith
- Priority order: learning speed -> correctness -> performance
- Core product shape: headless, API-first, self-hostable
- Orchestration ownership stays in product code, not in an external framework

## Locked Stack

### Runtime And Tooling

- Node.js LTS
- TypeScript in strict mode
- pnpm workspaces
- Turborepo
- ESLint + `typescript-eslint`
- Prettier
- `simple-git-hooks` + `lint-staged`
- GitHub Actions for format, lint, typecheck, and test gates

### API And Backend

- Fastify for HTTP
- SSE for runtime event and progressive message streaming
- REST-style JSON contracts under `/v1`
- API-key auth for Phase A

### Persistence And Infra

- PostgreSQL as primary datastore
- pgvector for embeddings
- Redis for cache and runtime coordination
- Docker Compose for local infrastructure

### LLM Layer

- Direct provider SDKs behind an internal wrapper
- Provider/model selection resolved by runtime role
- Current provider set supported in contracts: OpenAI, Anthropic, Mistral, xAI

### Knowledge And Retrieval

- In-house ingestion and typed retrieval pipeline
- Knowledge types: `memory`, `world`, `media`
- Retrieval is one bounded context source, not the architecture itself

### Observability

- Langfuse behind an internal observability abstraction for LLM traces
- Fastify/Pino-style structured logs for application/runtime operations
- Event-log persistence plus admin inspection routes for runtime diagnostics

### User-Facing Apps

- `apps/console`: operator/debug UI
- `apps/admin`: scenario-builder/admin UI
- `apps/web`: public player-facing UI
- Frontend stack: React + Vite + strict TypeScript

### Testing

- Vitest-based package test suites
- Unit, integration, e2e, and stack-e2e tiers
- Contract-first testing for API/admin/runtime surfaces

## Non-Negotiable Technical Rules

- All LLM calls go through the internal wrapper.
- Domain and application code do not call provider SDKs directly.
- No LangChain or LangGraph as architectural control layers in Phase A.
- No dedicated vector database before pgvector proves insufficient.
- No microservice split for the Phase A core.
- No frontend assumptions inside core business logic.

## Runtime Patterns In Use

### Conversation Runtime

- Avatar responds directly to the user.
- Game Master runs asynchronously after completed avatar turns.
- Memory maintenance is asynchronous whenever possible.
- Runtime state changes are exposed through SSE and admin inspection routes.
- Public avatar responses also use an additive SSE message route; the web client buffers late
  deltas until sequence order is contiguous, validates decoded frames through the shared stream
  contract decoder, and cancels the response reader on interruption.

### Model Resolution

- Avatar role can be overridden per avatar and per scenario.
- Game Master can be overridden per scenario.
- Memory role uses global role override or global default.
- Allowed provider/model pairs are owned centrally in shared contract/catalog code.

### Retrieval And Context

- Retrieval is typed and bounded.
- Avatar retrieval may be visibility-filtered by active avatar.
- Game Master retrieval remains unrestricted for orchestration.
- Context assembly is deterministic and traceable.

## Deferred Or Out Of Scope

- Heavy orchestration frameworks
- Dedicated vector database
- OAuth / multi-tenant auth
- Voice or media rendering inside core
- Hybrid response caching as a default runtime path

## Source Of Truth

- Stack decisions here should describe current implementation, not earlier exploration.
- If a technology is merely speculative, it does not belong in this file.
