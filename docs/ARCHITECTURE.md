# Architecture

Gami DigiDouble Core is a modular monolith. It coordinates a direct Avatar response with
non-blocking Game Master and memory work behind a stable HTTP contract.

Design priorities, in order: move fast without chaos, keep the system easy to understand, allow
parts to be replaced independently, support experimentation, avoid premature overengineering. See
`PRINCIPLES.md` for the full engineering philosophy this architecture follows.

## Boundaries

```text
Clients (web, admin, console, evaluation)
        |
        v
API -> Application -> Domain
        |             |
        +---------> Infrastructure adapters
                     (Postgres/pgvector, Redis, LLM, speech, observability)
```

- **API** validates input, authenticates, maps shared DTOs, and serializes responses.
- **Application** owns use cases, orchestration order, transactions, and ports.
- **Domain** owns entities, policies, deterministic selection, prompt/context contracts, and typed failures.
- **Infrastructure** implements ports and contains provider, database, cache, and logging details.

No layer skips the boundary. The API layer must not contain orchestration logic, SQL, or prompt
logic; the domain layer must stay framework-agnostic so business rules can evolve safely.
Infrastructure implementations (Postgres repositories, provider adapters, cache, observability) are
replaceable without touching domain logic. Frontend apps and tools consume Core HTTP contracts and
do not import Core domain or infrastructure code.

## Module ownership

- **Conversation:** sessions, conversations, messages, lifecycle, active Avatar.
- **Avatar:** authored persona, explicit rerunnable trait preparation (`PrepareScenarioAvatarTraitsUseCase`
  derives `computedTraits` via the `avatar` LLM role and persists them through a narrow
  `saveComputedTraits` write path), response assembly, response cleanup. The Avatar module does not
  own response orchestration — `SendMessageUseCase` coordinates history + LLM invocation; trait
  preparation stays a separate, explicit step from runtime prompt assembly.
- **Game Master:** internally split into a reasoning layer (LLM-assisted intent/progression
  interpretation), a deterministic policy layer (config-driven transition/pacing rules, testable
  without prompt-only behavior), and an avatar routing/transition engine (active avatar, handoffs,
  transition history — generic and scenario-configurable, never hardcoded per experience). GM emits
  structured runtime events rather than pushing directly to clients, and should stay lightweight.
- **Memory:** short-term window (last 3 complete exchanges, runtime-derived, not persisted
  separately), working memory (rewritten/bounded per-conversation summary), episodic memory, user
  facts, compaction, and hydration. Working-memory compaction rejects unsupported/contradicted
  Avatar claims — an Avatar statement is not canonical memory without user or verified-context
  support. No full transcript replay ever enters context.
- **Context:** bounded Avatar/GM projections with deterministic, inspectable, testable precedence
  and trace metadata. Avatar context sections are ordered: Director Notes, Response Rules,
  Conversation State, User Persona, World Context, Retrieved Context, Avatar Traits.
- **Knowledge:** source lifecycle, typed ingestion, chunking, embedding, vector retrieval, and
  visibility. Avatar-scoped visibility filtering is enforced by the vector repository itself, not
  route handlers or prompt text. GM context consumes an explicit unrestricted retrieval channel
  (Director omniscience) separate from the Avatar-filtered channel, with no fallback between them.
- **Scenario:** experience configuration, enabled Avatars, language, objectives, and model selection.
- **Operations:** health, inspection, metrics, replay, memory actions, reindex controls, and safe
  event views. Distinct from Observability: Observability emits signals, Operations acts on them.
- **Observability:** request/turn/provider traces and structured metrics, enforced at the LLM
  boundary by an observed adapter wrapper rather than by each use case. It does not own admin actions.

Public/shared DTOs live in `packages/shared`. Internal entities and application contracts stay in
Core. Mappers at the API/application boundary are intentional; do not share persistence shapes.
Contract ownership for high fan-out entities/projections is tracked in
`CONTEXT_CONTRACT_OWNERSHIP_MAP.md`.

`apps/console`, `apps/web`, and `apps/admin` are consumer layers, not part of the 4-layer backend:
each talks to Core only over HTTP and has no direct access to domain/infrastructure. Standalone
tools (e.g. `tools/conversation-evaluation`) are external HTTP consumers too — they may import
shared wire DTOs but never Core domain, repositories, or provider SDKs.

## API surfaces

Core exposes two HTTP surfaces that must stay separated in routing and responsibility:

- **Public API** (`/v1/sessions`, `/v1/conversations`, `/v1/scenarios`, `/v1/knowledge-sources`) —
  used by product clients and SDKs; user-facing, stable, versioned.
- **Admin API** (`/v1/admin/*`) — used by back-office/operators; not user-facing, may expose
  internal state, and may carry additional guards beyond the shared API-key auth.

`apps/console` is a consumer-only debug layer over canonical Core routes with a single Session
Inspector read path (no parallel compatibility reads). `apps/admin` is the first-class
scenario-builder authoring app (scenarios, avatars, knowledge, runtime model selection); it is a
consumer layer too — no direct DB access, no duplicated business logic.

## Code layout

`apps/core/src/` follows `api/ -> application/ -> domain/ -> infrastructure/`, mirroring the
module list above (e.g. `domain/avatar`, `domain/game-master`, `domain/memory`,
`domain/knowledge`). Keep folders boring and predictable; do not introduce a parallel structure per
feature. `packages/shared/src/` owns cross-package wire DTOs consumed by Core, console, web, admin,
and `tools/`.

## Runtime flow

1. API validates and authenticates the request.
2. The send-message use case loads the active conversation and scenario.
3. Context assembles bounded conversation state, scenario content, memory, retrieval, persona, and GM guidance.
4. Avatar generates a response through the LLM port (JSON or additive SSE transport).
5. The user and final Avatar messages are persisted exactly once.
6. After successful completion, GM analysis, memory maintenance, and diagnostics run asynchronously.
7. Runtime state/events expose async changes for reconnecting clients.

An interrupted stream keeps the user message, discards partial Avatar text, and does not schedule
post-turn GM or memory work. Audio delivery is a separate, optional request after text completion.

## Director/actor rule

- The Avatar answers the user directly and owns conversational expression.
- The Game Master observes completed turns and prepares future guidance; it never blocks the normal reply.
- Avatar switching is a conversation/session lifecycle operation. GM may propose or update the next active Avatar, but it does not silently create or close conversations.
- Memory compaction is triggered by lifecycle boundaries and remains non-blocking.

## Knowledge and context

Static knowledge and conversational memory are separate systems:

- Static knowledge is scenario-shared and typed as `avatar_knowledge`, `world`, or `media`.
- Avatar retrieval applies visibility; GM retrieval may use an explicit unrestricted mode for orchestration.
- User/session/conversation scope is not a static retrieval filter.
- Context exposes `conversationState` and `retrievedContext` as separate projections. Retrieved documents never become memory merely because they were injected into a prompt.

The production retrieval path is: normalized query variants -> one profile-aware embedding batch ->
filtered pgvector nearest-neighbor plus bounded lexical candidate search -> deterministic
merge/dedup/per-type selection -> Context Engine's authoritative Avatar selection and budget ->
context projection.

## Port rules

- LLM, embedding, speech-to-text, text-to-speech, cache, repositories, and observability are ports.
  Business code depends on these ports only, never on provider SDKs directly.
- Provider names, credentials, raw payloads, and SDK types stop at Infrastructure.
- Runtime LLM provider/model choice is role-based (`avatar`, `gameMaster`, `memory`), resolved by
  `ModelResolutionService` (avatar override -> role override -> global default) and dispatched
  through `LlmAdapterRegistry`. Embedding calls do not use this role system — they go through the
  separate `IEmbeddingAdapter` port with their own profile identity.
- Observed adapters (`ObservedLlmAdapter`) are the single tracing boundary for provider calls; they
  trace once per completed/failed request (or once per full stream), not once per delta.
- Speech-to-text and text-to-speech are optional provider-neutral ports: a missing credential
  yields a typed unconfigured adapter rather than a silent transcript/audio fallback, so text-only
  deployments keep working.
- Public and recorded diagnostics contain bounded metadata only: no prompts, secrets, raw vectors, or unbounded transcripts.

## Evolution rules

- Before adding a new service, framework, or abstraction, ask: is current code truly blocked, is
  the pain measured, can a modular refactor solve it first, and is it needed now? If not, defer.
- Prefer deletion and additive contracts over compatibility branches.
- Add a new abstraction only when it has a clear boundary or more than one real consumer.
- Change one layer/module at a time, preserve ports first, and keep consumer-contract tests close to the boundary.
- Revisit infrastructure choices only with measured latency, cost, reliability, or scaling evidence.
- Intentionally out of scope for now: microservices, an event-bus, multiple databases, heavy agent
  frameworks as the architectural core, premature plugin systems, and generic abstractions with a
  single implementation.
