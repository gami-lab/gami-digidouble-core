# Title

Contract Cleanup For Knowledge And Retrieval Ownership

# Context

EPIC 5.1 introduces new contracts across Domain, Application, API, Infrastructure, and Console for knowledge sources, chunks, ingestion jobs, and retrieval outputs. The codebase already has multiple context-related shapes and partial knowledge typing, so implementing features first would increase contract drift.

This slice creates canonical ownership before behavior changes.

# Scope

Implement now:

- inventory all touched contracts for this EPIC (knowledge source, chunk, ingestion job, retrieval result, context injection DTO)
- detect duplicated type definitions and inline response shapes across `apps/core`, `apps/console`, and `packages/shared`
- establish canonical ownership map:
  - domain-internal types in `apps/core/src/domain/**`
  - HTTP/shared DTOs in `packages/shared/src/**`
- refactor obvious duplicates before adding fields/endpoints

Out of scope:

- ingestion logic
- retrieval ranking logic
- endpoint functional behavior changes

# Relevant Docs

- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/DATA_MODEL.md`
- `docs/API_CONTRACT.md`
- `docs/TEST_STRATEGY.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`

# Implementation Guidance

- Audit existing ownership patterns used by entity summaries and inspector DTOs in `packages/shared/src`.
- Normalize knowledge-domain typing to match EPIC language (`memory`, `world`, `media`) and avoid parallel unions across layers.
- Remove route-local inline response shapes in favor of shared exported DTOs where payloads are API-facing.
- Keep internal infrastructure records separate from public DTOs; map explicitly at API boundaries.
- Add a short ownership note in the relevant type files to prevent reintroduction of local copies.

# Constraints

- Respect API -> Application -> Domain -> Infrastructure boundaries.
- KISS, YAGNI, DRY.
- Preserve backward compatibility for existing endpoints.
- TypeScript strict mode only (`no any`, no implicit contracts).

# Deliverables

- canonical knowledge/retrieval contract map
- duplicate shape cleanup commit
- updated type imports/usages across touched modules
- tests adjusted for renamed/centralized contracts

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

- `docs/API_CONTRACT.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
- `docs/TEST_STRATEGY.md`

If no doc changes are needed, explicitly verify that docs are still accurate.

# Acceptance Criteria

- [ ] No duplicated API-facing knowledge/retrieval DTO remains in touched modules.
- [ ] Canonical ownership is explicit and consistently used.
- [ ] Typecheck remains strict-clean.
- [ ] Existing endpoint behavior is unchanged by cleanup.
- [ ] `docs/PROJECT_STATUS.md` is updated.
