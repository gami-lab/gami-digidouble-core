# Harden the inspector test matrix

## Context

Once the inspector surface is consolidated, the tests need to prove that there is one clean path and no stale compatibility behavior left behind. EPIC 3.2 is an admin/console contract change, so the test suite should protect the surviving routes and delete coverage that only existed for redundant paths.

## Scope

**In scope:**

- update unit tests for any consolidated backend inspector mapping or shared DTO ownership
- update console tests for the single inspector flow
- update route tests for surviving admin session-inspection endpoints
- remove stale tests for removed compatibility routes or wrappers
- keep or update existing stack-E2E coverage only where the surviving HTTP routes require it
- add redaction assertions so inspector responses do not leak raw prompt content or credentials

**Out of scope:**

- product-polish work
- new inspector features beyond the final clean path
- test-only snapshots that do not verify the actual contract

## Relevant Docs

- `docs/TEST_STRATEGY.md` - unit, E2E, stack-E2E, and admin contract expectations
- `docs/API_CONTRACT.md` - final HTTP shapes that tests must protect
- `docs/EPICS.md` - EPIC 3.2 definition
- `docs/PROJECT_STATUS.md` - baseline and completion reporting

## Implementation Guidance

1. Review the surviving inspector surface and the deleted compatibility paths before writing tests.

2. Update unit tests to assert the consumer contract, not the implementation detail. Focus on:
   - canonical session-inspector DTO ownership
   - clean not-found behavior
   - bounded event/memory/context payloads
   - no leaked prompt internals or credentials

3. Update or remove route tests that refer to old inspector wrappers. If a route was removed, its tests should go away with it.

4. For stack-E2E coverage:
   - keep auth enforcement, schema validation, and not-found coverage for any surviving admin route
   - if the EPIC unexpectedly requires a new endpoint after the audit, add the required `*.stack-e2e.test.ts` immediately in the same slice
   - otherwise do not create a new stack-E2E file just to satisfy process

5. Make sure the final test set reflects the clean architecture rather than preserving old compatibility behavior.

## Constraints

- no brittle snapshot-only verification of inspector payloads
- do not keep tests for routes or wrappers that were intentionally removed
- do not invent a new endpoint just because test coverage would be convenient
- KISS: fewer tests, clearer assertions, stronger contract coverage

## Deliverables

- updated unit tests for the canonical inspector flow
- updated or removed route tests for the final surface
- updated stack-E2E coverage where needed
- redaction and bounded-payload assertions for inspector responses

## Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts.
2. Search for duplicated type definitions.
3. Identify canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

## Mandatory Final Step - Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- `docs/TEST_STRATEGY.md` if any test-tier expectations or stack-E2E assumptions changed
- `docs/API_CONTRACT.md` if the contract shape changed

If no doc changes are needed, explicitly verify that the docs are still accurate.

## Acceptance Criteria

- [ ] unit tests cover the final canonical inspector flow
- [ ] stale compatibility tests are removed with the code they protected
- [ ] surviving admin routes have the required auth / validation / not-found coverage
- [ ] redaction assertions confirm no raw prompt or credential leakage
- [ ] `pnpm test` passes
