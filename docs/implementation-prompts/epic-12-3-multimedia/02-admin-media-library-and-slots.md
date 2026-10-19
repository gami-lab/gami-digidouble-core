# Title

Add The Admin Media Library And Slot/Trigger Assignment

# Context

Authors need to upload media, describe it for the GM, and attach it to the places where it plays,
without code changes. This slice adds the library UI and the slot and trigger fields on scenarios
and avatars.

# Scope

Implement now:

- admin media library per scenario: list with thumbnail/poster, kind, size, duration, description,
  `cueable` toggle; add by upload or URL; edit; delete (shows the `409` reason when referenced)
- upload in the browser: read video `duration` and capture a poster frame client-side where
  possible (poster uploaded as an image asset); progress and failure states
- slot fields, using an asset picker filtered by kind:
  - scenario: cover (image), intro media (video or image), outro media (video or image)
  - avatar: portrait (image), idle loop (video), on-unlock media, on-switch-to media
- trigger fields (`onUnlock`, `onSwitchTo`) added to the avatar contract next to the presentation
  slots, validated like other refs; they are runtime triggers, not presentation, so place them in a
  typed avatar `mediaTriggers` section rather than inside `presentation`
- seed/fixture: the AVA intro video and at least one cue-able image so later prompts can be
  verified end to end

Out of scope:

- runtime emission (prompt `03`), GM cues (prompt `04`), player playback (prompt `05`)

# Relevant Docs

- `docs/API_CONTRACT.md`
- `docs/DATA_MODEL.md`
- `docs/TEST_STRATEGY.md`

# Implementation Guidance

- Add an admin route/page under `apps/admin/src/` for the library; reuse the existing routing,
  API client (`credentials: 'include'`), and error helpers.
- Reuse the 12.2 presentation section in `ScenarioAvatarForms.tsx` and the scenario form; replace
  the URL inputs with the asset picker.
- Description guidance in the UI: it is what the GM reads to decide a cue, so it should say what the
  image/video shows, not a filename.
- Tests: library behavior (upload, URL add, delete blocked when referenced), picker filtering by
  kind, slot/trigger round trip admin → API → player projection (presentation slots) and admin
  projection (triggers).

# Constraints

- No media processing on Core; poster and duration come from the browser or the author.
- Shared limits and MIME lists from `media-contract-types.ts`; no duplicated constants in admin.

# Deliverables

- admin media library page and asset picker
- slot and trigger fields on scenario and avatar forms; typed `mediaTriggers` contract and validation
- AVA media seed/fixture
- behavior and round-trip tests

# Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts (MediaAsset, Scenario/Avatar presentation, avatar triggers).
2. Search for duplicated type definitions in `apps/admin/src`.
3. Identify the canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

# Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- `docs/DATA_MODEL.md` (avatar `mediaTriggers`)
- `docs/API_CONTRACT.md` if request/response shapes changed
- `docs/TEST_COVERAGE_PLAN.md`

If no doc changes are needed, explicitly verify that docs are still accurate. Code, tests, and docs
move together.

# Acceptance Criteria

- [ ] Authors can upload, describe, mark cue-able, and delete media in admin.
- [ ] Slots and triggers are assignable with kind-filtered pickers and round-trip.
- [ ] AVA has an intro video and a cue-able image available.
- [ ] Documentation reviewed and updated.
