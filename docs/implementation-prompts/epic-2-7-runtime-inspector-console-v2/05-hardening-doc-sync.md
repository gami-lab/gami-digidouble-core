# Hardening, Stack E2E, and Documentation Sync

## Context

EPIC 2.7 spans shared contracts, admin read models, admin actions, SSE consumption, and console
behavior. The last prompt must close the remaining confidence gaps and ensure the repository docs
still describe the shipped system accurately.

This prompt is not a dumping ground for unfinished feature work. It is the final hardening and doc
sync pass after prompts 0–4 are complete.

This pass must also verify that the final implementation stayed DRY: no redundant admin routes, no
parallel local-vs-shared DTO ownership, and no console support left behind for superseded admin
contracts.

## Scope

**In scope:**

- close any missing route, unit, and stack-e2e coverage for the final EPIC 2.7 endpoint surface
- strengthen contract assertions for the new runtime-inspector and admin-action responses
- verify console behavior with focused tests for loading, action errors, and live updates
- update all impacted docs
- run the full mandatory gates

**Out of scope:**

- new feature additions that should have belonged in earlier prompts
- speculative observability redesign beyond what EPIC 2.7 already ships

## Relevant Docs

- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/API_CONTRACT.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
- `docs/PROJECT_STATUS.md`
- `docs/EPICS.md`

## Implementation Guidance

1. Audit the final EPIC 2.7 surface area and confirm each new HTTP endpoint has:
   - route tests
   - a matching `*.stack-e2e.test.ts` file
   - auth coverage
   - validation coverage where the endpoint has input
   - resource-not-found coverage

2. Also audit what was removed or consolidated:
   - delete superseded admin routes that no longer serve a real consumer
   - remove console API clients for superseded routes
   - update docs so the final admin surface is the only documented one

3. Favor consumer-proof assertions:
   - response envelope shape
   - required fields present
   - bounded collection sizes
   - safe semantics for destructive/admin actions
   - emitted event or audit-log effects where relevant

4. Console tests should verify user-observable outcomes:
   - runtime inspector loads and renders the new sections
   - SSE updates produce visible new inspector state
   - admin action failures are surfaced clearly
   - persona edit flow refreshes the displayed data correctly

5. Update documentation as part of the feature, not as a separate afterthought. At minimum review:
   - `docs/PROJECT_STATUS.md`
   - `docs/API_CONTRACT.md`
   - `docs/ARCHITECTURE.md`
   - `docs/DATA_MODEL.md` if admin-action log or memory-clear semantics changed persisted state
   - `docs/TEST_COVERAGE_PLAN.md` if new route modules or action modules were introduced

6. Confirm the EPIC prompt pack itself remains accurate if implementation decisions forced a small
   sequencing or contract change.

7. Run the full gates:
   - `pnpm lint`
   - `pnpm typecheck`
   - `pnpm test`
   - `pnpm test:coverage`
   - `pnpm test:stack-e2e` if the environment is available for this EPIC

## Constraints

- do not use broad brittle snapshots as your main proof
- do not leave docs stale after API or runtime-action changes
- do not silently defer required stack-e2e coverage for new routes
- do not leave superseded admin endpoints documented or wired in the console after consolidation
- keep this prompt focused on hardening and doc closure, not new product scope

## Deliverables

- missing tests filled in across Core and console
- stack-e2e coverage for all new EPIC 2.7 endpoints
- documentation updated and verified
- full build/test gate results captured in the implementation summary/PR

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
- `docs/TEST_COVERAGE_PLAN.md`

If no doc changes are needed, explicitly verify that the docs are still accurate.

## Acceptance Criteria

- [ ] every new EPIC 2.7 endpoint has route tests and a matching `*.stack-e2e.test.ts` file
- [ ] superseded admin routes and duplicated console API clients are removed when no longer needed
- [ ] console tests cover the new inspector’s observable behavior
- [ ] docs match the final shipped contracts and semantics
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm test:coverage` pass
- [ ] `pnpm test:stack-e2e` is run when the environment is available, or explicitly documented as
      unavailable with reason
