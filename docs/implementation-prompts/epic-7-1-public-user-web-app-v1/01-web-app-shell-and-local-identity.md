# Web App Shell and Local Identity

## Context

This is the first implementation slice for the public user web app. It establishes the public app shell, the onboarding entry point, and the local identity model that the user will carry through the experience.

The user must be able to create a `userId` and persona once, keep that state in browser local storage, and reset it at any time to start again.

## Scope

Implement the initial `apps/web` app structure and the identity onboarding flow.

In scope:

- scaffold `apps/web` as a production-facing frontend app in the monorepo
- create the app shell and overall page state model
- add local identity creation with `userId` and persona fields
- persist identity data in browser local storage
- restore identity on page load
- add a reset action that clears local storage and returns the user to onboarding
- keep the UI professional and intentional, not like a debug panel

Out of scope:

- scenario browsing
- avatar browsing
- chat UI
- Game Master updates
- any Coolify deployment changes beyond the app’s local buildability

## Relevant Docs

- `docs/EPICS.md`
- `docs/COOLIFY_DEPLOYMENT_SPECIFICATION.md`
- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/API_CONTRACT.md`
- `docs/DATA_MODEL.md`
- `docs/PROJECT_STATUS.md`
- `docs/TEST_STRATEGY.md`

## Implementation Guidance

- Create the new `apps/web` package using the same monorepo conventions as the rest of the repo.
- Decide whether the web app should use a shared API client package or a small local client layer, but do not duplicate backend DTOs.
- Model identity state explicitly so the app can distinguish between onboarding mode and active-user mode.
- Keep the local storage format stable and easy to reset.
- Use the existing user persona model concept already established in the repository rather than inventing a competing shape.
- Keep the app shell minimal but polished enough to feel like a real product surface.

## Constraints

Respect the current architecture, KISS, YAGNI, DRY, and backward compatibility. Do not introduce a separate auth system or server-side user account system. The identity is local and browser-owned for this EPIC.

## Deliverables

- `apps/web` project scaffolded and buildable
- onboarding UI for `userId` + persona creation
- identity persistence in local storage
- identity reset flow
- clear state transition from onboarding to app usage

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

If the app structure or deployment assumptions changed, update the relevant docs before closing the slice.

## Acceptance Criteria

- [ ] `apps/web` exists and builds in the monorepo
- [ ] user can create a local `userId` and persona
- [ ] identity is restored from local storage on refresh
- [ ] reset action clears the stored identity
- [ ] onboarding and active-user modes are clearly separated
- [ ] the UI feels like a production product surface, not a debug tool
