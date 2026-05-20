# Title

Contract Cleanup For Avatar-Scoped Knowledge Visibility

# Context

EPIC 5.1b touches existing models and contracts across knowledge retrieval, avatar context assembly, inspector payloads, and console admin DTOs. The same entities already appear across multiple layers, so adding visibility fields without cleanup risks contract drift.

This slice prevents duplication before feature behavior is added.

# Scope

Implement now:

- identify all touched entities and contracts: avatar, scenario, session context DTOs, knowledge source/chunk contracts, retrieval result contracts, inspector/admin DTOs
- locate duplicated type definitions and inline response/request shapes in core routes, use cases, console API adapters, and shared package exports
- define canonical ownership for each touched contract:
  - domain-internal contracts in core domain modules
  - HTTP/shared DTOs in shared package
- remove or consolidate obvious duplicates before adding new visibility fields

Out of scope:

- schema migration behavior
- retrieval filtering implementation
- console UI changes

# Relevant Docs

- `docs/VISION.md`
- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/DATA_MODEL.md`
- `docs/API_CONTRACT.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/TEST_STRATEGY.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`

# Implementation Guidance

- start from the existing EPIC 5.1 ownership conventions and extend them, do not fork parallel shapes
- prefer additive shared DTO changes rather than route-local interfaces
- keep nullability policy consistent: internal optional values stay `undefined`; expose `null` only when API contract explicitly requires it
- preserve clear boundary mapping at API layer (domain/internal to shared/API DTO)
- include a compact ownership note in touched contract files if ownership is not already obvious

# Constraints

- respect API -> Application -> Domain -> Infrastructure boundaries
- keep changes minimal and directly tied to EPIC 5.1b
- no speculative ACL framework or graph model
- TypeScript strict mode only
- backward compatibility required

# Deliverables

- contract ownership inventory for touched entities
- duplicate contract cleanup in touched modules
- canonical shared exports for API-facing visibility contracts (or explicit confirmation none are needed yet)
- updated imports/usages after deduplication

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
- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
- `docs/TEST_STRATEGY.md`

If no doc changes are needed, explicitly verify that docs are still accurate.

# Acceptance Criteria

- [ ] No duplicated API-facing visibility-related contract remains in touched code.
- [ ] Canonical ownership is explicit for every touched contract.
- [ ] Typecheck remains strict-clean after cleanup.
- [ ] No functional behavior changes are introduced in this slice.
- [ ] `docs/PROJECT_STATUS.md` reflects this cleanup progress.
