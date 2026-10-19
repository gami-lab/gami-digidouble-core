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

Authentication is one hook registered in `api/server.ts` at Fastify's `onRequest` stage, before
any content-type parser, so voice, upload, and audio bodies are never read for an unauthenticated
caller. Route plugins never attach their own authentication hooks; credential types plug in as
verifiers (`api/hooks/authenticate.ts`).

No layer skips the boundary. The API layer must not contain orchestration logic, SQL, or prompt
logic; the domain layer must stay framework-agnostic so business rules can evolve safely.
Infrastructure implementations (Postgres repositories, provider adapters, cache, observability) are
replaceable without touching domain logic. Frontend apps and tools consume Core HTTP contracts and
do not import Core domain or infrastructure code.

## Module ownership

- **Conversation:** sessions, conversations, messages, lifecycle, active Avatar.
- **Avatar:** authored persona, explicit rerunnable trait preparation (`PrepareScenarioAvatarTraitsUseCase`
  derives `computedTraits` with the scenario default model, falling back to the global default and
  never using Avatar role or override models, and persists them through a narrow
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
  and trace metadata. Avatar context sections are ordered: Roles, Director Notes, Response Rules,
  Conversation State, Your Interlocutor (user persona), World Context, Retrieved Context, Your
  Character (Avatar traits).
- **Knowledge:** source lifecycle, typed ingestion, chunking, embedding, vector retrieval, and
  visibility. On startup, Core ensures that an empty deployment has an active, empty corpus before
  accepting ingestion; existing active corpora remain untouched. Avatar-scoped visibility filtering is enforced by the vector repository itself, not
  route handlers or prompt text. GM context consumes an explicit unrestricted retrieval channel
  (Director omniscience) separate from the Avatar-filtered channel, with no fallback between them.
- **Scenario:** experience configuration, enabled Avatars, language, objectives, and model selection.
- **Media:** scenario-scoped image/video assets (`MediaAsset`), their admin library, reference
  validation for presentation slots, the player projection (`PublicMediaAsset`), and the open file
  route. Files sit behind the `IMediaStorage` port (filesystem adapter on a Docker volume in Phase A;
  an object store can replace it). Media is authored content, not knowledge: it is never chunked,
  embedded, or retrieved.
- **Operations:** health, inspection, metrics, replay, memory actions, reindex controls, and safe
  event views. Distinct from Observability: Observability emits signals, Operations acts on them.
- **Observability:** request/turn/provider traces and structured metrics, enforced at the LLM
  boundary by an observed adapter wrapper rather than by each use case. It does not own admin actions.

Public/shared DTOs, environment-neutral client protocol helpers, pure cross-app contract mappers,
and shared client-error presentation helpers live in `packages/shared`. The application
exchange-window service owns complete recent user/Avatar
pairing and ordering; GM-specific projections remain local when their input or output boundary
differs. Infrastructure speech adapters share only the timeout-signal lifecycle helper, while web
owns its terminal-event and browser-storage helpers. Internal entities and application contracts
stay in Core. Mappers at the API/application boundary are intentional; do not share persistence
shapes or browser lifecycle code.
Contract ownership for high fan-out entities/projections is tracked in
`CONTEXT_CONTRACT_OWNERSHIP_MAP.md`.

`apps/console`, `apps/web`, and `apps/admin` are consumer layers, not part of the 4-layer backend:
each talks to Core only over HTTP and has no direct access to domain/infrastructure. Standalone
tools (e.g. `tools/conversation-evaluation`) are external HTTP consumers too — they may import
shared wire DTOs but never Core domain, repositories, or provider SDKs.

`apps/web` is the visitor-facing player. A pure reducer (`flow/flow-state.ts`) owns the guided flow
`landing → intro → entryQuestion → characterChoice → conversation → outro` (plus a scenario picker
when several scenarios are active, and `loading`/`error`); screens only dispatch flow events and
render authored presentation. Session, conversation, voice, and runtime-event logic stay in their
existing hooks. A returning visitor with a remembered live conversation resumes in
`conversation`. Debug and operator views live in `apps/console`, never in the player.

Player media: intro/outro slot videos play full screen (skip, mute, tap-to-play when autoplay is
blocked) before the step's text, slot images replace the cover, and the conversation stage loops
the Avatar's muted idle video. `runtime.media_cue` events join the runtime-moments state as a
separate media queue (`moments/runtime-moments.ts`): a cue waits while the character thinks or
speaks and while the microphone hears the visitor, plays in arrival order once per `cueId`, videos full screen and images as an overlay that
sending a message dismisses. While media plays, presence is `watching`, the voice loop stops
listening, and a fullscreen video disables typing; everything resumes after end or skip. The
player reports `started` and one terminal outcome per cue to Core.

## API surfaces

Every route declares exactly one tier, and the tier decides which credential it accepts:

- **Public API** (`/v1/sessions`, `/v1/conversations`, `/v1/me`, read-only `GET /v1/scenarios`)
  — tier `public`, used by the player app; user-facing, stable, versioned.
- **Admin API** (`/v1/admin/*`) — tier `admin`, used by authoring, operators, and tools; includes
  all scenario/Avatar/knowledge authoring, the raw exchange, and cross-user session management.
- **Open routes** — tier `open`, no credential: `GET /health` and the credential-issue/login routes.

`server.ts` registers the public and admin plugins inside a tier scope (`api/route-tiers.ts`), so a
route inherits its group's tier unless it declares its own `config.tier`. Startup fails when any
route has no tier, and `route-tiers.test.ts` enumerates the real server's routes to keep the
matrix honest.

### Admin authentication

The admin tier accepts exactly two credentials: an admin session cookie or the server-side
`ADMIN_SERVICE_KEY` header (`x-admin-service-key`, tools only). `POST /v1/admin/auth/login` checks
the single operator password against `ADMIN_PASSWORD_HASH` (scrypt) through `AdminAuthService`,
whose credential check is a replaceable function so OIDC can take over without route changes.
Sessions live behind the `IAdminSessionStore` port (Redis in production, in-memory in tests) under
an HMAC of the random session id, so a store dump holds no usable cookie. The cookie is
`HttpOnly; Secure; SameSite=Strict; Path=/v1/admin`; cookie-authenticated state changes must also
carry an `Origin` from `ADMIN_ORIGINS` (CSRF check). The admin SPA and console sign in with the
cookie; the evaluation tool and seed script use the service key.

### Player identity

Players never choose their `userId`. `POST /v1/auth/player` issues an HMAC-SHA256 token
(`PlayerTokenService`, `node:crypto`, `PLAYER_TOKEN_SECRET`, short `PLAYER_TOKEN_TTL_SECONDS` plus a
refresh window) carrying a Core-generated id; the public-tier verifier accepts only that bearer
token and puts its `userId` on the request. A second `onRequest` hook in the public scope asks
`PlayerAccessService` whether every `sessionId`/`conversationId` in the path belongs to that
player (conversation → session → user) and answers `404` otherwise, so ownership is enforced
before any body is read and no route can forget it. Admin routes act on any session by design;
operator tools that need a player route (console chat, evaluation runs) get a token for the
session's owner from `POST /v1/admin/player-tokens`.

`apps/console` is a consumer-only debug layer over canonical Core routes: it builds each session's
turn timeline from the admin events feed and shows structured LLM inputs, linking to Langfuse for
the rendered prompts instead of reading them from Core. `apps/admin` is the first-class
scenario-builder authoring app (scenarios, avatars, knowledge, runtime model selection); it is a
consumer layer too — no direct DB access, no duplicated business logic. Every admin screen,
including scenario sub-views (edit forms, ingested data, retrieval tester), has its own URL
(`apps/admin/src/routing/router.ts`, History API, no router dependency) so reload, browser
Back/Forward, and deep links work; the nginx image falls back to `index.html` under `/admin/`.

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

- Static knowledge is scenario-shared and typed as `avatar_knowledge` or `world`. Images and video
  are scenario media assets, outside retrieval.
- Avatar retrieval applies visibility; GM retrieval may use an explicit unrestricted mode for orchestration.
- User/session/conversation scope is not a static retrieval filter.
- Prepared Avatar traits are required context; the Context Engine trims optional retrieval and memory before removing them.
- Context exposes `conversationState` and `retrievedContext` as separate projections. Retrieved documents never become memory merely because they were injected into a prompt.

The production retrieval path is: normalized query variants -> one profile-aware embedding batch ->
filtered pgvector nearest-neighbor plus bounded lexical candidate search -> deterministic
merge/dedup/per-type selection -> Context Engine's authoritative Avatar selection and budget ->
context projection.

## Port rules

- LLM, embedding, speech-to-text, text-to-speech, media storage, cache, repositories, and
  observability are ports.
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
