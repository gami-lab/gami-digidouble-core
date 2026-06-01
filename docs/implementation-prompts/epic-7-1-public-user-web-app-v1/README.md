# EPIC 7.1 — Public User Web App v1

## Objective

Build the first production-facing public web experience for players. The app must let a user create a local identity plus persona, persist that identity in browser local storage, reset it on demand, select a scenario, browse only currently available avatars, and play through one active chat at a time with optimistic message display and visible processing state.

The existing `apps/console` stays local-only for debugging and manual testing. It is not part of the Coolify production deployment.

## Generated

2026-06-01

## Dependencies

This EPIC depends on the backend API and runtime surfaces already implemented in `apps/core`. It should be implemented after the public API contract and runtime-state behavior are stable enough for a real user-facing client.

This EPIC also depends on the repository staying contract-driven. Before touching any shared request/response shapes, the implementation must verify whether the relevant DTO already exists in `packages/shared` or the API contract docs and avoid creating duplicate local copies in the web app.

## Execution Order

| Step | File                                         | Description                                                                                                |
| ---- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 0    | `00-contract-cleanup.md`                     | Audit and normalize shared DTOs, API client shapes, and web-facing contract ownership before feature work  |
| 1    | `01-web-app-shell-and-local-identity.md`     | Create the app shell, onboarding flow, local storage identity persistence, and reset flow                  |
| 2    | `02-scenario-and-avatar-discovery.md`        | Load scenario list, scenario selection, avatar discovery, hidden-avatar filtering, and live avatar updates |
| 3    | `03-single-chat-runtime-and-live-updates.md` | Build the current-chat-only experience, optimistic send, processing state, and response rendering          |
| 4    | `04-tests-doc-sync-hardening.md`             | Add tests, hardening checks, and full documentation sync                                                   |

Each prompt depends on the previous prompt being complete. Do not start later slices before the prior slice’s contract and behavior are in place.

## Definition of Done

- [ ] A new `apps/web` project exists and is wired into the monorepo tooling
- [ ] The user can create a local identity and persona in the web app
- [ ] The identity is saved in browser local storage and restored on refresh
- [ ] The identity can be reset and recreated at any time
- [ ] Once identity exists, the user sees the list of available scenarios
- [ ] The user can select one scenario and enter its player flow
- [ ] The user sees only avatars currently available for chat
- [ ] Avatars hidden by the Game Master stay hidden until unlocked
- [ ] New avatars appear dynamically when they become available
- [ ] The user only sees the current chat, not older chats
- [ ] Messages appear immediately when sent
- [ ] The UI shows an explicit processing state while waiting for the response
- [ ] Responses arrive into the active chat thread
- [ ] A complete test suite covers the new web flows
- [ ] `docs/PROJECT_STATUS.md` is updated to reflect the web app milestone
- [ ] Any impacted architecture, API, or testing docs are updated
- [ ] The implementation leaves `apps/console` out of Coolify production deployment
