# EPIC 12.2 — Public Experience UI

## Objective

Turn `apps/web` from a demo console into a guided experience a first-time visitor understands
without help: landing → intro → one in-world question → character choice → conversation → outro,
with character presentation, voice-first states, and GM suggestions/unlocks staged as narrative
moments. Presentation data is authored in admin and stored in scenario/avatar `uiHints`, which Core
orchestration ignores.

## Generated

2026-10-18

## Baseline

- `apps/web/src/App.tsx` renders one long page: an identity form with four raw persona fields
  (`name`, `roleInWorld`, `avatarRelationships`, `dialogGuidance`) → `ScenarioDiscoverySection` →
  `AvatarDiscoverySection` → `ActiveChatSection`. Wording is technical ("identité locale",
  "Fil actuel", "moteur d'expérience").
- Avatars show names only. `AvailableAvatarSummary` has no presentation fields.
- `uiHints` exists only as `Record<string, unknown>` on the domain scenario config
  (`apps/core/src/domain/scenario/scenario.types.ts`) and in an avatar fixture; it is untyped, not
  authored in admin, and not projected to the player.
- `runtime.avatar_unlocked` is only used to refresh discovery
  (`use-scenario-avatar-discovery.ts`); `runtime.avatar_suggested` is not rendered.
- The voice loop exposes `off | listening | waiting | speaking` (`apps/web/src/voice/voice-loop.ts`).
- Enter inserts a newline in the composer instead of sending.

## Dependencies On Other EPICs

- **12.1** (required first): the player uses the Core-issued player token and token-derived
  `userId`; no `userId` generation or API key in the web app. Public projections are already
  trimmed; this EPIC adds presentation fields to them deliberately.
- **12.3** (soft): intro/outro video and portrait/idle media slots. If 12.3 is not shipped, the
  intro and outro steps render authored cover image + text and the portrait comes from an authored
  image URL. Do not build media storage or a media library here.

## Ordered Execution List

| #   | File                                         | Purpose                                                                                   |
| --- | -------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 0   | `00-contract-cleanup.md`                     | Typed presentation contract for scenario/avatar `uiHints`; one owner; public projection   |
| 1   | `01-presentation-authoring-in-admin.md`      | Admin fields for cover, tagline, entry question, outro, portrait, hook, starter questions |
| 2   | `02-guided-flow-shell.md`                    | Flow state machine, landing, intro, in-world question, outro; player wording; Enter sends |
| 3   | `03-character-cards-and-conversation.md`     | Character cards with starter questions; voice-first conversation screen with states       |
| 4   | `04-staged-runtime-moments-and-idle-hint.md` | Suggestions/unlocks as narrative moments; idle hint when the visitor stalls               |
| 5   | `05-hallway-tests-hardening-and-doc-sync.md` | Five hallway tests, under-30-second check, accessibility, full doc sync                   |

## Dependencies And Suggested Order

Run in order: `00 -> 01 -> 02 -> 03 -> 04 -> 05`.

- `01` and `02` both need the typed contract from `00`. `02` can start in parallel with `01` using
  seeded presentation data, but `03` needs authored data from `01` to round-trip.
- `03` plugs into the flow shell from `02`.
- `04` needs the conversation screen from `03`.
- `05` runs last and owns the "first exchange under 30 seconds" evidence.

## Definition Of Done For The Full EPIC

- [ ] Scenario and avatar presentation has one typed shared contract stored in `uiHints`, validated
      at the API boundary, and ignored by Core orchestration.
- [ ] Admin can author cover, tagline, entry question, outro text, portrait, hook, and 2–3 starter
      questions; they round-trip to the player.
- [ ] The player follows landing → intro → in-world question → character choice → conversation →
      outro, with behavior tests for each state and transition.
- [ ] Character cards show portrait, one-line hook, and starter questions; a starter question sends
      the first message.
- [ ] Voice-first screen shows listening / thinking / speaking states with an optional transcript.
- [ ] `runtime.avatar_suggested` and `runtime.avatar_unlocked` render as staged narrative moments.
- [ ] An idle hint appears when the visitor stalls.
- [ ] Enter sends; Shift+Enter inserts a newline.
- [ ] No technical wording or debug views in `apps/web`; debug views stay in `apps/console`.
- [ ] Five hallway tests are recorded; a first-time visitor reaches the first exchange in under
      30 seconds without explanation.
- [ ] `docs/PROJECT_STATUS.md`, `docs/API_CONTRACT.md`, `docs/DATA_MODEL.md`,
      `docs/ARCHITECTURE.md`, `docs/TEST_STRATEGY.md`, `docs/TEST_COVERAGE_PLAN.md`, and
      `docs/EPICS.md` are synchronized.
