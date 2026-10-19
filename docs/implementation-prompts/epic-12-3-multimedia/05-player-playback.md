# Title

Play Media In The Player And Report Playback Timing

# Context

Core now resolves slots and emits cues; the player must show them without breaking the voice-first
conversation. Video plays full screen, images appear as an overlay, the visitor can skip, and the
character must not talk or listen over the film. Playback timing must be measurable for the
research question.

# Scope

Implement now:

- slot rendering from the projection:
  - intro step plays `introMedia` (video full screen with skip, or image) and continues the flow on
    end/skip; falls back to cover + intro text when no intro media
  - outro step plays `outroMedia` the same way
  - conversation screen uses `idleLoop` (muted, looping, `playsInline`) when present, portrait image
    otherwise
- cue rendering from `runtime.media_cue`:
  - fullscreen video player with skip; image overlay with dismiss and an auto-dismiss duration
  - cues go through the 12.2 runtime-moments queue: never start while the Avatar is speaking; play
    after the current audio finishes; process in arrival order; de-duplicate by `cueId`
- pause/resume: while media plays, the voice loop stops listening and TTS playback is paused or
  deferred; both resume after end/skip; text input is disabled during fullscreen video
- autoplay policy: intro playback starts from the visitor's "begin" gesture; if the browser blocks
  autoplay with sound, show a tap-to-play state
- playback report: `POST /v1/sessions/{sessionId}/media-cues/{cueId}/playback` (tier `public`,
  ownership-checked, rate-limited) with `{ outcome: 'started' | 'completed' | 'skipped' | 'failed', clientLatencyMs? }`;
  Core records `media.playback_*` in `event_log` with cue-to-report latency computed server-side
- slot playback (intro/outro) is reported the same way with a client-generated cue id scoped to the
  session, or excluded from timing; choose one and document it

Out of scope:

- video avatar (EPIC 12.6), per-sentence audio (EPIC 12.5)

# Relevant Docs

- `docs/API_CONTRACT.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md` (`event_log`)
- `docs/TEST_STRATEGY.md`, `docs/TEST_COVERAGE_PLAN.md`

# Implementation Guidance

- Web files: `apps/web/src/flow/StoryScreens.tsx` (intro/outro), `conversation/Portrait.tsx`,
  `moments/runtime-moments.ts` and `use-runtime-moments.tsx` (queue), `voice/voice-loop.ts` and
  `chat/use-message-audio-playback.ts` (pause/resume). Add a `media/` folder for the player
  components and a pure playback state module with unit tests.
- Extend `conversation-presence.ts` with a `watching` state so presence and the voice loop agree.
- Accessibility: video has controls for skip and mute, captions if the asset provides them, focus
  moves to the player and returns afterwards; image overlay has alt text from the description.
- The playback route is new: add `media-cue-playback.stack-e2e.test.ts` covering 401 without token,
  400 invalid body, 404 unknown session/cue and another user's session, success records the event.
- Tests: queue ordering with speech, de-dup, pause/resume of voice loop and TTS, skip, autoplay
  blocked fallback, intro/outro fallbacks, reports sent once per outcome.

# Constraints

- Media never blocks sending once playback ends; a failed load falls back silently and reports
  `failed`.
- No storage keys or admin data in the player; only `PublicMediaAsset`.
- No new player dependency for video; use the native element.

# Deliverables

- intro/outro/idle slot rendering with fallbacks
- cue player (fullscreen video, image overlay, skip) wired to the moments queue
- voice loop and TTS pause/resume
- playback report route, use case, `event_log` entries, and client
- unit, behavior, route, and stack-e2e tests

# Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts (RuntimeEvent media payload, PublicMediaAsset, presence state).
2. Search for duplicated type definitions in `apps/web/src`.
3. Identify the canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

# Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- `docs/API_CONTRACT.md` (playback route)
- `docs/DATA_MODEL.md` (`media.playback_*`)
- `docs/ARCHITECTURE.md` (player media flow)
- `docs/TEST_COVERAGE_PLAN.md`

If no doc changes are needed, explicitly verify that docs are still accurate. Code, tests, and docs
move together.

# Acceptance Criteria

- [ ] Intro and outro media play with skip and fall back cleanly.
- [ ] Cues play in order after the current speech, once each.
- [ ] Voice loop and TTS pause during playback and resume afterwards.
- [ ] Cue → playback timing is recorded in `event_log`.
- [ ] Stack-e2e covers the playback route.
- [ ] Documentation reviewed and updated.
