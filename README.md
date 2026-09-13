# Gami DigiDouble Core

Gami DigiDouble Core is a headless modular monolith for guided, conversational experiences. It is
a platform layer consumed through HTTP/SSE, not a product application.

The runtime coordinates:

- **Avatar** — responds directly to the user through a persona and bounded context.
- **Game Master** — runs asynchronously to guide progression, routing, and future turns.
- **Memory and knowledge** — preserve useful conversational state and retrieve scenario content.
- **Operations** — expose safe inspection, diagnostics, and recovery actions.

## Current state

Phase A is shipped through the current clean-slate contract. See
[docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) for capabilities and limitations.

## Start locally

Prerequisites: Node.js 22, pnpm, and Docker Compose.

```bash
pnpm install
cp .env.example .env
pnpm infra:up
pnpm dev
```

The API is normally available at `http://localhost:3000`; verify it with:

```bash
curl http://localhost:3000/health
```

For a complete authenticated conversation flow, see [API_GUIDE.md](API_GUIDE.md). The fresh
PostgreSQL bootstrap rule and deployment shape are in
[docs/COOLIFY_DEPLOYMENT_SPECIFICATION.md](docs/COOLIFY_DEPLOYMENT_SPECIFICATION.md).

## Repository map

- `apps/core` — Fastify API and Core runtime.
- `apps/web` — public player UI.
- `apps/admin` — scenario/content authoring UI.
- `apps/console` — local operator/debug UI.
- `packages/shared` — public/shared DTOs and contract helpers.
- `tools/conversation-evaluation` — authenticated scripted evaluation tool.
- `infra` — PostgreSQL/bootstrap and deployment infrastructure.

## Documentation

Start at [docs/README.md](docs/README.md). The durable source-of-truth set is:

- [Principles](docs/PRINCIPLES.md), [architecture](docs/ARCHITECTURE.md), and [tech stack](docs/TECH_STACK.md)
- [API contract](docs/API_CONTRACT.md) and [data model](docs/DATA_MODEL.md)
- [Game Master](docs/GAME_MASTER_CONTRACT.md), [memory](docs/MEMORY_SYSTEM_SPEC.md), and [RAG](docs/RAG_SYSTEM_IMPLEMENTATION.md)
- [test strategy](docs/TEST_STRATEGY.md), [coverage plan](docs/TEST_COVERAGE_PLAN.md), and [project status](docs/PROJECT_STATUS.md)
- [CONTRIBUTING.md](CONTRIBUTING.md) for workflow and commands

Exact fields, schemas, and implementation details belong in TypeScript, route schemas, and
`infra/postgres/init.sql`, not in this README.
