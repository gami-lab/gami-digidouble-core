# Tech stack

This file records current constraints and why they were chosen. Exact versions, scripts, and
environment variables belong in the repository manifests and compose files.

## Priorities

Priority order when choices conflict: learning speed -> correctness -> performance. The product
shape is headless, API-first, self-hostable, TypeScript-only, and orchestration ownership stays in
product code rather than in an external agent framework.

## Runtime

- Node.js LTS, strict TypeScript, pnpm workspaces, Turborepo.
- ESLint + `typescript-eslint`, Prettier, `simple-git-hooks` + `lint-staged`, and GitHub Actions
  gate format/lint/typecheck/test — chosen for a boring, low-maintenance toolchain over anything
  bespoke.
- Fastify for HTTP; JSON, SSE, and bounded binary audio transports. REST-style JSON under `/v1` with
  `x-api-key` auth for Phase A (no OAuth/multi-tenant auth yet — deferred, see below).
- PostgreSQL with pgvector; Redis for cache, coordination, and runtime idempotency.
- Docker Compose for local infra and Coolify deployment.

## Core boundaries

- `apps/core` is a modular monolith using `API -> Application -> Domain -> Infrastructure`.
- Provider SDKs and network calls live only in Infrastructure adapters; domain/application code
  never calls a provider SDK directly.
- LLM calls use the internal adapter/registry and role-based model resolution (`avatar`, `gameMaster`, `memory`).
- OpenAI, Anthropic, Mistral, and xAI are supported through the shared model catalog
  (`packages/shared/src/model-catalog.ts`, the single source of truth for allowed provider/model
  pairs) — do not hard-code provider behavior or a model list in business logic.
- Embeddings use `IEmbeddingAdapter`, independent from chat-model configuration and chat-role
  resolution; embedding config (`EMBEDDING_PROVIDER`/`_MODEL`/`_DIMENSIONS`/`_BATCH_SIZE`) is never
  derived from `LLM_PROVIDER`.
- Speech-to-text and text-to-speech use provider-neutral application ports. Voice is optional and
  must not alter text-turn behavior: a missing provider credential produces a typed unconfigured
  adapter, not a silent fallback, so text-only deployments keep working unchanged.

## Knowledge and retrieval

- Static knowledge types are `avatar_knowledge`, `world`, and `media`.
- Conversational memory is a separate lifecycle and is never represented as a static knowledge type.
- Production embeddings use OpenAI `text-embedding-3-small` at its native 1536 dimensions to match
  the deployed PostgreSQL `VECTOR(1536)` column with `vector_cosine_ops`.
- A profile/model/dimension change requires a matching schema revision and a full staged, atomic
  reindex (see `EMBEDDING_OPERATIONS.md`) — configuration alone cannot select a mixed vector space,
  and existing DB volumes are not reusable across that change. There is no production hash-vector
  fallback.
- Query embedding is application-owned (`KnowledgeQueryEmbeddingService` resolves the active
  profile, embeds normalized variants in one batch); candidate filtering is repository-owned
  (parameterized pgvector `embedding <=> query` plus bounded PostgreSQL full-text search with shared
  eligibility filters); context selection is deterministic and traceable.
- Why in-house instead of a vector DB or RAG framework: retrieval is one bounded context source, not
  the architecture itself — pgvector is deferred-replaceable, not a foundational dependency.

## Voice providers

- Speech-to-text: `DeepgramSpeechToTextAdapter` uses Deepgram's pre-recorded HTTP endpoint via the
  platform `fetch` client (no SDK dependency), chosen to avoid adding a provider SDK for a bounded,
  one-shot HTTP call.
- Text-to-speech: `TTS_PROVIDER` selects `null` (default, disabled) or `gradium`; the Gradium adapter
  uses the official one-shot REST endpoint over native `fetch` rather than its Python-only SDK. It
  emits native WAV or Ogg-wrapped Opus and rejects unsupported formats without transcoding; its
  response currently carries no duration metadata, so duration is optional end-to-end.
- Both are optional, additive ports — their absence must never change text-turn behavior.

## Clients and tools

- `apps/web` — public player experience.
- `apps/admin` — scenario/content authoring, distinct from console (debugging) and web (players).
- `apps/console` — local operator/debug UI; not a production service.
- `tools/conversation-evaluation` — standalone package for scripted evaluation: authenticated
  sequential API execution, semantic judging through `/v1/exchange`, multi-model comparison, and
  local reports. It uses only public authenticated HTTP boundaries and shared DTOs — never provider
  SDKs or Core runtime internals directly — so evaluation stays a black-box consumer like any other
  client.
- `packages/shared` — public/shared DTOs and contract helpers. It must not contain Core business logic.
- All four consumer apps/tools talk to Core only over HTTP with an environment-driven URL/key; none
  has direct database or domain access.

## Rules

- All LLM calls go through the internal wrapper; domain/application code never calls a provider SDK.
- No LangChain/LangGraph (or other heavy agent framework) as an orchestration layer in Phase A —
  orchestration is product code so it stays inspectable and testable without prompt-only behavior.
- No dedicated vector database before pgvector measurably proves insufficient.
- No microservice split or dedicated vector database without measured need.
- No frontend assumptions in Core.
- Prefer additive API changes and keep public payloads smaller than internal runtime state.

## Deferred / out of scope

- Heavy orchestration frameworks, a dedicated vector database, OAuth/multi-tenant auth, voice or
  media rendering inside Core, and hybrid response caching as a default runtime path.
- These are not rejected forever — see `ARCHITECTURE.md` Evolution rules for when to revisit.

## Source of truth

- This file should describe current implementation, not earlier exploration or aspirational plans.
- A merely speculative technology does not belong here until it is actually adopted.
