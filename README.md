# Gami DigiDouble Core

A headless orchestration engine for interactive, conversational experiences — where content adapts dynamically to users through natural dialogue rather than static, linear delivery.

---

## What Is This?

**Gami DigiDouble Core** is not an application. It is a **platform layer** — a reusable engine that powers interactive AI-driven experiences across multiple products: learning, storytelling, simulations, cultural mediation, training, and more.

The engine coordinates two AI agents:
- **Avatar** — the conversational actor that responds directly to the user with a defined persona
- **Game Master** — the asynchronous director that observes conversations, triggers interventions, and guides the experience without blocking responses

The result is a system where conversations feel natural and adaptive, while remaining structured and purposeful.

---

## Core Concepts

| Concept | Description |
|---|---|
| **Avatar** | An AI persona with a defined character, tone, and knowledge domain. Responds directly to user messages. |
| **Game Master (GM)** | Runs asynchronously in the background. Decides when to intervene, switch avatars, or inject guidance. |
| **Session** | A single conversation between a user and an avatar, tracked with full history and memory. |
| **Scenario** | A config-driven experience template: objectives, avatars, knowledge sources, progression rules. |
| **Memory** | Two-layer system: session summaries (short-term) and persistent user facts (long-term). |
| **Context Manager** | Assembles the three context dimensions for each turn: memory, experience/world, and knowledge. |
| **Knowledge Pipeline** | Ingests documents (PDF, Markdown, text), chunks and embeds them, and retrieves relevant passages via RAG. |

---

## Architecture

The engine is a **modular monolith** with clean internal boundaries, organized in 4 layers:

```
┌──────────────────────────────┐
│         API Layer            │  HTTP / WebSocket (Fastify)
├──────────────────────────────┤
│      Application Layer       │  Use cases (StartSession, SendMessage, …)
├──────────────────────────────┤
│        Domain Layer          │  Business logic (GM, Avatar, Memory, Context, …)
├──────────────────────────────┤
│    Infrastructure Layer      │  PostgreSQL, Redis, LLM adapters, Observability
└──────────────────────────────┘
```

**Request flow (normal turn):**
```
User message → API validation → Load session/scenario
→ Build context → Avatar generates response → Save message
→ [async] GM review → memory update → metrics
```

---

## Tech Stack

| Concern | Technology |
|---|---|
| Runtime | Node.js (LTS) + TypeScript (strict) |
| Monorepo | pnpm + Turborepo |
| API | Fastify (REST + WebSocket) |
| Database | PostgreSQL + pgvector |
| Cache / Session | Redis |
| LLM Providers | OpenAI, Anthropic, Mistral (via internal abstraction) |
| Observability | Langfuse (self-hosted) |
| Streaming | WebSocket + SSE fallback |
| Deployment | Docker Compose (app + PostgreSQL + Redis) |
| Back-office | Next.js (TypeScript) |

---

## API at a Glance

All endpoints are under `/v1` and require an `x-api-key` header.

```
POST   /v1/conversations/start                        # Start a new session
POST   /v1/conversations/:sessionId/messages          # Send a message
POST   /v1/conversations/:sessionId/messages/stream   # Send a message (SSE streaming)
GET    /v1/conversations/:sessionId/history           # Retrieve session history
GET    /v1/conversations/:sessionId/state             # Debug state
DELETE /v1/conversations/:sessionId                   # Reset session
```

See [docs/API_CONTRACT.md](docs/API_CONTRACT.md) for the full contract.

---

## Getting Started

> The project is in early development. See [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) for what is currently implemented.

### Prerequisites

- Node.js (LTS)
- pnpm
- Docker + Docker Compose

### Local Setup

```bash
# Clone the repo
git clone https://github.com/your-org/gami-digidouble-core.git
cd gami-digidouble-core

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env
# Fill in your LLM provider API keys and DB credentials

# Start infrastructure
docker compose up -d

# Start the development server
pnpm dev
```

---

## Documentation

| Document | Description |
|---|---|
| [VISION.md](docs/VISION.md) | Project vision and mission |
| [PRINCIPLES.md](docs/PRINCIPLES.md) | 19 guiding principles behind every decision |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | Layered architecture, module map, request flows |
| [DATA_MODEL.md](docs/DATA_MODEL.md) | Entities, schemas, database design |
| [API_CONTRACT.md](docs/API_CONTRACT.md) | Full REST + WebSocket + SSE API specification |
| [GAME_MASTER_CONTRACT.md](docs/GAME_MASTER_CONTRACT.md) | Game Master input/output contract and trigger rules |
| [TECH_STACK.md](docs/TECH_STACK.md) | Technology choices and rationale |
| [EPICS.md](docs/EPICS.md) | Roadmap broken into sprints and epics |
| [TEST_STRATEGY.md](docs/TEST_STRATEGY.md) | Test philosophy, pyramid, and module coverage |
| [PROJECT_STATUS.md](docs/PROJECT_STATUS.md) | Current implementation status |

---

## Roadmap

| Phase | Period | Focus |
|---|---|---|
| **Phase A — MVP** | Apr–Jul 2026 | Core engine: Avatar, Game Master, Memory, API, RAG, Back-office |
| **Phase B — Enhanced** | TBD | Voice, multimedia, multi-scenario/avatars, end-user frontend |
| **Phase C — Pre-research** | TBD | Security, multi-tenancy, scaling, SDKs, research contracts |

See [docs/EPICS.md](docs/EPICS.md) for the detailed sprint breakdown.

---

## Guiding Principles (Summary)

- **Experience First** — technology serves the conversation, not the other way around
- **Orchestration over Generation** — decide before generating; structure creates value
- **Context is the Product** — what you give the LLM defines what you get back
- **LLM-Agnostic Always** — no provider lock-in; adapters are mandatory
- **Keep Core Small** — minimal, focused, stable; UI and tools live outside
- **Measure Everything That Matters** — latency, cost, tokens, retrieval quality, conversation quality

See [docs/PRINCIPLES.md](docs/PRINCIPLES.md) for the full list.
