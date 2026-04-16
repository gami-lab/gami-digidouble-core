# Knowledge Base — Gami DigiDouble Core

Quick reference for AI agents and contributors. Use this to orient yourself in the codebase and find the right documentation.

---

## What This Project Is

**Gami DigiDouble Core** is a headless orchestration engine for AI-driven, adaptive conversations.
It is a **platform layer** (not an app), consumed via REST/WebSocket API by products that need interactive, persona-driven conversational experiences.

The core coordinates two AI agents:

- **Avatar** — answers the user directly, has a persona and memory
- **Game Master (GM)** — runs async in the background, orchestrates the experience without blocking responses

---

## Documentation Map

### Where to Look for What

| Question                                                   | Document                                                     |
| ---------------------------------------------------------- | ------------------------------------------------------------ |
| What is this project trying to achieve?                    | [docs/VISION.md](docs/VISION.md)                             |
| What principles govern every decision?                     | [docs/PRINCIPLES.md](docs/PRINCIPLES.md)                     |
| How is the codebase structured? (layers, modules, flows)   | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)                 |
| What does the database look like? (entities, schemas)      | [docs/DATA_MODEL.md](docs/DATA_MODEL.md)                     |
| What API endpoints exist and what do they return?          | [docs/API_CONTRACT.md](docs/API_CONTRACT.md)                 |
| How does the Game Master work? (inputs, outputs, triggers) | [docs/GAME_MASTER_CONTRACT.md](docs/GAME_MASTER_CONTRACT.md) |
| What technologies are used and why?                        | [docs/TECH_STACK.md](docs/TECH_STACK.md)                     |
| What has been built already?                               | [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md)             |
| What is planned and in which sprint?                       | [docs/EPICS.md](docs/EPICS.md)                               |
| How should tests be written?                               | [docs/TEST_STRATEGY.md](docs/TEST_STRATEGY.md)               |
| How to work on this repo as an agent?                      | [AGENTS.md](AGENTS.md)                                       |

---

## Key Facts

- **Language:** TypeScript (strict mode), Node.js LTS
- **API:** Fastify, REST + WebSocket, all endpoints under `/v1`, authenticated with `x-api-key`
- **Database:** PostgreSQL + pgvector (single datastore); Redis for sessions and cache
- **LLM:** Provider-agnostic — all LLM calls go through an internal abstraction layer
- **Deployment:** Docker Compose (3 containers: app, PostgreSQL, Redis)
- **No LangChain / LangGraph** — orchestration is owned, not delegated to a framework
- **Current Phase:** Phase A (MVP), April–July 2026 — nothing implemented yet

---

## Core Architecture in One Paragraph

The engine uses a **4-layer modular monolith**: API → Application → Domain → Infrastructure. User messages enter via Fastify, get validated, then pass through use cases that coordinate domain modules (Avatar, Game Master, Memory, Context Manager, Knowledge). The Avatar generates responses synchronously for low latency; the Game Master processes the turn asynchronously to decide on interventions for future turns. All LLM, database, and observability calls are isolated in the Infrastructure layer behind adapter interfaces.

---

## Most Important Constraints (Never Violate)

1. The Game Master must **never block** the Avatar response
2. All LLM provider calls must go through the **internal abstraction layer**
3. No direct infrastructure access from Domain or Application logic
4. API responses always use the standard `ApiResponse<T>` envelope
5. TypeScript strict mode — no `any`, no implicit types
6. Do not build Phase B/C features during Phase A — keep the core small
