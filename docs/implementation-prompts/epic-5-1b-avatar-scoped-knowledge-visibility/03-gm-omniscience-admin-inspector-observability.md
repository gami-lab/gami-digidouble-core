# Title

Preserve GM Omniscience And Add Visibility Diagnostics

# Context

EPIC 5.1b requires asymmetric behavior: avatars are filtered, Game Master is unrestricted. Operators must be able to inspect visibility outcomes and reason about inclusion/exclusion safely.

# Scope

Implement now:

- ensure GM retrieval/context paths bypass avatar visibility restrictions while still using typed retrieval contracts
- update admin inspection and retrieval diagnostics payloads to expose visibility metadata and exclusion reasons in bounded form
- align observability events/metrics so visibility filtering can be audited without exposing sensitive source content
- ensure API/admin DTOs remain canonical and shared

Out of scope:

- console form/edit flows
- new retrieval ranking strategies
- non-essential endpoint redesign

# Relevant Docs

- `docs/ARCHITECTURE.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/API_CONTRACT.md`
- `docs/PRINCIPLES.md`
- `docs/TEST_STRATEGY.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`

# Implementation Guidance

- keep GM non-blocking execution unchanged
- treat GM as omniscient by contract: visibility filters apply to avatar-facing context only
- if admin endpoint response shapes change, update shared DTO ownership first
- include deterministic integration tests for inspector/admin diagnostics and redaction boundaries
- if this slice introduces any new endpoint, create a same-slice `*.stack-e2e.test.ts` file following route naming convention and mandatory coverage rules

# Constraints

- respect existing API envelope and error code conventions
- no exposure of raw private knowledge content in diagnostics payloads
- no cross-layer DTO duplication
- strict typing only

# Deliverables

- GM retrieval path explicitly unrestricted relative to avatar visibility
- inspector/admin diagnostics exposing visibility-aware metadata
- observability updates for visibility filtering/exclusions
- tests proving GM omniscience + avatar filtering asymmetry

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
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/ARCHITECTURE.md`
- `docs/TEST_STRATEGY.md`

If no doc changes are needed, explicitly verify that docs are still accurate.

# Acceptance Criteria

- [ ] GM context retrieval is unrestricted and verified by tests.
- [ ] Avatar visibility filtering remains enforced.
- [ ] Inspector/admin diagnostics clearly explain inclusion/exclusion without sensitive leakage.
- [ ] Any new endpoint includes mandatory `*.stack-e2e.test.ts` coverage.
- [ ] `docs/PROJECT_STATUS.md` is updated for this slice.
