# Prompt 4 — Enforce Canonical Content, Runtime Config, And Provider Contracts

# Context

The audit found compatibility reads for unprepared Avatar traits and flat prompt inputs, Scenario
language stored in old config locations, Avatar `routeKey`, inferred knowledge visibility, a
`__GM_ONLY__` sentinel, a runtime `'legacy'` model adapter path, an unused embedding wrapper, and
pre-current provider request parameter branching. Fresh content and an explicit supported model
matrix allow these paths to be removed.

# Scope

Implement now:

- make structured Avatar prompt sections the only internal prompt input shape;
- require prepared `computedTraits` for active/servable Avatars and fail activation or serving when
  the current content contract is incomplete;
- remove flat prompt-section resolution, authored-prompt identity fallback, nullable trait handling,
  and fallback-only fixtures after updating the preparation/seed/admin flow;
- make canonical Scenario language authoritative and required for active Scenarios;
- remove reads from `config.language` and voice-level language fallback, plus legacy admin labels/fields;
- make Avatar `availabilityKey` the only supported routing/summary key and remove `routeKey` fallback;
- require explicit `visibilityPolicy` on every persisted static source, remove ID-based inference, and
  remove the `__GM_ONLY__` sentinel from runtime/admin/console paths and fixtures;
- remove the runtime `legacyAdapter` parameter and `'legacy'` provider/model branch;
- make the production model repository/adapter path explicit, with any local/test default isolated to
  an intentional current test/bootstrap configuration rather than a legacy runtime branch;
- remove the unused direct-query embedding compatibility wrapper once external package consumers are
  ruled out;
- define and enforce the supported production model matrix, then remove pre-current provider request
  parameter branching (including obsolete token-parameter selection) where the matrix no longer needs it;
- update fresh seed data and authoring validation so canonical content is produced without fallbacks.

Out of scope:

- changing current Avatar/Scenario product semantics beyond enforcing complete canonical content;
- changing provider-neutral LLM abstractions or adding a provider;
- removing normal error fallbacks, retries, cancellation, localization fallback, or current text/audio
  transport behavior;
- adding HTTP endpoints. Existing validation routes and UI flows must be updated in place.

# Relevant Docs

- `docs/VISION.md`
- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/DATA_MODEL.md`
- `docs/API_CONTRACT.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/TEST_STRATEGY.md`
- `docs/EPICS.md` — EPIC 10.1, EPIC 8.1, EPIC 8.2, and EPIC 4.2d
- `docs/PROJECT_STATUS.md`
- `docs/LEGACY_COMPATIBILITY_AUDIT.md`

# Implementation Guidance

1. Inventory each canonical content/config field across domain entities, persistence JSON, API DTOs,
   admin forms, console/web clients, seed files, and tests. Remove duplicated local shapes before
   changing requiredness.
2. Verify the Avatar trait-preparation workflow can prepare every fresh active Avatar before making
   `computedTraits` required at serving time. If activation validation is the correct boundary, fail
   there with the standard current error contract.
3. Keep the current voice configuration representation and provider-neutral voice contracts. Remove
   only the old language fallback locations identified by the audit.
4. Validate Scenario language, availability key, and visibility policy at the authoring/API boundary,
   then simplify repositories and presenters to read only canonical fields.
5. Replace `__GM_ONLY__` content with explicit `visibilityPolicy: 'none'` in fresh data; do not map the
   sentinel to the new policy at runtime.
6. Make model configuration explicit. Remove only the `'legacy'` dependency branch and pre-current
   request behavior; retain provider/model flexibility that is part of the declared current matrix.
7. Confirm the embedding wrapper has no production or external package consumer before deleting it.
   Current retrieval uses the canonical variants path.
8. Preserve provider abstraction boundaries: business logic must not import provider SDKs directly.

# Constraints

- Fresh content is the compatibility boundary; do not add aliases or automatic content repair.
- Keep API validation at the boundary and use the standard error envelope.
- Keep current voice/audio, retrieval, visibility, and trait-preparation behavior intact except for
  removing old input shapes and fallback reads.
- Do not narrow the supported model matrix without recording the deliberate product decision in docs.
- No new HTTP endpoint is expected; any new endpoint requires the mandatory stack-E2E file.
- Apply KISS/DRY and remove only code directly tied to the audited compatibility paths.

# Deliverables

- Canonical-content validation and updated fresh seed/admin/test fixtures.
- Current-only Avatar prompt, Scenario language, routing-key, visibility, and model-resolution paths.
- Removal of legacy model adapter, embedding wrapper, and obsolete provider request branch.
- Updated UI/admin labels and current DTOs without compatibility wording.
- Unit/integration/E2E coverage for rejection of incomplete or legacy content and current model/provider behavior.

# Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts: Avatar, Scenario, voice config, knowledge source visibility,
   model config, embedding service, LLM adapter request, and admin/console DTOs.
2. Search for duplicate definitions, inline forms, copied JSONB shapes, and inconsistent optionality/nullability.
3. Identify the canonical owner of each content and provider contract.
4. Reuse existing shared types and current preparation/configuration services.
5. If no canonical owner exists, create one before making a field required or deleting a fallback.

# Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md` (always required);
- `docs/API_CONTRACT.md` for validation and DTO requiredness;
- `docs/DATA_MODEL.md` for canonical content/config persistence;
- `docs/ARCHITECTURE.md` for boundary/ownership changes;
- `docs/TECH_STACK.md` for the supported production model/provider matrix;
- `docs/TEST_STRATEGY.md` for content-validation and provider-contract coverage;
- `docs/EPICS.md`, seed guides, scenario-builder docs, and voice/RAG setup docs as applicable.

If no additional documentation changes are needed, explicitly verify that the docs remain accurate.
Code, tests, and docs move together.

# Acceptance Criteria

- [ ] Active Avatars cannot run without prepared `computedTraits` and structured prompt inputs.
- [ ] Active Scenarios require canonical language; old config/voice language reads are gone.
- [ ] `availabilityKey` is the only supported Avatar summary/routing key.
- [ ] Static sources require explicit visibility policy and no sentinel/inference path remains.
- [ ] Runtime model resolution has no `'legacy'` adapter/provider branch.
- [ ] The supported production model matrix is documented and obsolete provider request branching is removed.
- [ ] The unused direct-query embedding wrapper has no remaining consumer and is deleted.
- [ ] Fresh seeds/admin flows produce only canonical content.
- [ ] Current validation, model, provider, trait, visibility, and authoring tests pass.
- [ ] All impacted product and source-of-truth docs are synchronized.
