# Title

Knowledge Domain Models And Persistence Foundation

# Context

EPIC 5.1 requires a unified but typed knowledge substrate. Before ingestion and retrieval behavior can be implemented safely, the project needs stable domain contracts and persistent schema for:

- knowledge sources
- chunks
- ingestion jobs
- type-aware metadata and traceability

# Scope

Implement now:

- finalize domain types for source/chunk/job with explicit `knowledgeType` (`memory | world | media`)
- align DB schema (`knowledge_sources`, `knowledge_chunks`, `ingestion_jobs`) with EPIC needs
- add/extend repository ports and concrete adapters (in-memory + Postgres)
- define indexing strategy for source-type filtering and vector retrieval

Out of scope:

- full ingestion orchestration
- API routes
- context assembly updates

# Relevant Docs

- `docs/DATA_MODEL.md`
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/PRINCIPLES.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/TEST_STRATEGY.md`
- `docs/PROJECT_STATUS.md`

# Implementation Guidance

- Extend `infra/postgres/init.sql` with canonical knowledge tables if missing; keep schema idempotent and aligned with existing bootstrap style.
- Prefer explicit columns over opaque JSON when fields are queried often (`knowledge_type`, `status`, `scenario_id`, timestamps).
- Keep source `format` (pdf/markdown/text/media/etc.) distinct from retrieval `knowledgeType` (`memory|world|media`) to avoid semantic overload.
- Store source and chunk metadata needed for traceability and diagnostics.
- Keep repository interfaces in `application/ports` and adapters in `infrastructure/db/repositories`.
- Add integration tests for Postgres repositories and deterministic unit tests for in-memory adapters.

# Constraints

- Follow modular monolith layering strictly.
- No speculative abstractions beyond EPIC 5.1 requirements.
- Do not introduce new external dependencies unless required by `docs/TECH_STACK.md` constraints.
- Keep migrations/bootstrap consistent with current project DB strategy.

# Deliverables

- updated domain knowledge types
- schema changes for knowledge persistence
- repository interfaces + adapters
- unit + integration tests for repositories

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

- `docs/DATA_MODEL.md`
- `docs/ARCHITECTURE.md`
- `docs/TEST_STRATEGY.md`

If no doc changes are needed, explicitly verify that docs are still accurate.

# Acceptance Criteria

- [ ] Domain knowledge entities support `memory|world|media` classification.
- [ ] Schema supports sources, chunks, and ingestion jobs with traceability fields.
- [ ] Repositories compile and pass unit + integration tests.
- [ ] Query/index strategy exists for type-aware retrieval.
- [ ] Documentation reflects final schema and ownership.
