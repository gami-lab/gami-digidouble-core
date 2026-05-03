# 05 — Hardening, Stack-E2E, and Documentation Sync

## Context

This final prompt validates EPIC 2.2b end-to-end, closes test confidence gaps, and guarantees docs remain the source of truth.

## Scope

In scope:

- Harden lifecycle edge cases (double close, unknown IDs, invalid reason, race windows).
- Ensure stack-e2e coverage is present and stable for all endpoint behavior introduced/changed by this EPIC.
- Verify no contract drift between core/shared/console after implementation.
- Run full build gates and resolve regressions.
- Complete final documentation sync.

Out of scope:

- New feature expansion beyond EPIC 2.2b.

## Relevant Docs

- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/API_CONTRACT.md`
- `docs/DATA_MODEL.md`
- `docs/ARCHITECTURE.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`

## Implementation Guidance

- Add/strengthen tests to prove behavior, not internals:
  - observable API result
  - state transition
  - persistence effect
  - event/log emission for trigger/failure paths
- For any endpoint introduced/changed, stack-e2e must include:
  - missing API key -> 401
  - wrong API key -> 401
  - invalid payload/params -> 400
  - unknown resource -> 404
  - success path (or explicit TODO skip with dependency note)
- Validate session and conversation lifecycle behavior under repeated operations.
- Keep failure messages and error codes aligned with `ApiResponse<T>` contract.

## Constraints

- No brittle tests tied to private method call chains.
- No docs drift.
- No widening of API surface beyond EPIC intent.

## Deliverables

- Hardened tests (unit/integration/stack-e2e) for lifecycle v2 behavior.
- Final docs updated to match shipped behavior.
- Confirmed green build gates.

## Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts.
2. Search for duplicated type definitions.
3. Identify canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- any outdated impacted docs

Examples:

- `docs/API_CONTRACT.md`
- `docs/DATA_MODEL.md`
- `docs/ARCHITECTURE.md`
- `docs/TEST_STRATEGY.md`

If no doc changes are needed, explicitly verify that docs are still accurate.

## Acceptance Criteria

- [ ] Lifecycle v2 behavior is covered by robust tests at multiple levels.
- [ ] Required stack-e2e coverage exists for endpoint changes.
- [ ] Build gates pass: `pnpm lint`, `pnpm typecheck`, `pnpm test`.
- [ ] Docs accurately describe implemented lifecycle and memory compaction behavior.
- [ ] EPIC progress/status docs are updated.
