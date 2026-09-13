# Agent instructions

These instructions apply to AI coding agents working in Gami DigiDouble Core. Read
[docs/README.md](docs/README.md) and the relevant source-of-truth docs before changing code.

## Think before coding

- State assumptions and success criteria. Surface ambiguity or meaningful trade-offs before acting.
- Prefer the smallest solution that satisfies the request. Do not add speculative features, abstractions, dependencies, or error paths.
- Make surgical changes and preserve unrelated user work. Do not reformat or refactor adjacent code without a direct reason.
- For a multi-step change, state a short plan and verify each step.

## Project boundaries

Core is a headless platform layer, not an application. It is a TypeScript strict-mode modular
monolith with this direction:

`API -> Application -> Domain -> Infrastructure`

- API owns authentication, input validation, route schemas, mapping, and serialization.
- Application owns use cases, orchestration order, transactions, and ports.
- Domain owns entities, policies, deterministic selection, and typed failures.
- Infrastructure owns PostgreSQL/pgvector, Redis, provider adapters, and observability implementations.

`packages/shared` owns public/shared DTOs. Frontend apps and tools consume HTTP/SSE and do not import
Core domain or infrastructure modules.

## Non-negotiables

- Runtime: Node.js LTS, strict TypeScript, pnpm workspaces, Turborepo.
- API: Fastify. Validate every external input at the API boundary.
- Persistence: PostgreSQL/pgvector and Redis; do not add another datastore without measured need.
- LLM, embedding, speech, and TTS providers are accessed only through internal ports/adapters.
- Avatar responds directly. Game Master and memory maintenance are asynchronous and must not block the normal turn.
- Keep static knowledge separate from conversational memory.
- Keep diagnostics bounded; never expose secrets, raw prompts, provider payloads, raw vectors, raw audio, or unbounded transcripts.
- Do not add LangChain/LangGraph or microservices to Phase A without explicit architectural approval.

## Required documentation checks

- Architecture/module/flow change: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Design decision: [docs/PRINCIPLES.md](docs/PRINCIPLES.md)
- Schema/repository change: [docs/DATA_MODEL.md](docs/DATA_MODEL.md)
- API change: [docs/API_CONTRACT.md](docs/API_CONTRACT.md)
- GM change: [docs/GAME_MASTER_CONTRACT.md](docs/GAME_MASTER_CONTRACT.md)
- Stack/dependency change: [docs/TECH_STACK.md](docs/TECH_STACK.md)
- Test change: [docs/TEST_STRATEGY.md](docs/TEST_STRATEGY.md) and [docs/TEST_COVERAGE_PLAN.md](docs/TEST_COVERAGE_PLAN.md)
- Shipped/backlog change: [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) and [docs/EPICS.md](docs/EPICS.md)

Update only the durable document affected by the change. Keep implementation history in commits,
tests, and CI rather than copying it into docs.

## Testing

- Unit-test domain logic deterministically with no provider calls.
- Integration-test repositories, adapters, and application composition.
- Use E2E only for critical user flows; use stack E2E for real infrastructure boundaries.
- Test contracts, ownership, ordering, redaction, and failure handling—not writing quality.
- Every bug fix gets a regression test at the boundary that exposed it.

## Workflow and git

1. Check current status and relevant epic.
2. Implement the minimal change with tests.
3. Run the narrowest relevant checks, then format/lint/typecheck/test/build as appropriate.
4. Review `git diff`, `git diff --check`, and `git status` before handoff.

Use Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`), with an epic
reference when applicable. Never commit secrets, `.env` files, or generated artifacts. Use
`apply_patch` for local file edits and preserve pre-existing changes.
