# 05 — Hardening, Test Closure, And Documentation Sync

## Context

This final slice closes EPIC 4.2c with full quality gates, regression protection, and documentation as source of truth. The EPIC is not complete unless behavior, tests, and docs all align.

## Scope

Implement now:

- close remaining test gaps from prompts `00` to `04`
- add/adjust stack-e2e coverage for any new endpoints introduced in this EPIC
- run all mandatory gates and fix failures
- perform complete doc review and sync

Out of scope:

- net-new product features beyond EPIC 4.2c
- broad refactors unrelated to memory v3 closure

## Relevant Docs

- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/API_CONTRACT.md`
- `docs/DATA_MODEL.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`

## Implementation Guidance

- Validate behavior-focused tests cover:
  - short-term boundedness
  - periodic working-memory rewrite
  - close -> episodic creation
  - new conversation hydration
  - GM episodic memory usage
  - refresh failure isolation
- If any endpoint was added or changed in this EPIC, ensure stack-e2e files exist and cover:
  - missing API key -> `401`
  - wrong API key -> `401`
  - invalid payload -> `400`
  - unknown resource -> `404`
- Run mandatory gates:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm test`
  - `pnpm test:coverage`

## Constraints

- No test-only implementation hacks.
- Prefer deterministic tests over brittle implementation-mirroring assertions.
- No silent doc drift.
- Keep changes minimal and coherent.

## Deliverables

- completed test suite updates across unit/integration/e2e/stack-e2e as applicable
- all mandatory build gates passing
- synchronized documentation set
- EPIC status closure update

## Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts.
2. Search for duplicated type definitions.
3. Identify canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md` (always required)
- `docs/API_CONTRACT.md`
- `docs/DATA_MODEL.md`
- `docs/ARCHITECTURE.md` (if responsibilities changed)
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/EPICS.md` (progress/checklist updates if relevant)

If no doc changes are needed for any file above, explicitly verify and record that they remain accurate.

## Acceptance Criteria

- [ ] All major EPIC 4.2c behaviors are covered by consumer-observable tests.
- [ ] Any new endpoint has stack-e2e coverage for auth, validation, and not-found.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm test:coverage` all pass.
- [ ] Documentation is updated and consistent with code.
- [ ] EPIC can be closed without hidden known debt.
