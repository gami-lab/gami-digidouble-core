# Contract Cleanup for Public Web App

## Context

The public web app will consume existing API contracts for scenarios, avatars, sessions, conversations, runtime events, and user persona data. Before building the UI, the codebase must confirm that the canonical request and response shapes already exist and that the web app does not introduce a second local version of the same contract.

This slice exists because the feature touches multiple established models and flows. The risk is contract drift between `apps/web`, `apps/console`, `apps/core`, and `packages/shared`.

## Scope

Implement the minimal cleanup needed so the future web app can depend on canonical shared contracts and client helpers.

In scope:

- inspect touched entities and DTOs for duplication
- identify the canonical owner of each shape
- remove or consolidate local copies in web-facing client code if any exist
- ensure optionality and nullability match the API contract and existing backend behavior
- establish or reuse shared client types for scenarios, avatars, user persona, sessions, conversations, and messages
- make sure the debug console remains separate from the public web app

Out of scope:

- new public endpoints
- visual UI work
- state management beyond what is needed for contract cleanup

## Relevant Docs

- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/API_CONTRACT.md`
- `docs/DATA_MODEL.md`
- `docs/TEST_STRATEGY.md`
- `docs/PROJECT_STATUS.md`
- `docs/EPICS.md`

## Implementation Guidance

- Inspect `apps/console` and the future `apps/web` surface for any duplicated API DTOs or ad hoc request/response shapes.
- Reuse the canonical shared contracts when they already exist in `packages/shared`.
- If a canonical owner is missing, create one in the shared layer instead of adding a new local type in the web app.
- Keep the cleanup focused on the shapes needed by the public web flows: user identity/persona, scenario summaries, avatar summaries, session summary, conversation summary, and message rendering state.
- Treat the cleanup as a prerequisite slice; do not build UI behavior on top of duplicated contracts.

## Constraints

Respect the current architecture, KISS, YAGNI, DRY, and backward compatibility. Do not invent new abstractions unless duplication forces a canonical shared type.

## Deliverables

- canonical shared contract ownership for the web-facing shapes
- removal of redundant local copies where they exist
- a clear path for `apps/web` to consume shared contracts and API clients

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

If no doc changes are needed, explicitly verify that docs are still accurate.

## Acceptance Criteria

- [ ] touched web-facing contracts have a canonical owner
- [ ] duplicated local DTOs are removed or consolidated
- [ ] `apps/web` can import shared shapes without re-defining them
- [ ] contract optionality and nullability remain aligned with backend behavior
- [ ] documentation is reviewed and updated where needed
