# Agent Instructions — Gami DigiDouble Core

This file provides instructions and conventions for any AI coding agent working on this repository.
**Read this file before writing any code.**

---

## Project Identity

**Gami DigiDouble Core** is a headless orchestration engine for interactive, conversational experiences.
It is **not an application** — it is a platform layer consumed via API by multiple products.

The engine coordinates two AI agents: an **Avatar** (the conversational actor) and a **Game Master** (the asynchronous director).

---

## Mandatory Documentation to Read First

Before implementing any feature or making any architectural decision, consult the relevant documentation in `docs/`:

| Document                                                | When to Read                                                  |
| ------------------------------------------------------- | ------------------------------------------------------------- |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md)                 | Before touching any module structure, layers, or flow         |
| [PRINCIPLES.md](docs/PRINCIPLES.md)                     | Before any design decision — 19 principles govern all choices |
| [DATA_MODEL.md](docs/DATA_MODEL.md)                     | Before writing any DB schema, entity, or repository           |
| [API_CONTRACT.md](docs/API_CONTRACT.md)                 | Before adding or modifying any API endpoint                   |
| [GAME_MASTER_CONTRACT.md](docs/GAME_MASTER_CONTRACT.md) | Before touching the Game Master module                        |
| [TECH_STACK.md](docs/TECH_STACK.md)                     | Before adding any dependency or infrastructure change         |
| [EPICS.md](docs/EPICS.md)                               | For understanding which sprint/epic a task belongs to         |
| [TEST_STRATEGY.md](docs/TEST_STRATEGY.md)               | Before writing or deciding on tests                           |
| [PROJECT_STATUS.md](docs/PROJECT_STATUS.md)             | For the current state of implemented features                 |

---

## Non-Negotiable Architectural Rules

These derive directly from the project principles and must not be violated:

### Technology

- **Runtime:** Node.js (LTS) + TypeScript in strict mode — no exceptions
- **Monorepo:** pnpm + Turborepo
- **API:** Fastify only for HTTP and WebSocket
- **Database:** PostgreSQL + pgvector; **Redis** for sessions and cache
- **No LangChain / LangGraph** in Phase A — owned orchestration only
- **LLM providers** must be accessed exclusively through the internal abstraction layer — never call provider SDKs directly from business logic

### Architecture

- Respect the 4-layer architecture: **API → Application → Domain → Infrastructure**
- No cross-layer shortcuts. Infrastructure code never in Domain; Domain never in API handlers
- Each module has one clear responsibility (see [ARCHITECTURE.md](docs/ARCHITECTURE.md))
- The Game Master is always **async and non-blocking** — it must not delay the Avatar's response
- The Avatar answers the user directly without waiting for GM validation on normal turns

### Code Quality

- TypeScript strict mode — no `any`, no implicit types
- All external inputs (user messages, API payloads) must be validated at the API boundary
- Errors must use the standard `ApiResponse<T>` envelope (see [API_CONTRACT.md](docs/API_CONTRACT.md))
- No hard-coded LLM provider names, model IDs, or credentials in business logic
- Observability (request ID, latency, token usage) must be recorded from day one — never skip instrumentation

---

## Module Map

```
src/
  api/          → Fastify routes, handlers, validation, serialization
  application/  → Use cases (StartSession, SendMessage, ResetSession, …)
  domain/
    conversation/   → Session and message logic
    avatar/         → Persona configuration, response generation
    game-master/    → Trigger logic, state management, guidance injection
    memory/         → Session summary + persistent user facts
    context/        → Context assembly (memory + scenario + knowledge)
    knowledge/      → Ingestion, chunking, embeddings, RAG retrieval
    scenario/       → Config-driven experience templates
  infrastructure/
    db/         → PostgreSQL repositories (pgvector included)
    cache/      → Redis adapters
    llm/        → Provider abstraction layer + adapters
    observability/ → Langfuse wrapper, logging, metrics
```

---

## Testing Rules

Follow the strategy defined in [TEST_STRATEGY.md](docs/TEST_STRATEGY.md):

1. **Unit tests** for all domain logic (Game Master triggers, memory rules, context selection, token budgeting) — these must be deterministic, no LLM calls
2. **Integration tests** for API endpoints, repositories, and the knowledge pipeline
3. **E2E tests** only for the critical flows (start → message → history, streaming, reset)
4. **AI regression tests** for conversation quality (coherence, persona, memory continuity)
5. Never test writing quality; test structure, contracts, and error handling
6. Protect API contracts aggressively — any endpoint shape change requires updating [API_CONTRACT.md](docs/API_CONTRACT.md)

---

## Development Workflow

1. Check [PROJECT_STATUS.md](docs/PROJECT_STATUS.md) to understand what is already built
2. Work only inside the scope of the targeted epic (see [EPICS.md](docs/EPICS.md))
3. Do not add dependencies not listed in [TECH_STACK.md](docs/TECH_STACK.md) without explicit justification
4. Do not build Phase B or C features during Phase A — keep the core small
5. Always update [PROJECT_STATUS.md](docs/PROJECT_STATUS.md) when a feature or epic is completed

---

## Git Conventions

- Use [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`
- Commit messages must reference the epic when applicable (e.g., `feat(avatar): implement persona prompt assembly [EPIC-2.1]`)
- Never commit secrets, `.env` files, or provider credentials

---

## Key Design Decisions (Do Not Revisit Without Good Reason)

| Decision                                     | Rationale                                                |
| -------------------------------------------- | -------------------------------------------------------- |
| Modular monolith over microservices          | Simpler for MVP; boundaries enforced by module structure |
| Custom orchestration over LangChain          | Full control, no hidden abstractions, easier debugging   |
| Avatar answers first, GM async               | Latency is critical; blocking on GM would degrade UX     |
| PostgreSQL + pgvector, no separate vector DB | Single datastore for MVP reduces operational complexity  |
| API key auth for Phase A                     | Simplest viable auth; OAuth deferred to Phase B/C        |
| Langfuse for observability                   | Self-hosted, LLM-native, wrapped behind abstraction      |
