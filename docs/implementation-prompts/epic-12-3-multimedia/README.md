# EPIC 12.3 — Multimedia: Media Assets, Slots, and Cues

## Objective

Let scenarios show images and video, triggered deterministically (slots and runtime triggers) or by
the Game Master (validated `mediaCue`), delivered over the existing runtime-event stream and
rendered by the player. This is the basis for the Kuleshov-style research question: cutting a
conversation to prepared images and film.

## Generated

2026-10-19

## Baseline

- 12.1 shipped: route tiers (`public` / `admin` / `open`), admin session + service key, player
  bearer token, ownership checks, rate/body limits, per-tier CORS.
- 12.2 shipped: guided player flow in `apps/web/src/flow` (`landing → intro → entryQuestion →
characterChoice → conversation → outro`), character cards, presence states, runtime moments
  queue (`apps/web/src/moments`). `packages/shared/src/presentation-contract-types.ts` holds
  `ScenarioPresentation.cover` and `AvatarPresentation.portrait` as image URLs, deliberately named
  so the value can become a media reference.
- A knowledge source with format `media` becomes one chunk (`toMediaChunk` in
  `apps/core/src/application/services/knowledge/knowledge-chunking.ts`) holding a description and
  `mediaUri`. There is no file storage.
- GM output (`docs/GAME_MASTER_CONTRACT.md`) has `dialogueControl`, `directorNotes`,
  `progressionUpdate`, `retrievalPlan`, `routing`; no media field.
- `RuntimeEvent.type` (`packages/shared/src/runtime-types.ts`) has no media event.
- The GM runs asynchronously after the Avatar reply, so any GM cue reaches the player after the
  reply has started.

## Design Decisions (confirm before running prompt 00)

- **One media catalogue.** Scenario-scoped `MediaAsset` records replace the `media` knowledge
  format. The GM receives a bounded catalogue (id, kind, description) of cue-able assets directly in
  its input instead of finding media through retrieval. Remove the `media` knowledge format and
  `toMediaChunk` (prototype rule: no dual path).
- **Storage.** Uploaded files go through an `IMediaStorage` port. Phase A adapter: a filesystem
  directory on a Docker volume mounted into Core. URL assets store only the URL. No object store
  or new datastore yet; an S3-compatible adapter can replace the port later.
- **Delivery.** `GET /v1/media/{assetId}` is tier `open`: browsers cannot send a bearer header from
  `<video src>`. It serves only assets of active scenarios, supports HTTP `Range`, sets cache
  headers, and returns 404 otherwise. Media is authored content, not user data.
- **Presentation references.** `cover` and `portrait` become media asset references; the intro,
  outro, and idle-loop slots sit next to them in the same typed presentation contract. No second
  place stores the portrait.
- **Who triggers what.**
  - Player-side, from the projection: intro (intro step), outro (outro step), portrait and idle
    loop (conversation screen). No event needed.
  - Core-side, as `runtime.media_cue`: avatar unlock and avatar switch triggers, and GM cues. Each
    cue is written to `event_log` and published once.
- **Timing.** The player reports playback start/skip/failure for each cue to Core. Core records
  cue-to-playback latency in `event_log`.

## Ordered Execution List

| #   | File                                     | Purpose                                                                                      |
| --- | ---------------------------------------- | -------------------------------------------------------------------------------------------- |
| 0   | `00-contract-cleanup.md`                 | Media contract owner; presentation refs instead of URLs; retire the `media` knowledge format |
| 1   | `01-media-assets-storage-and-api.md`     | `MediaAsset` entity, repository, storage port + volume adapter, admin API, open file route   |
| 2   | `02-admin-media-library-and-slots.md`    | Admin library, upload/URL, slot and trigger assignment on scenario and avatar                |
| 3   | `03-deterministic-triggers-and-event.md` | `runtime.media_cue` event, unlock/switch triggers, `event_log`, exactly-once                 |
| 4   | `04-game-master-media-cue.md`            | GM catalogue input, optional `mediaCue` output, validation, cue emission                     |
| 5   | `05-player-playback.md`                  | Full-screen video, image overlay, skip, voice/TTS pause, slots, playback report endpoint     |
| 6   | `06-hardening-and-doc-sync.md`           | AVA intro + live GM cue verification, timing evidence, cleanup, full doc sync                |

## Dependencies And Suggested Order

Run in order: `00 -> 01 -> 02 -> 03 -> 04 -> 05 -> 06`.

- `01` needs the contract owner and reference shape from `00`.
- `02` needs the admin API from `01`; it also defines slot/trigger fields that `03` and `05` read.
- `03` needs slots/triggers from `02`; it creates the event that `04` reuses.
- `04` reuses the event and validation path from `03`.
- `05` needs the open file route (`01`), slots (`02`), and the event (`03`); GM cues (`04`) arrive
  through the same path, so `05` can start after `03` if `04` is still in progress.
- `06` runs last.

## Definition Of Done For The Full EPIC

- [ ] Scenario-scoped image and video assets exist, by upload or URL, with kind, poster, duration,
      and description; one shared contract owner.
- [ ] Uploaded files are stored behind `IMediaStorage` and served with `Range` support from an
      open route that only exposes assets of active scenarios.
- [ ] Presentation `cover`/`portrait` and the intro/outro/idle slots reference media assets.
- [ ] Unlock and switch triggers fire exactly once per runtime event and are recorded in `event_log`.
- [ ] GM `mediaCue` is validated against the scenario catalogue; invalid or unknown cues are ignored
      without affecting the turn, the GM state, or other GM decisions.
- [ ] `runtime.media_cue` reaches the player in order on the session events stream.
- [ ] The player shows full-screen video and image overlays with skip; the voice loop and TTS pause
      during playback and resume afterwards.
- [ ] Cue → playback timing is recorded per cue.
- [ ] The `media` knowledge format is removed; no dual media path remains.
- [ ] The AVA intro video plays at session start, and a GM cue shows an image during a live
      conversation.
- [ ] Every new endpoint has a stack-e2e file (auth, validation, not-found).
- [ ] `docs/PROJECT_STATUS.md`, `docs/API_CONTRACT.md`, `docs/DATA_MODEL.md`,
      `docs/GAME_MASTER_CONTRACT.md`, `docs/ARCHITECTURE.md`, `docs/TECH_STACK.md`,
      `docs/MEMORY_SYSTEM_SPEC.md` (knowledge vs media), `docs/TEST_STRATEGY.md`,
      `docs/TEST_COVERAGE_PLAN.md`, and `docs/EPICS.md` are synchronized.
