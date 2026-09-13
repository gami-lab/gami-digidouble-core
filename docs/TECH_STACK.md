# Tech stack

This file records current constraints. Exact versions, scripts, and environment variables belong in
the repository manifests and compose files.

## Runtime

- Node.js LTS, strict TypeScript
- pnpm workspaces and Turborepo
- Fastify for HTTP; JSON, SSE, and bounded binary audio transports
- PostgreSQL with pgvector; Redis for cache, coordination, and runtime idempotency
- Docker Compose for local and Coolify deployment

## Core boundaries

- `apps/core` is a modular monolith using `API -> Application -> Domain -> Infrastructure`.
- Provider SDKs and network calls live only in Infrastructure adapters.
- LLM calls use the internal adapter/registry and role-based model resolution (`avatar`, `gameMaster`, `memory`).
- OpenAI, Anthropic, Mistral, and xAI are supported through the shared model catalog; do not hard-code provider behavior in business logic.
- Embeddings use `IEmbeddingAdapter`, independent from chat-model configuration.
- Speech-to-text and text-to-speech use provider-neutral application ports. Voice is optional and must not alter text-turn behavior.

## Knowledge and retrieval

- Static knowledge types are `avatar_knowledge`, `world`, and `media`.
- Conversational memory is a separate lifecycle and is never represented as a static knowledge type.
- Production embeddings currently use OpenAI `text-embedding-3-small` with 16 dimensions and a PostgreSQL `VECTOR(16)` cosine index.
- A profile/model/dimension change requires a matching schema revision and staged, atomic reindex. There is no production hash-vector fallback.
- Query embedding is application-owned; nearest-neighbor filtering is repository-owned; context selection is deterministic and traceable.

## Clients and tools

- `apps/web` — public player experience.
- `apps/admin` — scenario/content authoring.
- `apps/console` — local operator/debug UI; not a production service.
- `tools/conversation-evaluation` — external authenticated HTTP client and report generator.
- `packages/shared` — public/shared DTOs and contract helpers. It must not contain Core business logic.

## Rules

- No LangChain/LangGraph as orchestration layers in Phase A.
- No microservice split or dedicated vector database without measured need.
- No frontend assumptions in Core.
- Prefer additive API changes and keep public payloads smaller than internal runtime state.
