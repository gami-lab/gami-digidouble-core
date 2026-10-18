# Title

Add Character Cards And A Voice-First Conversation Screen

# Context

Characters are shown by name only, and the chat screen looks like a text console with optional
voice. The experience should be voice-first: the visitor picks a character from a card and speaks,
seeing whether the character is listening, thinking, or speaking. This slice builds the
`characterChoice` and `conversation` states of the flow from `02`.

# Scope

Implement now:

- `characterChoice`: one card per available avatar with portrait, name, one-line hook, and up to
  three starter questions; locked avatars are not shown (unlocks arrive in prompt `04`)
- tapping a card starts the conversation; tapping a starter question starts it and sends that
  question as the first message
- `conversation` screen:
  - character portrait as the visual anchor (12.3 idle loop if shipped, image otherwise)
  - one clear state indicator: listening / thinking / speaking, mapped from the existing voice loop
    phases (`off | listening | waiting | speaking`) and text send status
  - mic toggle as the primary control; text composer available as a secondary input
  - transcript hidden by default, toggleable, showing cleaned messages only
  - switch character returns to `characterChoice` using the existing switch-avatar route
  - end conversation leads to `outro`
- graceful fallbacks: no mic permission or no voice support → text mode with a short explanation;
  no portrait → initial-based placeholder

Out of scope:

- staged suggestion/unlock moments and idle hint (prompt `04`)
- video avatar (EPIC 12.6), latency work (EPIC 12.5)

# Relevant Docs

- `docs/API_CONTRACT.md` (voice and audio invariants)
- `docs/ARCHITECTURE.md`
- `docs/TEST_STRATEGY.md`
- `docs/EPICS.md` (12.2, 12.5, 12.6 boundaries)

# Implementation Guidance

- Use `AvatarPresentation` from the public projection; no local avatar shape.
- Map UI state from `voice-loop.ts` and `chat-thread-state.ts` in one pure function
  (`conversation-presence.ts` or similar) with unit tests; the screen renders only that state.
- Reuse `ActiveChatSection`/`use-active-chat-runtime` internals; move debug-oriented details out
  of the player rather than hiding them with CSS.
- Starter question send uses the same send path as a typed message, so turn ordering, streaming,
  and audio behave identically.
- Accessibility: state changes announced via a polite live region; mic control has an accessible
  name and pressed state; cards are buttons with clear labels.
- Tests: card rendering from presentation data, starter question → first message, state mapping
  table, transcript toggle, mic-denied fallback, switch and end transitions.

# Constraints

- Avatar response path is unchanged; no new Core endpoint.
- No raw audio, ids, or event names in the UI.
- Portrait images load lazily and have alt text from the avatar name.

# Deliverables

- character card component and choice screen
- voice-first conversation screen with presence state, transcript toggle, switch, end
- presence-state mapper with unit tests
- behavior tests listed above

# Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts (`AvailableAvatarSummary`, presentation types, message DTOs).
2. Search for duplicated type definitions in `apps/web/src/chat` and `discovery`.
3. Identify the canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

# Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- `docs/TEST_COVERAGE_PLAN.md` for new behavior tests

If no doc changes are needed, explicitly verify that docs are still accurate. Code, tests, and docs
move together.

# Acceptance Criteria

- [ ] Cards show portrait, hook, and starter questions from admin-authored data.
- [ ] A starter question starts the conversation and sends the first message.
- [ ] Listening / thinking / speaking states are visible and announced.
- [ ] Transcript is optional; text input works when voice is unavailable.
- [ ] Switch and end transitions work.
- [ ] Documentation reviewed and updated.
