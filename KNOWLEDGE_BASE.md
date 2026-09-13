# Repository orientation

This file is a compatibility entry point for agents and contributors. The maintained context map is
[docs/README.md](docs/README.md).

## Fast orientation

- Project identity and boundaries: [docs/VISION.md](docs/VISION.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Decision rules: [docs/PRINCIPLES.md](docs/PRINCIPLES.md)
- Current stack and provider boundaries: [docs/TECH_STACK.md](docs/TECH_STACK.md)
- Public contracts: [docs/API_CONTRACT.md](docs/API_CONTRACT.md)
- Persistence ownership: [docs/DATA_MODEL.md](docs/DATA_MODEL.md)
- Current capabilities/backlog: [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md), [docs/EPICS.md](docs/EPICS.md)
- Testing: [docs/TEST_STRATEGY.md](docs/TEST_STRATEGY.md), [docs/TEST_COVERAGE_PLAN.md](docs/TEST_COVERAGE_PLAN.md)
- Agent workflow: [AGENTS.md](AGENTS.md)

## What never changes

Core coordinates two AI agents behind one API: an **Avatar** (answers the user directly) and a
**Game Master** (an asynchronous director that guides progression without blocking the reply).

- TypeScript modular monolith: `API -> Application -> Domain -> Infrastructure`; no cross-layer shortcuts.
- Avatar responses are direct; GM and memory work are asynchronous and never block the turn.
- LLM/embedding/speech providers stay behind internal ports — never call an SDK from business logic.
- Static knowledge (`avatar_knowledge`, `world`, `media`) is separate from conversational memory.
- External input is validated at the API boundary; responses use the standard `ApiResponse<T>` envelope.
- Work stays within the current epic's scope — do not pull in later-phase features opportunistically.

Do not duplicate these rules or code-level details here; update the canonical document instead.
