# EPIC 8.1 — Avatar Trait Structuring

## Objective

Prepare avatars into one fixed, platform-owned trait structure derived from existing author input and supporting documents so EPIC 8.2 can consume stable runtime inputs instead of raw free-form persona text.

## Generated

2026-07-19

## Dependencies

This EPIC builds on the existing avatar authoring flow, shared avatar DTO ownership, and the current knowledge-source system introduced in earlier EPICs.

It should be completed before EPIC 8.2, which depends on a stable `computedTraits` shape and explicit preparation workflow.

## Execution Order

| Step | File                                          | Description                                                                                                 |
| ---- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 1    | `00-contract-and-source-baseline.md`          | Remove contract drift risks and confirm canonical ownership for avatar read shapes and trait source inputs  |
| 2    | `01-trait-schema-and-avatar-persistence.md`   | Add the fixed trait schema and persist derived traits on avatars without changing authoring inputs          |
| 3    | `02-trait-preparation-service.md`             | Implement the LLM-backed preparation flow that derives traits from avatar text plus existing scenario docs  |
| 4    | `03-scenario-prepare-avatar-traits-api.md`    | Add the explicit scenario-scoped preparation endpoint, return `computedTraits`, and own stack-e2e coverage  |
| 5    | `04-admin-scenario-trait-preparation-flow.md` | Add the minimal admin trigger and read-only inspection surface so operators can run and inspect preparation |
| 6    | `05-tests-hardening-and-doc-sync.md`          | Close remaining test gaps, validate recomputation behavior, and update all impacted documentation           |

Each prompt depends on the previous one being complete.

## Suggested Execution Order

Run the prompts in numeric order with no parallel feature work.

The contract/source baseline should land first because adding `computedTraits` to `AvatarSummary` will otherwise force repetitive edits across test-only and helper-local copies.

The API slice should not be started until persistence and preparation logic exist.

The admin slice should not be started until the endpoint and shared contracts are stable.

## Definition of Done

- [ ] A fixed seven-field avatar trait schema exists and has one canonical owner across domain and shared HTTP contracts.
- [ ] Avatar read DTOs expose `computedTraits: AvatarComputedTraits | null` with stable field names.
- [ ] Trait source ownership is explicit: avatar author input stays on the avatar, scenario context stays on the scenario, supporting documents are reused from existing knowledge sources.
- [ ] Avatars persist derived traits in a dedicated field or column, not inside free-form prompt text and not inside ad-hoc config blobs.
- [ ] An explicit scenario-scoped API action computes or recomputes traits for the scenario avatars.
- [ ] Preparation reuses the existing LLM abstraction layer and does not call provider SDKs directly from business logic.
- [ ] Generated traits stay concise, avatar-specific, and grounded in the provided sources.
- [ ] Existing authoring inputs remain preserved for regeneration.
- [ ] The admin app can trigger preparation and inspect the resulting traits without introducing editable trait fields.
- [ ] Unit, integration/E2E, and stack-e2e coverage exists where required by the touched surfaces.
- [ ] `docs/PROJECT_STATUS.md` and every impacted source-of-truth doc are updated before the EPIC is considered complete.
