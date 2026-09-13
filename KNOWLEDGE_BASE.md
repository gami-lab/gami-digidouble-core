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

## Non-negotiables

Core is a TypeScript modular monolith: `API -> Application -> Domain -> Infrastructure`.
Avatar responses are direct; GM and memory work are asynchronous. Provider SDKs stay behind
internal ports. Static knowledge (`avatar_knowledge`, `world`, `media`) is separate from
conversational memory. External input is validated at the API boundary.

Do not duplicate these rules or code-level details here; update the canonical document instead.
