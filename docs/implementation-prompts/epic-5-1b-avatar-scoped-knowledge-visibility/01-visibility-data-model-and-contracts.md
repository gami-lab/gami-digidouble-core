# Title

Add Visibility Metadata To Knowledge Model And Contracts

# Context

EPIC 5.1b requires avatar-scoped knowledge visibility while preserving existing knowledge ingestion/retrieval behavior and backward compatibility. This requires explicit visibility metadata in canonical persistence and contract layers.

# Scope

Implement now:

- define visibility model for knowledge sources/chunks with backward-compatible defaults
- add data model changes and migrations needed to persist visibility metadata
- extend domain contracts and repositories to read/write visibility metadata
- extend API/shared contracts for create/update/read flows where visibility is exposed

Out of scope:

- retrieval filtering logic
- Context Engine behavior changes
- console UI implementation

# Relevant Docs

- `docs/VISION.md`
- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/DATA_MODEL.md`
- `docs/API_CONTRACT.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`

# Implementation Guidance

- keep visibility model lightweight and deterministic (for example: public/shared/private semantics represented through explicit metadata)
- do not build a generic ACL engine; store only fields required for EPIC 5.1b behavior
- ensure existing rows and old payloads remain valid through default visibility behavior
- update repository query contracts to carry visibility metadata end to end
- if endpoint schemas are changed, update shared DTOs first, then route validation/schema mapping
- include migration tests or repository integration tests validating defaults on legacy records

# Constraints

- preserve backward compatibility for existing knowledge endpoints and data
- no cross-layer shortcuts
- KISS, YAGNI, DRY
- TypeScript strict mode only
- explicit contracts and deterministic defaults

# Deliverables

- migration(s) adding visibility metadata to canonical persistence model
- updated domain/repository contracts for visibility fields
- shared/API contract updates for visibility representation
- tests covering default visibility compatibility and serialization

# Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts.
2. Search for duplicated type definitions.
3. Identify canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

# Mandatory Final Step - Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- any outdated impacted docs

Examples:

- `docs/API_CONTRACT.md`
- `docs/DATA_MODEL.md`
- `docs/ARCHITECTURE.md`
- `docs/TEST_STRATEGY.md`

If no doc changes are needed, explicitly verify that docs are still accurate.

# Acceptance Criteria

- [ ] Canonical data model persists visibility metadata with deterministic defaults.
- [ ] Existing knowledge records remain valid without manual backfill operations.
- [ ] API/shared contracts and validation are aligned and drift-free.
- [ ] Repository and contract tests cover default and explicit visibility cases.
- [ ] `docs/PROJECT_STATUS.md` and impacted model/contract docs are updated.
