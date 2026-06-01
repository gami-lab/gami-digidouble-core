# Scenario and Avatar Discovery

## Context

After the user has a local identity, the public web app must let them choose a scenario and see only the avatars that are currently available for that scenario. Hidden avatars must remain hidden until the Game Master makes them available.

This slice connects the onboarding state to the first meaningful product interaction.

## Scope

Implement scenario browsing and avatar discovery for the public web app.

In scope:

- load the list of available scenarios
- render scenario selection only after identity exists
- store the selected scenario in UI state
- show the list of available avatars for the current scenario
- hide unavailable avatars
- update the avatar list when new avatars become available
- keep scenario and avatar data aligned with canonical contracts

Out of scope:

- chat message entry
- message history rendering
- conversation transport details
- creating or editing scenarios/avatars
- admin or back-office tooling

## Relevant Docs

- `docs/EPICS.md`
- `docs/ARCHITECTURE.md`
- `docs/API_CONTRACT.md`
- `docs/DATA_MODEL.md`
- `docs/PRINCIPLES.md`
- `docs/TECH_STACK.md`
- `docs/TEST_STRATEGY.md`
- `docs/PROJECT_STATUS.md`

## Implementation Guidance

- Reuse the existing scenario and avatar contract shapes from the backend/shared layer.
- If the public web app needs a client helper for polling or live updates, keep it isolated and reusable.
- Make the scenario-to-avatar relationship explicit in UI state so the app can re-render cleanly when the active scenario changes.
- Treat avatar availability as dynamic state, not a static initial list.
- Ensure the public app only displays avatars that are actually available to the current player context.
- Keep the browser-side data model simple enough to support a future live update stream.

## Constraints

Respect the current architecture, KISS, YAGNI, DRY, and backward compatibility. Do not expose hidden avatars in the UI even temporarily. Do not add admin controls here.

## Deliverables

- scenario list in the public web app
- scenario selection flow
- available-avatar list scoped to the chosen scenario
- hidden avatars excluded from the visible list
- UI state ready for live avatar availability updates

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

If the public scenario/avatar flow changed assumptions about runtime availability or UI behavior, update the relevant docs.

## Acceptance Criteria

- [ ] user can see available scenarios after identity creation
- [ ] user can select one scenario
- [ ] user can see only avatars currently available for that scenario
- [ ] hidden avatars remain hidden until unlocked
- [ ] a new avatar can appear in the list when the backend makes it available
- [ ] no duplicated contract shapes are introduced in the web app
