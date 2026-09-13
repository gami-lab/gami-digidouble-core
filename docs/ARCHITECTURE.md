# Architecture

Gami DigiDouble Core is a modular monolith. It coordinates a direct Avatar response with
non-blocking Game Master and memory work behind a stable HTTP contract.

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

No layer skips the boundary. Frontend apps and tools consume Core HTTP contracts and do not import
Core domain or infrastructure code.

## Module ownership

- **Conversation:** sessions, conversations, messages, lifecycle, active Avatar.
- **Avatar:** authored persona, prepared traits, response assembly, response cleanup.
- **Game Master:** async planning, guidance, routing proposals, unlock decisions, and safe state reduction.
- **Memory:** short-term window, working memory, episodic memory, user facts, compaction, and hydration.
- **Context:** bounded Avatar/GM projections with deterministic precedence and trace metadata.
- **Knowledge:** source lifecycle, typed ingestion, chunking, embedding, vector retrieval, and visibility.
- **Scenario:** experience configuration, enabled Avatars, language, objectives, and model selection.
- **Operations:** health, inspection, metrics, replay, memory actions, reindex controls, and safe event views.
- **Observability:** request/turn/provider traces and structured metrics. It does not own admin actions.

Public/shared DTOs live in `packages/shared`. Internal entities and application contracts stay in
Core. Mappers at the API/application boundary are intentional; do not share persistence shapes.

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
filtered pgvector nearest-neighbor search -> deterministic merge/dedup/selection -> context projection.

## Port rules

- LLM, embedding, speech-to-text, text-to-speech, cache, repositories, and observability are ports.
- Provider names, credentials, raw payloads, and SDK types stop at Infrastructure.
- Observed adapters are the tracing boundary for provider calls.
- Public and recorded diagnostics contain bounded metadata only: no prompts, secrets, raw vectors, or unbounded transcripts.

## Evolution rules

- Prefer deletion and additive contracts over compatibility branches.
- Add a new abstraction only when it has a clear boundary or more than one real consumer.
- Change one layer/module at a time and keep consumer-contract tests close to the boundary.
- Revisit infrastructure choices only with measured latency, cost, reliability, or scaling evidence.
