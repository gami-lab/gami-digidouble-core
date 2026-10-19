# Code Audit — EPIC 12.2 Public Experience UI

## Scope audited

EPIC 12.2 as defined by this folder's `README.md`: commits `85f856eb..703a8a01` (six commits, one
per prompt `00`–`05`). 91 files changed, +4,991 / −1,989 lines.

Reviewed:

- shared contract: `presentation-contract-types.ts`, `entity-types.ts`, `web-contract-types.ts`
  (`SwitchAvatarRequest`; `LocalWebIdentity` removed), `conversation-contract-types.ts`
- Core: `domain/presentation/presentation.ts`, `api/routes/presentation-schema.ts`, the scenario
  and avatar create/update use cases, `scenario-summary.ts`, `avatar-summary.ts`, the public
  catalogue projection, `sessions.ts` (shared switch request), the murder-party seed client
- admin: `PresentationFields.tsx`, `presentation-form.ts`, the scenario create/edit forms, the
  avatar create/edit forms
- web: `flow/` (reducer, `GuidedExperience`, `FlowScreen`, story screens, entry question,
  character choice, time-to-first-exchange), `conversation/` (screen, presence mapper, portrait,
  card, transcript, text composer), `moments/` (runtime moments, banner, idle hint), the discovery
  and chat runtime hooks, i18n, styles
- `API_CONTRACT.md`, `DATA_MODEL.md`, `ARCHITECTURE.md`, `TEST_STRATEGY.md`,
  `TEST_COVERAGE_PLAN.md`, `PROJECT_STATUS.md`, `EPICS.md`, `GAME_MASTER_CONTRACT.md`,
  `hallway-tests-2026-10-19.md`

## Executive Summary

The engineering scope is delivered. Presentation has one typed shared owner, is validated at the
route boundary and again in the domain, lives under `config.uiHints`, and reaches the player only
through the explicit `presentation` field of `PublicScenarioSummary` and `AvailableAvatarSummary`.
Orchestration ignoring it is proven by equal Avatar prompts and scenario snapshots with and without
it. Admin can author every field with previews and shared limits, and a stack test proves the
admin → PostgreSQL → player round trip. The player is a pure-reducer flow with behavior tests over
the real screens, a voice-first conversation screen driven by one presence mapper, staged GM
moments, an idle hint, Enter-to-send, focus management, and player-safe error text. Browser checks
covered the full flow, 375 px width, and a keyboard-only path.

What keeps this from A:

1. **The EPIC's human Definition of Done is unproven.** No hallway test has been run, so "a
   first-time visitor reaches the first exchange in under 30 seconds without explanation" is not
   evidenced. Only the instrumentation and a scripted walkthrough exist.
2. **Re-picking the current character ends their conversation.** After "Talk to someone else",
   choosing the same character again calls `switch-avatar`, which closes the live conversation and
   opens a new, empty one.
3. **The entry answer replaces the whole persona.** `PUT /v1/me/persona` is a full replace, and
   the web sends only the mapped field, so a player who answered another scenario's question loses
   that earlier field.
4. **GM reasoning reaches the player.** `runtime.avatar_suggested` carries the GM's `reason` on
   the public events stream. The player never renders it, but it is visible in the browser's
   network panel, which contradicts "the player never sees GM reasoning".
5. **Presentation rules are encoded twice** (shared guard and the route JSON schema) with no
   parity test, so a limit changed in one place can drift silently.

## Final Grade

**B — solid, minor debt only.**

All gates pass and the main behaviors are proven at the HTTP and screen boundaries. An A is ruled
out by the unproven human DoD, two real flow defects (re-picking a character, persona overwrite),
the GM `reason` leak on a public stream, and the unchecked dual encoding of presentation rules.

## Build Health

- lint: PASS
- typecheck: PASS
- tests: PASS — Core 1,308; web 142; admin 136; evaluation 88; console 33; shared 24
- stack-e2e (targeted): PASS — `presentation.stack-e2e.test.ts` against a rebuilt Docker stack
- build and bundle secret scan: PASS
- coverage: Core 87.63% statements / 84.73% branches; `domain/presentation` 96.4%. The web
  package has no coverage provider configured.

## Feature Confidence Matrix

| Feature                     | Expected Behavior                                                                 | Evidence                                                                               | Confidence | Notes                                                 |
| --------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------- |
| Typed presentation contract | unknown keys, blank/over-limit text, >3 questions, non-http images → 400          | `presentation.test.ts` (routes), `presentation-contract-types.test.ts`                 | High       | rules encoded twice (finding 5)                       |
| Update semantics            | object replaces, `null` clears, omitted keeps (also when `config` is replaced)    | route test + `presentation.stack-e2e.test.ts` (PostgreSQL)                             | High       |                                                       |
| Player projection           | catalogue and available avatars carry `presentation` and no other config          | route tests assert exact catalogue shape and absence of hidden config                  | High       |                                                       |
| Orchestration isolation     | Avatar prompt and scenario snapshot identical with or without presentation        | `persona-prompt.service.test.ts`, `presentation.test.ts` (domain)                      | High       | GM prompt not asserted directly; it uses the snapshot |
| Admin authoring             | edit, clear (`null`), limits, starter add/remove/reorder, previews, server errors | `PresentationFields.test.tsx`, `presentation-form.test.ts`                             | High       | create forms not exercised                            |
| Admin → player round trip   | authored starter questions and portrait reach the player projection               | route round-trip test; stack test via PostgreSQL to the catalogue                      | High       |                                                       |
| Guided flow                 | each step and transition, back/skip, resume, error, restart                       | `flow-state.test.ts` (12), `App.behavior.test.tsx` over real screens                   | High       | `session_closed` → outro not tested at App level      |
| Entry question              | answer fills the mapped persona field; skippable                                  | App behavior tests                                                                     | Medium     | replaces the whole persona (finding 3)                |
| Character cards             | portrait/initial, hook, starter questions; starter sends the first message        | App behavior tests (send path asserted at the stream client)                           | High       |                                                       |
| Voice-first screen          | one announced presence state, mic primary, text fallback, optional transcript     | `conversation-presence.test.ts` (table), `ConversationScreen.voice.test.tsx`           | High       |                                                       |
| Switch / end                | switch uses `switch-avatar`; end leads to outro                                   | App behavior tests                                                                     | Medium     | re-picking the same character ends it (finding 2)     |
| Staged moments              | current session only, once per event, deferred while busy, switch only on action  | `runtime-moments.test.ts`, App test (suggestion → banner → switch, no reason rendered) | High       | `reason` still on the wire (finding 4)                |
| Idle hint                   | once per idle period, only on the visitor's turn, cleared on input                | `use-idle-hint.test.ts`, `ConversationScreen.voice.test.tsx` (fake timers)             | High       |                                                       |
| Enter / Shift+Enter / IME   | Enter sends; Shift+Enter and composition do not                                   | App behavior tests (Enter, Shift+Enter); IME covered only by `isSendKey` code path     | Medium     | no IME test                                           |
| No technical wording        | no identity/avatar/session/scenario/thread terms; no raw server errors            | App test over the rendered flow; i18n grep; errors now always i18n                     | High       |                                                       |
| First exchange < 30 s       | four of five first-time visitors under 30 s without help                          | none — `hallway-tests-2026-10-19.md` is an empty template                              | Low        | finding 1                                             |

## Strengths

- One canonical owner for presentation, consumed by Core, admin, web, and the seed; the seed
  client dropped its local copies of scenario/avatar request shapes.
- Clearing semantics are explicit and proven, including the subtle "replacing `config` keeps
  presentation" case, against real PostgreSQL.
- The flow is a pure reducer with a transition table; screens only dispatch, so every transition
  is unit-tested without React.
- The presence mapper and the moments module are pure and table-tested; the UI renders their
  output only.
- Starter questions and moment switches reuse the existing send and switch paths instead of new
  ones, so streaming, audio, and turn ordering behave the same.
- The player no longer shows server error text, and focus moves to each screen's title.
- Dead code from the one-page player (identity module, discovery sections, `LocalWebIdentity`,
  unused discovery state, i18n keys, CSS) was removed in the change that made it unused.

## Findings

### Human Definition of Done not evidenced

- Severity: High
- Category: Functional completeness
- Problem: the five hallway tests were not run; the notes file is a protocol with an empty table.
- Why it matters: the EPIC exists to make a first-time visitor succeed without help; no test can
  prove that.
- Evidence: `hallway-tests-2026-10-19.md`; `EPICS.md` keeps 12.2 open with this as the remaining
  item.
- Recommendation: run the five sessions on the deployed scenario, record times and notes, fix what
  they reveal, then close 12.2.

### Re-picking the current character ends their conversation

- Severity: Medium
- Category: Feature correctness
- Problem: from character choice, choosing the character already in conversation calls
  `switch-avatar`, which ends the live conversation and opens a new one.
- Why it matters: "Talk to someone else" followed by changing one's mind silently loses the thread.
- Evidence: `startChatWithAvatar` switches whenever a conversation exists
  (`use-active-chat-runtime.ts`); `SwitchAvatarUseCase` does not short-circuit the same avatar.
- Recommendation: when the chosen avatar is the active one with a live conversation, return to it
  (sending the starter question if one was picked) instead of switching. Add an App behavior test.

### Entry answer overwrites the stored persona

- Severity: Medium
- Category: Feature correctness / data loss
- Problem: `EntryQuestionScreen` sends `PUT /v1/me/persona` with only the mapped field; the route
  replaces the whole persona.
- Why it matters: a player who gave a name in one scenario and a role in another keeps only the
  last answer, and the Avatar loses that context.
- Evidence: `PostgresUserRepository.upsert` sets `persona` wholesale.
- Recommendation: read the current persona and send it merged with the answer (or make the update
  a merge). Add a behavior test that an earlier field survives.

### GM reasoning on the public events stream

- Severity: Medium
- Category: Boundary / redaction
- Problem: `runtime.avatar_suggested` publishes `{ suggestedAvatarId, reason }` to
  `GET /v1/sessions/{id}/events/stream`.
- Why it matters: the project rule is that the player never sees GM reasoning; the player tier
  should not carry it even if the UI ignores it. Operators already have the reason in the GM event
  log and console.
- Evidence: `run-game-master.use-case.ts` `publishDecisionRuntimeEvents`.
- Recommendation: drop `reason` from the runtime event; add a test asserting the published payload
  is `{ suggestedAvatarId }` only; document the payload in `GAME_MASTER_CONTRACT.md`.

### Presentation rules encoded twice without a parity check

- Severity: Medium
- Category: Contract drift
- Problem: limits and key sets live in `PRESENTATION_LIMITS`, but the shared guard
  (`isScenarioPresentation` / `isAvatarPresentation`) and the route JSON schema each spell out the
  structure. Adding a field takes edits in the type, the guard, the schema, the admin form, and the
  admin payload mapper.
- Why it matters: a field or rule added to one encoding but not the other is accepted at one
  boundary and rejected (or silently dropped on read) at the other.
- Evidence: `presentation-contract-types.ts`, `presentation-schema.ts`.
- Recommendation: add one parity test that runs the same accept/reject fixtures through the
  compiled route schema and the shared guards.

### Missing behavior tests at the flow boundary

- Severity: Low
- Category: Test coverage
- Problem: no App-level test for `runtime.session_closed` → outro, for a moment shown on the
  character-choice screen, or for the admin create forms' presentation payload; IME composition is
  not tested.
- Why it matters: these are small paths that a refactor of the flow hooks could break silently.
- Evidence: test files listed above.
- Recommendation: add the `session_closed` and IME cases at minimum.

### Old sessions stay active after "Start again"

- Severity: Low
- Category: Lifecycle hygiene
- Problem: restart opens a new session without ending the previous one; the list call picks the
  most recent by activity.
- Why it matters: active sessions accumulate per player; harmless today, confusing in admin.
- Evidence: `restartScenarioSession` in `use-scenario-avatar-discovery.ts`.
- Recommendation: accept for now; revisit with session cleanup.

## Architecture Review

- Layering holds: route schema at the API boundary, mutation rules in the domain module, use cases
  apply them, repositories unchanged, summaries project. No business rules moved into routes.
- Core orchestration never reads `uiHints` (search plus equality tests on prompt and snapshot).
- `apps/web` and `apps/admin` import only `@gami/shared` and talk HTTP/SSE.
- No new dependency, table, or datastore.
- Web structure is clean: pure modules (`flow-state`, `conversation-presence`, `runtime-moments`,
  `use-idle-hint` selection) with thin hooks and screens. `GuidedExperience` hands moments a ref to
  receive events from the discovery hook's single SSE connection, which avoids a second stream.

## Test Review

- Strong: route tests for validation, clearing, and exact public projections; the PostgreSQL stack
  round trip; reducer transition tests; presence and moments tables; App behavior tests that drive
  real screens over mocked HTTP modules and assert at the client call boundary.
- Weak: admin tests mock the API module, so they prove payload shape, not persistence (persistence
  is covered by Core tests).
- Missing: same-character re-pick, persona merge, `session_closed` → outro, IME, admin create
  payloads, schema/guard parity.
- Implementation-coupled: the domain presentation test asserts the `uiHints` storage key; this is
  the documented persistence contract, so it is acceptable.

## Documentation Gaps

- `GAME_MASTER_CONTRACT.md` does not state the player-visible payload of `runtime.avatar_unlocked`
  and `runtime.avatar_suggested`.
- The README Definition of Done checklist is not ticked.

## Path to A

1. Return to the live conversation when the current character is re-picked; test it.
2. Merge the entry answer into the stored persona; test that earlier fields survive.
3. Remove `reason` from `runtime.avatar_suggested`; test the payload; document both payloads.
4. Add the schema/guard parity test.
5. Add the `session_closed` → outro and IME behavior tests.
6. Run the five hallway tests (human; cannot be done in code).

## Final Recommendation

**Close with debt** once the code items above are fixed; the EPIC stays open in `EPICS.md` until
the hallway tests are recorded.
