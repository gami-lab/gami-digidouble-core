# Title

Establish Canonical Voice And Audio Contract Ownership

# Context

EPIC 9.2 crosses existing Avatar, Scenario, Message, conversation response, and browser-client
surfaces. The repository already has deliberate internal domain types and public shared DTOs, but
there is no voice/audio contract. Adding fields directly to JSON config, route-local DTOs, or UI
state would create a second contract and make later Gradium work drift across layers.

This is a mandatory gate before feature work. Preserve intentional domain-to-public projections;
remove only duplicated public shapes or copied inline contracts.

# Scope

Implement now:

- audit Avatar, Scenario, Session, Conversation, Message, `SendMessageRequest`,
  `SendMessageResponse`, existing stream events, admin DTOs, and web/admin/console client forms
- search for duplicated type definitions, repeated inline response shapes, inconsistent
  optionality/nullability, and field-name drift
- establish canonical ownership for provider-neutral voice configuration, client audio options,
  synthesis errors, and binary audio-delivery metadata
- refactor any exact duplicate public shapes so later prompts add fields once and project them
  deliberately
- record the chosen boundary between persisted text, transient audio bytes, and response headers

Out of scope:

- Gradium SDK or HTTP calls
- audio synthesis behavior
- a new HTTP route
- audio playback UI
- video, lip sync, voice cloning, or audio asset persistence

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
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`
- `docs/TEST_COVERAGE_PLAN.md`

# Implementation Guidance

- Start from the existing canonical owners in `packages/shared/src/entity-types.ts`,
  `conversation-contract-types.ts`, `web-contract-types.ts`, and the public stream contract.
- Inspect the internal counterparts in `apps/core/src/domain/avatar`,
  `apps/core/src/domain/scenario`, `apps/core/src/domain/conversation`, and the application
  send-message types. Do not collapse internal domain models into public wire DTOs merely because
  fields overlap.
- Put public/shared voice and audio-delivery types in a focused shared module, re-exported from
  `packages/shared/src/index.ts`. Keep provider-specific Gradium fields out of that module.
- Use explicit optional versus nullable semantics. An omitted voice config means inheritance or
  no configured voice; `null` is reserved for an intentional clear operation if the existing
  mutation conventions require it.
- Treat client configuration as playback/delivery preference, not authority to select arbitrary
  provider credentials or provider-native voice fields.
- Add or update focused contract tests for runtime decoders/mappers if a new shared contract is
  introduced. Do not create a generic event-bus or media framework.

# Constraints

- Respect API -> Application -> Domain -> Infrastructure boundaries.
- KISS, YAGNI, and DRY: preserve useful projections and remove only real duplication.
- Do not put raw Gradium identifiers, SDK request objects, credentials, or provider errors in
  domain logic or public contracts.
- Preserve all existing text and message-stream contracts.
- TypeScript strict mode; no `any`.

# Deliverables

- a checked-in ownership decision for the new voice/audio contracts
- canonical shared types and exports, if missing
- refactored duplicate public shapes or a documented verification that no such duplicate exists
- contract tests for any new runtime validation or mapper behavior

# Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts.
2. Search for duplicated type definitions.
3. Identify the canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

# Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- any outdated impacted docs, including `docs/API_CONTRACT.md`, `docs/DATA_MODEL.md`,
  `docs/ARCHITECTURE.md`, and `docs/TEST_STRATEGY.md`

If no doc changes are needed, explicitly verify that the docs are still accurate. Code, tests, and
docs move together.

# Acceptance Criteria

- [ ] Every touched Avatar/Scenario/Message/client contract has an identified owner.
- [ ] No new public voice/audio DTO is declared in an app when `@gami/shared` should own it.
- [ ] Intentional internal/public projections remain explicit and mapped at boundaries.
- [ ] Optionality and nullability are consistent across shared types, domain types, and mappers.
- [ ] Existing text-only and message-stream contracts are unchanged.
- [ ] Contract tests pass.
- [ ] Documentation has been reviewed and updated where needed.
