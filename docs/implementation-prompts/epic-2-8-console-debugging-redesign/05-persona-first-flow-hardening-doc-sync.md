# Persona-First Flow, Cleanup Completion, And Hardening

## Context

Persona is currently not on the main debugging path. This final slice makes persona setup first-class, removes remaining leftovers, and closes quality/documentation gates for the full redesign.

## Scope

Implement now:

- Move persona setup into session start or immediate pre-session path.
- Ensure persona state is clearly visible and editable at the start of debugging.
- Remove remaining deprecated UI leftovers identified earlier.
- Complete hardening tests and full documentation synchronization.

Out of scope:

- New persona policy/modeling changes beyond existing API contract.

## Relevant Docs

- docs/VISION.md
- docs/PRINCIPLES.md
- docs/ARCHITECTURE.md
- docs/API_CONTRACT.md
- docs/TEST_STRATEGY.md
- docs/TEST_COVERAGE_PLAN.md
- docs/EPICS.md
- docs/PROJECT_STATUS.md

## Implementation Guidance

- Keep persona flow obvious and unavoidable for the normal debug start path.
- Ensure persona changes are reflected in subsequent inspector/context views.
- Remove dead components/hooks/routes introduced by previous console iterations.
- Run full quality gates and close any flaky behavior introduced by redesign.

## Constraints

- Keep final flow simple and explicit.
- Avoid introducing alternate persona flows.
- Maintain contract ownership discipline and bounded API usage.

## Deliverables

- Persona-first start flow in console.
- Final leftover cleanup PR delta.
- Comprehensive test updates for redesigned flow.
- Full doc sync and EPIC completion update.

## Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts.
2. Search for duplicated type definitions.
3. Identify canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- docs/PROJECT_STATUS.md
- docs/API_CONTRACT.md
- docs/ARCHITECTURE.md
- docs/TEST_STRATEGY.md
- docs/TEST_COVERAGE_PLAN.md
- docs/EPICS.md (if sequencing or status markers changed)

If no doc changes are needed for any file above, explicitly verify each remains accurate.

## Acceptance Criteria

- [ ] Persona setup is integrated into the primary debug start flow.
- [ ] Remaining stale/duplicate UI paths are removed.
- [ ] Redesigned console behavior is covered by tests.
- [ ] Mandatory gates pass: pnpm lint, pnpm typecheck, pnpm test (and coverage when available).
- [ ] Documentation is fully synchronized and EPIC status is explicit.
