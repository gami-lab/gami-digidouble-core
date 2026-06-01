# Tests, Hardening, and Docs Sync

## Context

The public web app is only complete if it is covered by focused tests and the repository documentation is updated to reflect the new product surface.

This final slice should close the loop on reliability, browser persistence, current-chat-only behavior, and documentation discipline.

## Scope

Add the tests and final hardening needed to finish the web app EPIC.

In scope:

- unit or component tests for onboarding and identity persistence
- tests for scenario selection and avatar filtering
- tests for optimistic send and processing state
- tests for no-old-chat visibility
- any missing integration coverage for the public web client
- documentation updates after implementation
- `docs/PROJECT_STATUS.md` update
- any impacted architecture, API, or testing docs update

Out of scope:

- major redesign of the UI
- new product features beyond the EPIC scope
- unrelated backend refactors

## Relevant Docs

- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/ARCHITECTURE.md`
- `docs/API_CONTRACT.md`
- `docs/DATA_MODEL.md`
- `docs/PRINCIPLES.md`

## Implementation Guidance

- Test the consumer-observable behavior of the web app, not just implementation details.
- Keep fixtures small and explicit.
- Use deterministic tests for local storage, identity transitions, scenario selection, and chat state rendering.
- If a new endpoint was introduced earlier in the EPIC, ensure the required stack-e2e coverage exists in the backend route directory.
- Verify that any new or modified contract is represented in the shared source of truth rather than copied into the web app.
- Finish by updating documentation so the repo remains the source of truth.

## Constraints

Respect the current architecture, KISS, YAGNI, DRY, and backward compatibility. Do not merge debug-only console behavior into the public app. Do not leave docs stale after code changes.

## Deliverables

- tests covering the public onboarding flow
- tests covering scenario and avatar discovery
- tests covering optimistic messaging and processing state
- tests proving old chats are not exposed
- updated docs reflecting the completed web app work

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

If the work changed public behavior, runtime assumptions, or test strategy, update the relevant documentation explicitly.

## Acceptance Criteria

- [ ] public web app tests cover identity persistence and reset
- [ ] tests cover scenario selection and avatar visibility filtering
- [ ] tests cover current-chat-only behavior
- [ ] tests cover optimistic send and processing state
- [ ] docs are reviewed and updated after implementation
- [ ] `docs/PROJECT_STATUS.md` is updated
- [ ] no duplicate contract shapes were introduced during implementation
