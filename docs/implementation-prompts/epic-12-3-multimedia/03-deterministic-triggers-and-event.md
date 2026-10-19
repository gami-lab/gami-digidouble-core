# Title

Emit `runtime.media_cue` For Unlock And Switch Triggers

# Context

Some media is tied to story events rather than to a screen: a character's reveal clip when it is
unlocked, or a cut when the visitor switches to it. These must fire exactly once per event, be
auditable, and reach the player in order with the other runtime events. This slice adds the event
and the deterministic triggers; GM cues reuse it in prompt `04`.

# Scope

Implement now:

- `runtime.media_cue` in `RuntimeEvent.type` with a typed payload in shared:
  `{ cueId, asset: PublicMediaAsset, origin: 'avatar_unlocked' | 'avatar_switched' | 'game_master', display: 'fullscreen' | 'overlay' }`
  (display defaults by kind: video → fullscreen, image → overlay)
- application service that resolves a trigger to an asset and emits the cue: write the
  `event_log` entry, then publish on the session events stream
- triggers:
  - avatar unlock (GM-driven unlock path): for each newly unlocked avatar with `onUnlock` media
  - avatar switch (explicit switch use case, including GM-accepted switches): target avatar's
    `onSwitchTo` media
- exactly-once: the cue id is derived from the triggering event id + asset, so retries, replays
  (admin GM replay), or duplicate deliveries do not emit twice
- skip silently (with a bounded diagnostic) when the asset is missing, inactive, or of another
  scenario; never fail the triggering operation

Out of scope:

- GM cues (prompt `04`), player rendering (prompt `05`)
- intro/outro/portrait/idle slots: the player reads them from the projection

# Relevant Docs

- `docs/GAME_MASTER_CONTRACT.md` (player-visible runtime events)
- `docs/API_CONTRACT.md` (events stream)
- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md` (`event_log`)

# Implementation Guidance

- Find where `runtime.avatar_unlocked` and the switch transition are published today and add the
  cue emission after the state change is committed, in the same application flow, not in the API.
- Order: the unlock/switch event is published before its media cue, so the player can stage the
  moment and the media together.
- `event_log` entry type `media.cue_emitted` with origin, asset id, cue id; no URLs or descriptions
  beyond the bounded projection.
- Tests:
  - unit: trigger resolution, cue id determinism, missing/foreign asset skipped
  - application: unlock emits one cue per unlocked avatar with media; replay does not duplicate
  - stack-e2e on the events stream: unlock/switch produces the cue after the triggering event,
    in order; another user's stream does not receive it

# Constraints

- Media emission never blocks or fails the turn, the GM job, or the switch.
- Payload is the public projection only; no storage keys or admin fields.

# Deliverables

- shared event type and payload
- cue emission service with `event_log` recording
- unlock and switch triggers wired
- unit, application, and stack-e2e tests

# Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts (RuntimeEvent, event_log entries, avatar triggers).
2. Search for duplicated runtime event type unions in web/console.
3. Identify the canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

# Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- `docs/GAME_MASTER_CONTRACT.md` (runtime events list)
- `docs/API_CONTRACT.md` (events stream payloads)
- `docs/DATA_MODEL.md` (`media.cue_emitted`)
- `docs/TEST_COVERAGE_PLAN.md`

If no doc changes are needed, explicitly verify that docs are still accurate. Code, tests, and docs
move together.

# Acceptance Criteria

- [ ] Unlock and switch triggers fire exactly once per event, including under replay.
- [ ] Cues are recorded in `event_log` and delivered in order after their triggering event.
- [ ] Missing or foreign assets are skipped without affecting the triggering operation.
- [ ] Documentation reviewed and updated.
