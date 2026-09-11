# Title

Add Browser Audio Playback With Reliable Text Fallback

# Context

`apps/web` already consumes the canonical message stream and reconciles the completed Avatar
message. It should opt into audio only after text completion, using the new message-ID-based
delivery route. Playback is a delivery concern and must not move provider or orchestration logic
into the browser.

# Scope

Implement now:

- a typed web API client for the binary audio endpoint using the shared request/options contracts
- browser playback for completed Avatar messages, with an explicit play/replay control or a safe
  autoplay attempt followed by an accessible manual fallback
- loading, playing, stopped, unsupported, and failed states that never remove or delay text
- AbortController/client-disconnect handling when a new turn starts, the active conversation
  changes, playback is stopped, or the component unmounts
- object URL creation/revocation and audio-element/listener cleanup
- localized accessible labels/messages in the existing web i18n structure
- tests for successful blob delivery, metadata handling, abort/failure fallback, cleanup, and
  unchanged stream reconciliation

Out of scope:

- provider SDKs or Gradium configuration logic
- audio generation in the browser
- persistence or caching of audio assets
- lip sync, waveform visualization, or token-level synchronization
- changing console/admin behavior unless required to consume the canonical shared contract

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

- Reuse `apps/web/src/api/client.ts`, `apps/web/src/api/conversations.ts`, and the existing chat
  runtime/state boundaries. Add only the binary-response helper needed for audio; do not weaken
  JSON envelope validation for other routes.
- Request audio only after the terminal completed event provides the canonical Avatar message ID.
  Never synthesize a draft, partial delta, user message, or locally reconstructed text.
- Keep the audio request optional so existing text-only behavior and clients remain unchanged. A
  missing voice, browser playback restriction, network error, typed API failure, or abort must
  preserve the displayed text and expose a recoverable UI state.
- Prefer an HTML audio element or a small focused playback controller over a global media manager.
  Ensure only the active controller owns each object URL and revoke URLs on replacement/unmount.
- Guard against stale completions from an earlier message/conversation updating current UI state.
- Do not expose provider names, credentials, raw error payloads, or raw response text in client
  diagnostics. Use the existing API error normalization and localized user-facing messages.
- Add behavior tests around rapid send/stop/conversation change and browser `play()` rejection.

# Constraints

- No frontend assumptions added to Core business logic.
- No duplicated public DTOs or provider-specific browser fields.
- Text streaming and optimistic message behavior must remain intact.
- Respect browser autoplay and accessibility constraints.
- TypeScript strict mode; no `any`.

# Deliverables

- typed audio API client and binary/error handling
- playback state/control integrated with the existing public chat surface
- cancellation/object URL/listener cleanup
- localization and accessible controls
- deterministic web tests plus existing stream regression coverage

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
- `docs/API_CONTRACT.md` if browser-visible delivery behavior changed
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md` if browser/runtime dependencies changed
- `docs/TEST_STRATEGY.md` and `docs/TEST_COVERAGE_PLAN.md`

If no doc changes are needed, explicitly verify that the docs are still accurate. Code, tests, and
docs move together.

# Acceptance Criteria

- [ ] Completed text remains visible and usable when audio is unavailable.
- [ ] Browser requests use the canonical persisted Avatar message ID and shared options.
- [ ] Playback controls are accessible and handle autoplay rejection gracefully.
- [ ] Abort, stop, new turn, conversation change, and unmount release readers/listeners/object URLs.
- [ ] Stale audio results cannot mutate the current conversation state.
- [ ] Existing stream ordering and text reconciliation tests remain green.
- [ ] Documentation has been reviewed and updated where needed.
