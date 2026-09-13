# Agent instructions

These instructions apply to AI coding agents working in Gami DigiDouble Core. Read
[docs/README.md](docs/README.md) and the relevant source-of-truth docs before changing code.

Core coordinates two AI agents behind one API: an **Avatar** (answers the user directly) and a
**Game Master** (an asynchronous director that guides progression without blocking the reply). See
[docs/VISION.md](docs/VISION.md) for the product framing.

## Think before coding

- State assumptions and success criteria. If multiple interpretations exist, present them instead
  of picking silently. If something is unclear, stop and ask rather than guessing.
- Prefer the smallest solution that satisfies the request: no speculative features, no
  abstractions for single-use code, no "flexibility" that wasn't requested, no error handling for
  impossible scenarios. If it could be half the size, rewrite it.
- Make surgical changes and preserve unrelated user work. Do not reformat or refactor adjacent code
  without a direct reason, even if you'd have written it differently. If you notice unrelated dead
  code, mention it — don't delete it unless your own change made it unused.
- Turn the task into a verifiable goal before starting, e.g. "fix the bug" becomes "write a test
  that reproduces it, then make it pass." For a multi-step change, state a short plan
  (`step -> verify`) and check off each step as you go.

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
- We are prototyping: never preserve backward compatibility for its own sake. Every deploy wipes and
  recreates the database from scratch, so there is no data or contract continuity to protect. Change
  API shapes, schemas, and internal contracts freely when it simplifies the design — do not add
  migrations, versioned fields, dual-write paths, or deprecated-but-kept code to ease a transition.
  Update the same change's docs/tests instead. This will change once a phase requires durable data
  across deploys.

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
- Protect API contracts aggressively: any endpoint shape change requires updating
  [docs/API_CONTRACT.md](docs/API_CONTRACT.md) in the same change.

## Workflow and git

1. Check [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) and work within the scope of the
   targeted [docs/EPICS.md](docs/EPICS.md) item — do not pull in later-phase work opportunistically
   (see the roadmap phases in [docs/VISION.md](docs/VISION.md)).
2. Implement the minimal change with tests.
3. Run the narrowest relevant checks, then format/lint/typecheck/test/build as appropriate.
4. Review `git diff`, `git diff --check`, and `git status` before handoff.
5. Update [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md) when a feature or epic is completed —
   not for every commit.

Use Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`), with an epic
reference when applicable. Never commit secrets, `.env` files, or generated artifacts. Use
`apply_patch` for local file edits and preserve pre-existing changes.
