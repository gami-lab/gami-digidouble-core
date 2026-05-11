# Title

Typed Ingestion Pipeline And Job Lifecycle

# Context

With persistence and contracts in place, EPIC 5.1 needs executable ingestion behavior so sources become retrievable chunks. This slice builds the ingestion workflow with explicit job states and failure isolation.

# Scope

Implement now:

- source registration flow for text/markdown/pdf/media metadata
- ingestion job lifecycle (`queued -> running -> completed | failed`)
- chunking and preprocessing pipeline (type-aware where relevant)
- embeddings generation via existing provider abstraction
- chunk persistence with source linkage and metadata
- safe retry behavior for failed jobs

Out of scope:

- final retrieval ranking policy
- console UX
- broad context-engine merge rules (EPIC 5.2)

# Relevant Docs

- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/PRINCIPLES.md`
- `docs/DATA_MODEL.md`
- `docs/TEST_STRATEGY.md`
- `docs/PROJECT_STATUS.md`

# Implementation Guidance

- Keep ingestion orchestration in Application use cases/services.
- Keep chunking/embedding provider calls behind infrastructure abstraction ports.
- Ensure failures are captured in `ingestion_jobs` without crashing message flow.
- Preserve idempotency where practical (avoid duplicate chunk sets for same source/job run).
- Add observability events for ingestion start/completion/failure with correlation IDs.
- For media inputs in v1, support metadata ingestion and retrievable references even if deep multimodal embedding quality is deferred.

# Constraints

- Async-safe and non-blocking behavior for runtime conversation path.
- No direct provider SDK calls from Domain/Application business logic.
- KISS: build minimal reliable pipeline before optimization.
- Strict typing for job states and error payloads.

# Deliverables

- ingestion use cases/services
- chunking + embedding flow wired through adapters
- ingestion status persistence and retry mechanism
- tests covering success/failure/retry and idempotency behavior

# Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts.
2. Search for duplicated type definitions.
3. Identify canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

# Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- any outdated impacted docs

Examples:

- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
- `docs/TEST_STRATEGY.md`

If no doc changes are needed, explicitly verify that docs are still accurate.

# Acceptance Criteria

- [ ] Ingestion can process supported source types into persisted chunks.
- [ ] Job status transitions are explicit, persisted, and test-covered.
- [ ] Failure and retry behavior are deterministic and isolated.
- [ ] Embeddings are generated through abstraction layer only.
- [ ] Observability events exist for ingestion lifecycle.
- [ ] Documentation reflects ingestion lifecycle behavior.
