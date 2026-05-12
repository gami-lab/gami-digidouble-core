# Title

Contract Cleanup Before Avatar v2

# Context

EPIC 2.1b touches `Avatar`, `Session`, `Conversation`, memory, typed retrieval, and runtime inspection contracts. The current codebase already spans domain types, shared DTO types, and console adapter types. Feature work must not start on duplicated or drifting contracts.

# Scope

In scope:

- map touched contracts for Avatar v2 context inputs and outputs
- remove duplicated type definitions and inline response shapes
- establish canonical ownership for each contract
- normalize nullability and field naming across layers

Out of scope:

- changing Avatar behavior
- adding retrieval logic
- adding new endpoints

# Relevant Docs

- `docs/EPICS.md`
- `docs/ARCHITECTURE.md`
- `docs/PRINCIPLES.md`
- `docs/API_CONTRACT.md`
- `docs/DATA_MODEL.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/TEST_STRATEGY.md`

# Implementation Guidance

- Inspect and catalog contract definitions in:
  - `apps/core/src/domain/**`
  - `apps/core/src/application/**`
  - `apps/core/src/api/routes/**`
  - `packages/shared/src/**`
  - `apps/console/src/**`
- For Avatar-v2-adjacent contracts, identify the canonical owner (domain-internal vs shared HTTP DTO).
- Replace local copies/inline shapes with imports from canonical contract modules.
- Normalize field names and optionality (`undefined` internally, explicit `null` only where API contracts require it).
- Keep changes surgical and backward-compatible.

# Constraints

- Respect API -> Application -> Domain -> Infrastructure boundaries.
- Keep refactor behavior-neutral.
- No speculative abstractions.
- Do not add feature behavior in this slice.

# Deliverables

- Canonical contract ownership map for Avatar v2 touched entities.
- Duplicated type definitions removed/refactored.
- Updated imports using shared canonical contracts.
- Green lint/typecheck/tests.

# Mandatory Stack E2E Rule

If this slice adds any new HTTP endpoint, add at least one corresponding `*.stack-e2e.test.ts` file that validates:

- auth behavior
- request validation behavior
- not-found or invalid-id behavior
- happy-path response envelope and shape

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

- [ ] No new contract duplication is introduced.
- [ ] Avatar-v2 touched contracts have canonical ownership.
- [ ] Internal vs API nullability is consistent.
- [ ] Console/API/shared contract drift is reduced.
- [ ] Behavior remains unchanged in this slice.
- [ ] Any new endpoint has matching `*.stack-e2e.test.ts` coverage.
