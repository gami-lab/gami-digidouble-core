# 06 — Documentation Sync

## Context

EPIC 2.2 is functionally complete after Prompt 05. This final prompt synchronizes all project
documentation with what was actually implemented, so the docs remain authoritative and
future contributors start with accurate information.

Documentation drift is a first-class bug. Update every section that describes a module, data
model, or API behavior changed by EPIC 2.2.

---

## Scope

Five documents must be reviewed and updated:

1. `docs/PROJECT_STATUS.md`
2. `docs/API_CONTRACT.md`
3. `docs/ARCHITECTURE.md`
4. `docs/DATA_MODEL.md`
5. `docs/GAME_MASTER_CONTRACT.md`

---

## 1. `docs/PROJECT_STATUS.md`

Mark EPIC 2.2 as complete:

- Move EPIC 2.2 — Async Game Master v1 from "In Progress" or "Planned" to **"Completed"**
- List the implemented files under EPIC 2.2:
  - `domain/game-master/game-master.types.ts` — enriched with `TriggerReason`, `GameMasterEvent`, `pendingDirective`
  - `domain/game-master/gm-state.reducer.ts` — pure state reducer
  - `domain/game-master/gm-trigger.ts` — trigger predicate
  - `domain/game-master/game-master.service.ts` — LLM-calling domain service
  - `domain/game-master/game-master.error.ts` — `GameMasterError`
  - `domain/game-master/game-master.fixtures.ts` — `makeGmState` test fixture
  - `application/ports/IGmStateRepository.ts` — GM state persistence port
  - `application/use-cases/trigger-gm-observation/trigger-gm-observation.types.ts`
  - `application/use-cases/trigger-gm-observation/trigger-gm-observation.use-case.ts`
  - `infrastructure/db/in-memory-gm-state.repository.ts`
- Record any deviations from the epic definition:
  - If the GM LLM adapter reuses the Avatar adapter (MVP decision), note it
  - If `pendingDirective` was added to `GameMasterState` (as recommended), note it
- Update the "Current Epic" pointer to the next planned epic

---

## 2. `docs/API_CONTRACT.md`

Update the **Behavior** section for `POST /v1/conversations/:sessionId/messages`:

Add a subsection (or bullet) describing GM behavior:

> **Async Game Master observation**
>
> After the Avatar message is persisted, the engine fires an asynchronous Game Master observation
> that does not block the HTTP response. The GM evaluates the current session state for trigger
> conditions (turn threshold, topic repetition, or progression stall). If a trigger fires, the GM
> makes an LLM call to produce directional guidance; the resulting directive is stored as
> `pendingDirective` in the session's GM state and injected into the Avatar's persona prompt on
> the following turn. GM failures are swallowed and have no effect on the response.

Do not change request/response shapes — they are unchanged.

---

## 3. `docs/ARCHITECTURE.md`

Update the **Game Master module** section to reflect the implemented structure:

```
domain/game-master/
  game-master.types.ts        — all GM types incl. TriggerReason, GameMasterEvent, pendingDirective
  game-master.service.ts      — LLM-calling domain service (uses ILlmAdapter port)
  game-master.error.ts        — GameMasterError domain error
  game-master.fixtures.ts     — test fixtures
  gm-state.reducer.ts         — pure state reducer (applyGmStateUpdate)
  gm-trigger.ts               — trigger predicate (evaluateTriggerReason)

application/ports/
  IGmStateRepository.ts       — GM state persistence port

application/use-cases/trigger-gm-observation/
  trigger-gm-observation.types.ts
  trigger-gm-observation.use-case.ts

infrastructure/db/
  in-memory-gm-state.repository.ts  — in-memory GM state repository (test/MVP use)
```

If a diagram exists, add `TriggerGmObservationUseCase` to the flow diagram in the correct position
(after avatar message persisted, non-blocking arrow).

---

## 4. `docs/DATA_MODEL.md`

Add `pendingDirective` to the `GameMasterState` entity description:

```
GameMasterState (session-scoped)
  sessionId:          string   — FK to Session.id
  progression:        string   — current scenario progression label
  topicsCovered:      string[] — topics discussed so far
  interactionCount:   number   — total exchange count
  pendingDirective?:  string   — GM directive to inject on next Avatar turn; cleared after use
```

Add a note explaining the lifecycle:

> `pendingDirective` is written by `TriggerGmObservationUseCase` when the GM produces a
> `context.notes` directive. It is read and cleared by `SendMessageUseCase` before the
> Avatar LLM call. A `null`/`undefined` value means no pending directive.

---

## 5. `docs/GAME_MASTER_CONTRACT.md`

Review and confirm the following sections match what was implemented:

- **§3 Turn Pipeline** — confirm the async call order matches the implementation
- **§12 Implementation Guidance** — if the `pendingDirective` mechanism was used rather than
  any other approach, add a note confirming this as the chosen implementation
- **§14 Diagnostic Trace** — confirm `GameMasterEvent` shape matches what was implemented in
  `game-master.types.ts`; update if any field names deviated

If there are any intentional deviations from the contract (e.g., a field was renamed for
consistency, a section was deferred), document them inline in the contract with a
`<!-- DEVIATION: ... -->` HTML comment so future readers can identify them easily.

---

## Mandatory Commit

After updating all five documents, commit with:

```
docs: sync project documentation after EPIC 2.2 completion [EPIC-2.2]
```

If any implementation file was changed only to add a missing type or fix a typo, include it in
the same commit rather than a separate `fix:` commit.

---

## Acceptance Criteria

- [ ] `docs/PROJECT_STATUS.md` reflects EPIC 2.2 as complete with all new files listed
- [ ] `docs/API_CONTRACT.md` documents the async GM observation behavior in the messages endpoint
- [ ] `docs/ARCHITECTURE.md` Game Master module section lists all implemented files
- [ ] `docs/DATA_MODEL.md` `GameMasterState` includes `pendingDirective` with lifecycle note
- [ ] `docs/GAME_MASTER_CONTRACT.md` is consistent with the actual implementation; deviations noted inline
- [ ] Commit message follows Conventional Commits format with `[EPIC-2.2]` tag
