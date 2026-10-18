# Title

Replace The Demo Page With A Guided Flow Shell

# Context

`apps/web/src/App.tsx` is one long page: a four-field persona form, then scenario list, avatar list,
and chat, all visible at once with technical wording. A first-time visitor does not know what to
do. This slice introduces an explicit flow with one screen per step and player-facing language.

# Scope

Implement now:

- a flow state machine in `apps/web` with states: `landing` → `intro` → `entryQuestion` →
  `characterChoice` → `conversation` → `outro`, plus `loading`/`error` where needed
- `landing`: scenario cover, tagline, one primary action; if several active scenarios exist, a
  simple picker first; a single active scenario skips the picker
- `intro`: authored intro (cover + text); if EPIC 12.3 has shipped an intro media slot, play it
  with skip; otherwise this step is still shown but is text/image only
- `entryQuestion`: one in-world question from `ScenarioPresentation.entryQuestion`; the answer is
  saved to the mapped persona field via the caller-scoped persona route from 12.1; skippable; if
  no question is authored the step is skipped
- `outro`: reached when the visitor ends the conversation (and on any existing session-end signal);
  shows outro text and "start again" (new session, same player token)
- remove the four-field identity form, the identity summary, and "reset identity" UI
- player wording in `i18n/fr.ts` and `i18n/en.ts`: remove "identité locale", "Fil actuel",
  "moteur d'expérience", and similar; French first
- composer: Enter sends, Shift+Enter inserts a newline, IME composition does not send
- resume: a returning visitor with a live session lands back in `conversation`

Out of scope:

- character cards and voice-first screen (prompt `03`)
- staged runtime moments and idle hint (prompt `04`)

# Relevant Docs

- `docs/ARCHITECTURE.md` (web as consumer layer)
- `docs/API_CONTRACT.md`
- `docs/TEST_STRATEGY.md`
- `docs/VISION.md`

# Implementation Guidance

- Model the flow as a pure reducer (`flow-state.ts`) with typed events and unit tests for every
  transition, including back/skip/error; components only dispatch and render.
- Reuse existing hooks (`use-scenario-avatar-discovery`, `use-active-chat-runtime`) instead of
  rewriting session/conversation logic; split them only where the flow needs a narrower piece.
- `local-identity.ts` and `local-runtime-state.ts` shrink to what the player token and resume need;
  delete code this change makes unused.
- Persona: keep `avatarRelationships` and `dialogGuidance` out of the player UI; they remain
  available to admin/evaluation via the API.
- Tests: reducer unit tests; `App.behavior.test.tsx` rewritten around the new flow (landing → first
  message), Enter/Shift+Enter, resume, error state.

# Constraints

- `apps/web` imports only `@gami/shared` and HTTP/SSE; no Core modules.
- No debug data (ids, event names, model names) rendered in the player.
- No new state-management or routing dependency unless the reducer clearly cannot carry the flow.

# Deliverables

- flow reducer and screen components for landing, intro, entry question, outro
- removed identity form and technical wording
- Enter-to-send composer
- updated behavior tests and i18n

# Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts (`LocalWebIdentity`, persona DTOs, session summaries).
2. Search for duplicated type definitions in `apps/web/src`.
3. Identify the canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

# Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- `docs/ARCHITECTURE.md` if the web consumer description changes
- `docs/TEST_STRATEGY.md` / `docs/TEST_COVERAGE_PLAN.md` for flow behavior tests

If no doc changes are needed, explicitly verify that docs are still accurate. Code, tests, and docs
move together.

# Acceptance Criteria

- [ ] Each flow state and transition has a behavior or reducer test.
- [ ] No persona form; one optional in-world question instead.
- [ ] No technical wording remains in player i18n.
- [ ] Enter sends, Shift+Enter inserts a newline.
- [ ] A returning visitor resumes an active conversation.
- [ ] Documentation reviewed and updated.
