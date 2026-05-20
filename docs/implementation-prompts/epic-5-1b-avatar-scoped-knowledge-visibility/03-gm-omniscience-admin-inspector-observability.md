# Title

Preserve GM Omniscience And Add Visibility Diagnostics

# Context

EPIC 5.1b requires asymmetric visibility behavior:

- avatars are filtered
- Game Master is unrestricted

Operators must be able to inspect visibility decisions safely and deterministically.

# Scope

Implement now:

- ensure GM retrieval/context paths bypass avatar visibility filtering
- expose bounded visibility diagnostics in admin/runtime inspection flows
- align observability metadata with visibility filtering decisions
- preserve canonical shared DTO ownership

Out of scope:

- console form/edit flows
- retrieval ranking redesign
- endpoint redesign unrelated to visibility diagnostics

# Relevant Docs

- `docs/ARCHITECTURE.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/API_CONTRACT.md`
- `docs/PRINCIPLES.md`
- `docs/TEST_STRATEGY.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`

# Implementation Guidance

- GM visibility is unrestricted by contract
- avatar visibility filtering applies only to avatar-facing context assembly
- keep GM async/non-blocking behavior unchanged
- diagnostics must expose bounded inclusion/exclusion reasoning without leaking sensitive content
- if API/admin DTOs change, update shared contract ownership first
- preserve existing API envelope and error conventions

# Constraints

- no raw private knowledge leakage in diagnostics
- no DTO duplication across layers
- strict typing only
- avoid unrelated observability redesign

# Deliverables

- unrestricted GM retrieval path
- visibility-aware runtime/admin diagnostics
- observability metadata for visibility decisions
- tests proving avatar filtering + GM omniscience asymmetry

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
- impacted documentation

Examples:

- `docs/API_CONTRACT.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/ARCHITECTURE.md`
- `docs/TEST_STRATEGY.md`

If no doc changes are needed, explicitly verify docs remain accurate.

# Acceptance Criteria

- [ ] GM retrieval remains unrestricted and verified by tests.
- [ ] Avatar visibility filtering remains enforced.
- [ ] Diagnostics explain inclusion/exclusion decisions safely.
- [ ] Visibility metadata does not leak sensitive knowledge content.
- [ ] `docs/PROJECT_STATUS.md` reflects this slice.
