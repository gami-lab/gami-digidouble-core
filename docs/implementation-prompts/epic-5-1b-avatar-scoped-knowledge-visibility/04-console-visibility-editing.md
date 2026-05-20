# Title

Add Console Support For Knowledge Visibility Management

# Context

EPIC 5.1b includes admin-facing visibility management so operators can control avatar-scoped knowledge behavior without direct database edits.

# Scope

Implement now:

- add console workflows to view and edit visibility metadata for knowledge sources/chunks where supported by API
- align console request/response typing with canonical shared DTO ownership
- surface visibility state clearly in existing knowledge admin flows (registration, ingestion status, retrieval diagnostics)
- preserve backward compatibility for records with default visibility

Out of scope:

- redesign of unrelated admin sections
- non-admin end-user UI
- adding policy semantics not defined in EPIC 5.1b

# Relevant Docs

- `docs/ARCHITECTURE.md`
- `docs/API_CONTRACT.md`
- `docs/PRINCIPLES.md`
- `docs/TECH_STACK.md`
- `docs/TEST_STRATEGY.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`

# Implementation Guidance

- keep UI changes surgical in existing knowledge/admin surfaces
- avoid local duplicated DTOs in console; import shared contracts
- include validation and user feedback for invalid visibility edits
- add component/unit tests for visibility form state and API mapping where existing test patterns support this
- ensure runtime inspector views render visibility diagnostics consistently with backend payload shape

# Constraints

- preserve current console architecture and patterns
- no implicit API shape assumptions; rely on shared contracts
- no visual overengineering
- strict TypeScript typing

# Deliverables

- console forms/views for visibility metadata
- typed API adapter updates using shared contracts
- tests covering console mapping and edit flows

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
- `docs/TEST_STRATEGY.md`

If no doc changes are needed, explicitly verify that docs are still accurate.

# Acceptance Criteria

- [ ] Console can inspect and edit visibility metadata for supported knowledge entities.
- [ ] Console DTO usage is canonical and duplication-free.
- [ ] Visibility defaults are handled correctly for legacy records.
- [ ] Console tests cover critical visibility edit behavior.
- [ ] `docs/PROJECT_STATUS.md` is updated.
