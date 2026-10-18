# Title

Stage GM Suggestions And Unlocks As Narrative Moments, And Add An Idle Hint

# Context

The Game Master already emits `runtime.avatar_suggested` and `runtime.avatar_unlocked` on the
session events stream, but the player only uses unlocks to refresh the avatar list
(`use-scenario-avatar-discovery.ts`) and ignores suggestions. These are the moments that make the
story feel directed. Visitors who stall also get no help. This slice makes both visible.

# Scope

Implement now:

- `runtime.avatar_unlocked`: a staged moment (e.g. the new character's card appears with a short
  narrative line and portrait) that does not interrupt an Avatar that is speaking; queued until the
  current turn finishes
- `runtime.avatar_suggested`: an in-world nudge pointing to the suggested character with a single
  action to switch; dismissible; never auto-switches
- moments are rendered only for events of the current session and de-duplicated across reconnects
- idle hint: after a configurable period with no visitor input while the character is not speaking,
  show one of the current avatar's unused starter questions (or a generic in-world prompt); one hint
  per idle period; dismissed on any input
- moment and hint copy in i18n; narrative lines may use avatar/scenario presentation data, never
  GM internals (reasons, scores, rule names)

Out of scope:

- GM-triggered media cues (EPIC 12.3)
- new GM events or changes to GM output

# Relevant Docs

- `docs/GAME_MASTER_CONTRACT.md` (event semantics and payloads)
- `docs/API_CONTRACT.md` (events stream)
- `docs/ARCHITECTURE.md`
- `docs/TEST_STRATEGY.md`

# Implementation Guidance

- Consume events through the existing `runtime-events-stream.ts` client and shared runtime event
  types (`packages/shared/src/runtime-types.ts`); no local event shape.
- Put staging rules in a pure module (`runtime-moments.ts`): input events + playback state → queue
  of moments to show. Unit-test ordering, queueing during speech, de-duplication, and dismissal.
- Idle timer lives in a small hook with injectable clock for tests; it pauses while thinking or
  speaking and while a moment is shown.
- Check what the suggestion event payload contains before designing copy; if it carries
  operator-only detail, render none of it.
- Tests: unlock during speech is deferred, suggestion action switches avatar, duplicate events
  render once, idle hint appears after the threshold and not while speaking.

# Constraints

- Player never sees GM reasoning or debug text.
- No blocking: moments never delay sending or playback.
- No Core changes unless an event payload lacks a field the moment truly needs; if so, stop and
  update `docs/GAME_MASTER_CONTRACT.md` in the same change.

# Deliverables

- runtime moment staging module and components
- idle hint hook and component
- unit and behavior tests listed above

# Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts (runtime event DTOs, avatar presentation).
2. Search for duplicated runtime event types in `apps/web/src`.
3. Identify the canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

# Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- `docs/GAME_MASTER_CONTRACT.md` only if event payloads changed
- `docs/TEST_COVERAGE_PLAN.md`

If no doc changes are needed, explicitly verify that docs are still accurate. Code, tests, and docs
move together.

# Acceptance Criteria

- [ ] Unlock and suggestion events render as staged moments without interrupting speech.
- [ ] Suggestions offer a switch action; nothing switches automatically.
- [ ] Duplicate or foreign-session events are ignored.
- [ ] Idle hint appears once per idle period and disappears on input.
- [ ] Documentation reviewed and updated.
