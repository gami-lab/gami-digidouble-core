# Title

Hardening, Coverage, and Documentation Sync

# Context

Final slice to lock EPIC 2.1b quality. Ensure Avatar v2 behavior is regression-safe, contract-safe, and documented.

# Scope

In scope:

- close remaining unit/integration/e2e gaps for Avatar v2
- add stack-e2e tests for any new endpoints introduced in prior slices
- run full validation gates and resolve failures
- synchronize all impacted docs

Out of scope:

- new features
- large refactors unrelated to test/doc stabilization

# Relevant Docs

- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/API_CONTRACT.md`
- `docs/PROJECT_STATUS.md`
- `docs/ARCHITECTURE.md`

# Implementation Guidance

- Add deterministic unit tests first for prompt/context assembly policy behavior.
- Add integration tests for repository/adapter collaboration boundaries.
- Add/extend e2e tests for send-message behavior and contract shape.
- If new endpoints exist, enforce stack-e2e coverage with auth/validation/not-found/happy-path checks.
- Run: lint, typecheck, unit tests, coverage, and relevant integration/e2e suites.

# Constraints

- Avoid brittle tests based on exact LLM prose.
- Assert on structure, contract fields, and policy-relevant behavior.
- Keep test tier boundaries (`*.test.ts`, `*.integration.test.ts`, `*.e2e.test.ts`, `*.stack-e2e.test.ts`) strict.

# Deliverables

- Complete test coverage additions for EPIC 2.1b risks.
- Green validation command outputs.
- Updated docs reflecting final behavior and contract changes.

# Mandatory Stack E2E Rule

For every endpoint added during EPIC 2.1b, include corresponding `*.stack-e2e.test.ts` coverage.

Minimum required assertions:

- unauthorized request rejected
- validation errors returned with expected envelope
- invalid or unknown ids return correct not-found/error semantics
- happy path returns expected envelope + payload shape

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

- [ ] EPIC 2.1b test additions cover deterministic behavior and contract surfaces.
- [ ] Any new endpoint has `*.stack-e2e.test.ts` coverage.
- [ ] Validation gates are green.
- [ ] Documentation is updated and consistent with code.
