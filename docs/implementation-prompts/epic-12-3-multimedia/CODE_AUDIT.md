# Code Audit — EPIC 12.3 Multimedia: Media Assets, Slots, and Cues

## Scope audited

EPIC 12.3 as defined by this folder's `README.md`: commits `c4fccb29..a9e871be` (seven commits, one
per prompt `00`–`06`). 244 files changed, +8,597 / −968 lines.

Reviewed:

- shared contract: `media-contract-types.ts` (kinds, refs, limits, MIME list, admin/public
  projections, triggers, cue payload, playback report), `presentation-contract-types.ts` (media
  slots, public projections), `runtime-types.ts`, `runtime-inspector-types.ts` (media session
  events), `api-client-protocol.ts` (`resolveApiUrl`)
- Core: `domain/media/*` (entity, signature check, avatar triggers), `domain/presentation`,
  `domain/game-master/*` (catalogue input, `mediaCue` output, parser, normalization, renderer,
  prompt), `application/services/media/*` (projection, references, cue service, catalogue),
  `application/use-cases/media-assets/*`, the run-GM media cue module, switch, delete-scenario,
  list-session-events, `IMediaStorage` with filesystem and in-memory adapters, the PostgreSQL media
  repository, event-log `appendOnce`/`findById`, admin media, open file, playback, and player media
  routes, `init.sql`, compose files, config, the media seed tool and AVA manifest
- admin: media API client (XHR upload), library page, add form, picker, browser video metadata,
  presentation slot and trigger fields
- web: `media/*` players, runtime-moments media queue, `useRuntimeMoments`, presence, voice loop,
  intro/outro slots, idle loop, playback report client
- console: session timeline media events and `MediaEventsView`
- docs: `API_CONTRACT.md`, `DATA_MODEL.md`, `ARCHITECTURE.md`, `TECH_STACK.md`,
  `GAME_MASTER_CONTRACT.md`, `MEMORY_SYSTEM_SPEC.md`, `TEST_STRATEGY.md`, `TEST_COVERAGE_PLAN.md`,
  `PROJECT_STATUS.md`, `EPICS.md`, `COOLIFY_DEPLOYMENT_SPECIFICATION.md`,
  `verification-2026-10-19.md`

## Executive Summary

The EPIC is delivered and was verified live. One shared media contract replaces the `media`
knowledge format (removed end to end, including the database check constraints). Uploads stream
through a storage port with signature and per-kind size checks and never buffer whole files; the
open file route serves only uploads of active scenarios with `Range`, `ETag`, and `nosniff`.
Presentation slots and Avatar triggers hold validated refs, and a referenced asset cannot be
deleted. Unlock, switch, and Game Master cues share one service that records each cue under a
deterministic `event_log` id, so retries and GM replays emit once; GM cues are validated against
the catalogue given to that run and never disturb other decisions. The player queues cues behind
the character's speech, pauses the voice loop, and reports playback; cue-to-playback timing is in
`event_log` and the console. On the local stack, the intro video played at session start, the GM
cued the chalet image during a live conversation, and Emma's unlock video played once.

What keeps this from A:

1. **A cue can cut off the visitor mid-sentence.** A cue starts whenever the character is not
   busy; if the visitor is speaking at that moment, the voice loop switches to `watching` and the
   partial utterance is discarded.
2. **Session reset does not reset media history.** Reset restores the initial unlocks, but the
   `media.cue_emitted` entries stay: an unlock cue keyed on session + Avatar never plays again, and
   every asset already cued stays out of the GM catalogue for the rest of that session.
3. **Captured posters are ordinary assets.** A video's poster frame lands in the library as its
   own image, appears in cover/portrait pickers, and stays behind when the video is deleted.
4. Smaller gaps: the switch-cue stack test only runs with a real LLM provider (null-provider CI
   never checks `runtime.media_cue` on a live stream); image overlay duration is not editable in
   admin; the real AVA intro film is not yet uploaded on the deployed stack.

## Final Grade

**B — solid, minor debt only.**

All gates pass, contracts have one owner, and the risky boundaries (streaming uploads, the open
route, exactly-once cues, GM validation) are proven at route, integration, and stack level. An A is
ruled out by two player-visible defects in the cue lifecycle (speech discarded, reset not
replaying media) and the poster-asset leak into the library.

## Build Health

- lint: PASS
- typecheck: PASS
- tests: PASS — Core 1,433; web 166; admin 149; evaluation 88; console 34; shared 30
- integration (PostgreSQL, fresh test database): PASS — 179 passed, 3 skipped
- stack-e2e against a rebuilt Docker stack (production image, new schema): PASS — 146 passed,
  8 skipped (provider-gated, including the switch-cue stream test); the media stack files also
  passed against a local Core with the real provider (`media-cue.stack-e2e.test.ts` included)
- build and bundle secret scan: PASS
- coverage: Core 87.78% statements / 85.1% branches; `domain/media` 100%;
  `use-cases/media-assets` 95.6%; routes `admin-media` and `media-file` 100% statements. The web
  package has no coverage provider configured.

## Feature Confidence Matrix

| Feature                       | Expected Behavior                                                                                        | Evidence                                                                                              | Confidence | Notes                                        |
| ----------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------- |
| Media contract / knowledge    | one owner; `media` knowledge type and format gone; refs instead of URLs                                  | shared guards tests, schema/guard parity test, rg over the repo, `init.sql` checks                    | High       |                                              |
| Upload                        | streamed; signature + per-kind size; nothing left on failure; Core-generated keys                        | use-case tests (split chunks, mid-stream overflow), filesystem integration test, stack 10 MB+1 upload | High       |                                              |
| Open file route               | active scenarios only; `Range`/206/416; ETag/304; nosniff                                                | `media-file.test.ts`, `media-file.stack-e2e.test.ts`, live drills (missing file, deleted asset → 404) | High       | no rate limit (by design for media elements) |
| Ref validation / delete guard | missing, foreign, wrong-kind refs → 400; referenced asset → 409 with usages                              | `presentation.test.ts`, `media-triggers.test.ts`, `admin-media.test.ts`                               | High       |                                              |
| Admin library                 | upload with duration/poster, URL add, describe, cue-able, delete reason                                  | `MediaLibrary.test.tsx`, browser upload of a recorded WebM                                            | High       | posters become library assets (finding 3)    |
| Slots and triggers authoring  | kind-filtered pickers; round trip into payloads; triggers admin-only                                     | `PresentationFields.test.tsx`, route tests (player projection excludes triggers)                      | High       |                                              |
| Exactly-once cues             | one cue per triggering event, also across GM replay                                                      | cue service tests, GM application tests (replay), deterministic `event_log` id with `ON CONFLICT`     | High       | reset not considered (finding 2)             |
| Unlock / switch triggers      | cue after the unlock event; switch cue to the switching player only                                      | GM application test (order), route test, provider-gated stack test, live unlock video                 | High       | stack test not in null-provider CI           |
| GM `mediaCue`                 | catalogue only when present; malformed/unknown dropped; other decisions intact; state unchanged          | parser/normalization/renderer/prompt tests, GM application tests, live accepted cue                   | High       |                                              |
| Player playback               | waits for speech; ordered; de-duplicated; fullscreen/overlay; skip; tap-to-play; reports once            | moments tests, hook tests (repeated `playing`), player component tests, live overlay and video        | High       | can interrupt the visitor (finding 1)        |
| Voice / TTS pause             | voice stops listening during media and resumes; typing blocked for fullscreen; overlay dismissed on send | voice loop and hook tests, presence table, hook test                                                  | Medium     | speech discarded (finding 1)                 |
| Intro/outro/idle slots        | video then text or continue; image replaces cover; idle loop on stage                                    | `StoryScreens.media.test.tsx`, live intro video                                                       | High       |                                              |
| Timing                        | server cue-to-report and player latency per outcome                                                      | playback route tests, live evidence in `verification-2026-10-19.md`                                   | High       |                                              |
| Console                       | media events on the timeline with bounded fields                                                         | `session-timeline.test.ts`, list-session-events media test (URL/description stripped)                 | High       |                                              |

## Strengths

- The knowledge-based media path was removed rather than kept beside the new one, including the
  context-engine segment, retrieval traces, admin/console UI, and database constraints.
- Exactly-once is enforced where it matters — a deterministic `event_log` id with
  `ON CONFLICT DO NOTHING` — so the runtime event is published only when the insert wins.
- GM media cues are additive and isolated: the parser drops a malformed cue without failing the
  output, normalization drops ids outside the run's catalogue, and the GM state reduction is
  provably unchanged.
- Uploads are streamed end to end with a bounded signature check and never trust the client's
  file name; the storage port keeps a later object store a one-adapter change.
- The player reuses the moments state and the existing presence/voice mappers; media adds a
  `watching` state instead of a parallel pause mechanism.
- A live run on a real LLM produced the evidence the Definition of Done asks for, and the console
  shows the same timings.

## Findings

### A cue can discard the visitor's utterance

- Severity: Medium
- Category: Feature correctness / UX
- Problem: `currentMediaMoment` gates only on the character being busy. With hands-free voice on,
  a cue that becomes playable while the visitor is talking switches the voice loop to `watching`,
  and `useVoiceConversation` finishes the recording with `submit = false`.
- Why it matters: a late GM cue (it arrives seconds after the reply) silently throws away what the
  visitor was saying.
- Evidence: `moments/runtime-moments.ts` `currentMediaMoment`; `voice/use-voice-conversation.ts`
  (`finishRecording(false)` whenever the phase leaves `listening`).
- Recommendation: treat the visitor's speech as busy too — hold a cue while `voice.hearing` is
  true — and test it at the hook level.

### Session reset keeps media cue history

- Severity: Medium
- Category: Lifecycle correctness
- Problem: `ResetSessionUseCase` restores the initial unlocks and deletes conversations, but the
  cue ids (unlock: session + Avatar) and the "already cued" catalogue filter both read
  `event_log`, which reset keeps.
- Why it matters: after a reset, the unlock video never replays and GM cue-able images stay
  excluded, so the replayed experience differs from the first one.
- Evidence: `run-game-master.media-cues.ts` (`unlock:${sessionId}:${avatarId}`),
  `media-catalogue.ts` (filter on `media.cue_emitted`), `reset-session.use-case.ts`.
- Recommendation: key cues and the catalogue filter on the session's current run — record the
  reset time on the session (or a reset counter) and include it in the unlock trigger key and the
  catalogue query — and test unlock-replay after reset.

### Poster frames leak into the library and pickers

- Severity: Low
- Category: Data hygiene / authoring UX
- Problem: the captured poster is uploaded as a normal image asset; it shows in the library, in
  cover/portrait pickers, and remains when its video is deleted.
- Why it matters: the library fills with "Poster frame: …" images that authors did not create.
- Evidence: `MediaAddForm.tsx` `uploadWithPoster`; `DeleteMediaAssetUseCase`.
- Recommendation: delete a poster with its video when no other asset or slot uses it, and hide
  assets that serve only as a poster from the slot pickers.

### Switch-cue stream path not covered in null-provider CI

- Severity: Low
- Category: Test coverage
- Problem: Avatars need prepared traits to switch, which needs a real LLM; the stack test that
  reads `runtime.media_cue` from the live stream is skipped with the null provider.
- Why it matters: the CI stack never sees a cue on the real SSE stream.
- Evidence: `media-cue.stack-e2e.test.ts` (`describe.skipIf(isNullProvider)`).
- Recommendation: accept for now (the path is covered at route level with the real publisher and
  was run with a provider); revisit if the null provider gains a deterministic trait preparation.

### Image overlay duration not authorable in admin

- Severity: Low
- Category: Authoring completeness
- Problem: `durationMs` on images sets the overlay time, but the admin form only fills it for
  videos (from the browser); images use the 8 s default unless set through the API or the seed.
- Evidence: `MediaAddForm.tsx`, `MediaLibrary.tsx`; `ImageOverlay.tsx` default.
- Recommendation: add an optional display-seconds field for images in the library row.

### Deployment items

- Severity: Low
- Category: Delivery
- Problem: the real AVA intro film is not uploaded on the deployed stack, and the deployed stack
  was not re-verified; the verification used CC0 placeholders on the local stack.
- Recommendation: after deploying, upload the film in the admin library, assign it as intro media,
  and repeat the intro and GM-cue checks there.

## Architecture Review

- Layering holds: schemas and raw-body handling in API routes; validation, references, cue
  emission, and catalogue loading in Application; signature, triggers, and GM parsing/normalization
  in Domain; PostgreSQL, filesystem, and in-memory adapters in Infrastructure.
- No new dependency or datastore; files sit behind `IMediaStorage` on a volume.
- Media is never retrieval or memory: the GM catalogue is static scenario input, and session media
  history lives in `event_log`.
- Player-facing data is limited to `PublicMediaAsset`; storage keys, preview URLs, triggers, and
  GM reasons never reach the player tier.
- Two modules grew past the line cap during the work and were split along existing seams
  (GM runtime events and loaders into `run-game-master.events/context/media-cues.ts`, the player
  media routes into `player-media.ts`) rather than with new suppressions.

## Test Review

- Strong: streamed upload edge cases (split signature, mid-stream overflow, failed stream leaves
  no file), the open route's status matrix, exactly-once under replay, GM parse/normalize with the
  rest of the decision intact, the hook's report-once guard (found a real double report), and
  stack tests on the production image.
- Weak: admin library tests mock the API module, so they prove payloads, not persistence (Core
  tests cover persistence); the browser-side poster capture is exercised only in the live run.
- Missing: cue held while the visitor speaks; media replay after a session reset; poster cleanup.

## Documentation Gaps

None blocking. The docs listed in the README are synchronized; the verification note records the
evidence and what was not verified (hands-free voice in the browser, the deployed stack).

## Path to A

1. Hold a cue while the visitor is speaking; test it.
2. Make cue keys and the catalogue filter reset-aware; test unlock replay after reset.
3. Delete orphaned posters with their video and keep poster-only assets out of slot pickers.
4. Add an image display-duration field to the library.
5. Upload the AVA film and re-verify on the deployed stack (operational).

## Final Recommendation

**Close with debt** after items 1–3; item 5 is an operational follow-up already listed in
`EPICS.md`.
