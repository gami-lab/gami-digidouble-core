# Title

Hardening, Coverage Closure, And Full Documentation Sync

# Context

EPIC 5.1b introduces sensitive behavioral guarantees (privacy boundaries, deterministic filtering, GM omniscience). This final slice consolidates testing and documentation to prevent regressions and contract drift.

# Scope

Implement now:

- close missing test coverage across domain, integration, stack-e2e, and console slices touched by EPIC 5.1b
- verify deterministic behavior for avatar visibility filtering and GM unrestricted access
- add regression tests for avatar switching visibility scope changes
- add/complete stack-e2e tests for any endpoint introduced by this EPIC
- run quality gates and resolve failures in touched areas
- fully synchronize docs with implemented behavior

Out of scope:

- introducing new product features
- broad refactors unrelated to EPIC 5.1b outcomes

# Relevant Docs

- `docs/VISION.md`
- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/DATA_MODEL.md`
- `docs/API_CONTRACT.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`

# Implementation Guidance

- ensure each new endpoint created in this EPIC has a route-level `*.stack-e2e.test.ts` file
- minimum stack-e2e checks per new endpoint:
  - missing/wrong API key -> `401`
  - invalid payload/path -> `400`
  - unknown resource ID -> `404` with correct `ApiResponse` error code
- when happy-path seeding is blocked, keep a clearly marked skipped test with an EPIC-specific TODO and still cover auth/validation/not-found
- run and record relevant gates for touched modules (lint, typecheck, unit, integration, stack-e2e)
- update docs as product truth, not as optional postscript

# Constraints

- docs, code, and tests must ship together
- no endpoint contract drift
- no reduction in safety/observability coverage
- keep fixes scoped to EPIC 5.1b behavior

# Deliverables

- completed test matrix across touched layers
- stack-e2e files for new endpoints (if any)
- quality-gate evidence captured in final PR/task notes
- synchronized documentation, especially status, contracts, and data model references

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
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/TEST_STRATEGY.md`

If no doc changes are needed, explicitly verify that docs are still accurate.

# Acceptance Criteria

- [ ] All EPIC 5.1b behavior is covered by deterministic tests at appropriate layers.
- [ ] Every new endpoint has mandatory stack-e2e auth/validation/not-found coverage.
- [ ] Avatar privacy boundaries and GM omniscience are regression-protected.
- [ ] Quality gates pass for touched modules.
- [ ] `docs/PROJECT_STATUS.md` and all impacted docs are synchronized and accurate.
