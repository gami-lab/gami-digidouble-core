# Title

Add Provider-Neutral Voice Configuration And Delivery Contracts

# Context

The Avatar response is already cleaned before persistence and before text delivery. EPIC 9.2 needs
an explicit way to configure a voice without leaking Gradium into Avatar or Scenario logic, plus a
small client-facing option for requesting playable audio.

This slice defines the configuration and validation surface that the adapter and API use later.
It must remain additive so existing scenarios, avatars, and text-only clients continue to work.

# Scope

Implement now:

- provider-neutral voice configuration on the canonical Avatar and Scenario projections
- provider-neutral client audio preferences, limited to enablement and supported output format
- typed audio-delivery metadata for the binary response headers/client boundary
- create/update request validation and mapper support for voice configuration
- inheritance/resolution rules: Avatar voice overrides Scenario default; client preference controls
  whether/how audio is requested; no client field may override credentials or provider internals
- backward-compatible defaults for existing records with no voice configuration

Out of scope:

- Gradium calls or SDK dependency
- synthesis orchestration
- binary HTTP response handling
- audio playback UI
- persisted audio assets or message metadata changes

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

- Reuse the canonical types and ownership decisions from prompt `00`.
- Prefer a focused shared module such as `packages/shared/src/voice-contract-types.ts` with a
  provider-neutral voice profile/config shape, a finite browser-compatible audio-format union,
  request options, and bounded delivery metadata. Keep the shape small; do not model every
  provider capability.
- Add typed internal domain/config counterparts only where needed by runtime resolution. The
  internal shape may contain resolved defaults, but must not contain Gradium SDK objects or raw
  provider payloads.
- Store configuration in the existing Avatar/Scenario persistence mechanism used for extensible
  config unless the current repositories already have a better typed column boundary. If config
  is JSONB-backed, validate and map the reserved voice section at the application boundary rather
  than exposing an untyped `Record<string, unknown>` as the voice contract.
- Extend existing scenario/avatar create/update schemas and admin API clients/forms only as needed.
  Preserve old payloads and make clearing behavior explicit and tested.
- Define the public audio route request contract for
  `POST /v1/conversations/{conversationId}/messages/{messageId}/audio`; keep it minimal and
  additive. A client may request a supported format, but may not submit a Gradium voice ID,
  endpoint, API key, or arbitrary synthesis options.
- Ensure `AvailableAvatarSummary` does not accidentally expose internal config. Add voice fields
  only if the player needs them and the public contract deliberately allows them.

# Constraints

- Provider-neutral contracts only outside infrastructure.
- Preserve existing Avatar/Scenario field names and optionality.
- No new persistence table, audio blob column, or long-term media-management subsystem.
- No changes to Avatar prompt assembly, Game Master behavior, memory lifecycle, or text cleaning.
- TypeScript strict mode; no `any`.

# Deliverables

- shared voice/audio contract module and exports
- validated Avatar/Scenario configuration mapping with backward-compatible defaults
- client audio request and delivery metadata contracts
- unit/contract tests for inheritance, clearing, invalid values, and old payload compatibility
- updated API client/admin form types where the new configuration is intentionally exposed

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
- `docs/API_CONTRACT.md`
- `docs/DATA_MODEL.md` if the persisted config mapping changes
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md` if a new dependency or runtime configuration is introduced
- `docs/TEST_STRATEGY.md` and `docs/TEST_COVERAGE_PLAN.md` if coverage rules change

If no doc changes are needed, explicitly verify that the docs are still accurate. Code, tests, and
docs move together.

# Acceptance Criteria

- [ ] Existing Avatar and Scenario payloads remain valid.
- [ ] Voice configuration is provider-neutral and has one canonical shared owner.
- [ ] Avatar-over-Scenario resolution and client playback preference are deterministic.
- [ ] Invalid, partial, and clear operations return the repository's standard validation behavior.
- [ ] Provider-specific fields do not appear in shared, domain, admin, or browser contracts.
- [ ] Tests cover compatibility, validation, inheritance, and absence of configuration.
- [ ] Documentation has been reviewed and updated where needed.
