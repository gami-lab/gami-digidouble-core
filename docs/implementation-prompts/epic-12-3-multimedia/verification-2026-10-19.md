# EPIC 12.3 Verification — 2026-10-19

## Setup

- Local stack: Core from source (`.claude/launch.json` `core-stack`, port 3100) on a fresh
  PostgreSQL database built from `infra/postgres/init.sql`, local Redis, filesystem media storage,
  the project's configured LLM (`gpt-5.6-luna` for the Game Master) and TTS provider.
- Player: `apps/web` dev server against that Core, in the Claude desktop app's built-in Chromium
  browser. Admin: `apps/admin` dev server, signed in with the e2e test password.
- Scenario: "AVA seed check", seeded with `seed:media` from `apps/core/src/seed/media/ava.media.json`
  (placeholder intro video: CC0 MDN `flower.mp4`; cue-able image: CC0 Wikimedia view of the Aravis
  from a chalet). Two characters with short test personas: Max (initial) and Emma (unlockable, whose
  `onUnlock` trigger is the intro video). The real AVA scenario lives only on the deployed stack and
  was not changed; its intro film still has to be uploaded there.

## Results

| Check                             | Result                                                                                                                                                                                                                                                             |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cover on landing (URL asset)      | Shown.                                                                                                                                                                                                                                                             |
| Intro video at session start      | Played full screen with sound right after "Begin" (no tap-to-play needed), focus on Skip; ending continued to character choice (no intro text); Skip also worked.                                                                                                  |
| Admin upload                      | Browser-recorded WebM uploaded through the library with a captured poster frame (second upload after the duration fix showed 0:02).                                                                                                                                |
| GM cue during a live conversation | After "Décris-moi la vue depuis le chalet…", the GM accepted `mediaCue` for the chalet image (`gm_triggered.decision.mediaCueOutcome = accepted`); the overlay appeared after Max finished speaking, presence "Watching with you…".                                |
| Unlock trigger                    | "Passe-moi Emma…" unlocked Emma; her `onUnlock` video played full screen once, then the "Emma has joined the story" banner was shown.                                                                                                                              |
| Failure drills                    | Missing file on disk → `GET /v1/media/{id}` 404; deleted asset → 404; the conversation was unaffected. Oversized upload, unsupported type, inactive scenario, URL asset failing to load, and cues to deleted assets are covered by route, stack, and player tests. |

## Event evidence (`event_log`, local stack)

| Cue                                    | Origin            | Emitted      | `playback_started` (cue → report) | Terminal (cue → report) |
| -------------------------------------- | ----------------- | ------------ | --------------------------------- | ----------------------- |
| `cue_fc88be31f3e11de5b581ed5df78c15e2` | `game_master`     | 17:50:20.152 | 11,905 ms (player 11,889 ms)      | completed, 19,916 ms    |
| `cue_8887eb1afaa3c7b4e93629fbc2203cc6` | `avatar_unlocked` | 17:51:37.548 | 4,146 ms (player 4,125 ms)        | completed, 9,252 ms     |

The image cue waited ~12 s because it arrived while Max was still speaking: cues never start over
the character's voice. The unlock video waited ~4 s for the same reason. Server and player
latencies agree within ~20 ms.

## Not verified here

- Hands-free voice: the microphone was not granted in the built-in browser; the pause/resume of
  the voice loop during media is covered by `use-voice-conversation.test.ts`.
- The deployed stack: not redeployed from this session.
