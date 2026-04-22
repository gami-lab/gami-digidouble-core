# 06 — Documentation Sync

## Context

The full GM system is implemented and tested. This prompt closes the EPIC by ensuring every affected document reflects reality. The Game Master contract, data model, API contract, and project status must all be updated.

## Scope

**In scope:**

- `docs/GAME_MASTER_CONTRACT.md` — trigger rules documented, implementation flow updated
- `docs/DATA_MODEL.md` — `gm_states` and `event_log` tables with implementation status
- `docs/API_CONTRACT.md` — no new endpoints, but note the `gmNotes` injection mechanism in the send-message flow description
- `docs/ARCHITECTURE.md` — verify module map reflects `domain/game-master/`, `application/use-cases/run-game-master/`, `infrastructure/db/repositories/postgres-gm-state/`
- `docs/PROJECT_STATUS.md` — EPIC 4.1 marked complete, module list updated, sprint table updated
- `docs/TEST_STRATEGY.md` — GM test patterns documented

**Out of scope:**

- Code changes of any kind

## Relevant Docs

All docs in `docs/`. Read them in full before editing — do not make changes that conflict with other sections.

## Implementation Guidance

### `docs/GAME_MASTER_CONTRACT.md`

**Section 3 — Turn Pipeline:** Confirm the "Ongoing Conversation" flow description matches the implementation:

1. User message received
2. Avatar responds directly
3. Avatar message persisted
4. **GM fires asynchronously** (non-blocking — errors caught)
5. GM evaluates triggers
6. If trigger: LLM called, state updated, guidance notes stored for next turn
7. If no trigger: state incremented only
8. Event emitted in all cases

**New section (or update section 12) — Implemented Trigger Rules:**

Document the three implemented triggers with their conditions and default thresholds:

| Trigger               | Condition                                                  | Default Threshold |
| --------------------- | ---------------------------------------------------------- | ----------------- |
| `turn_threshold`      | `interactionCount % N === 0`                               | N = 5             |
| `topic_repeat`        | any topic appears ≥ N times in `topicsCovered`             | N = 3             |
| `progression_stalled` | `interactionCount >= N` and `progression` has not advanced | N = 8             |

Evaluation order: `turn_threshold` checked before `topic_repeat` before `progression_stalled`.

**Section 14 — Diagnostic Trace:** Confirm the `GameMasterEvent` type described matches what was implemented. If there are any discrepancies, correct the document.

### `docs/DATA_MODEL.md`

**Entity 4 — Session:** Add `active_avatar_id` to the fields list and note it is set by the GM when an avatar transition occurs.

**New entity section — `gm_states`:** Add between Session and Message (or at the end):

```
## X. GmState

Per-session Game Master state.

### Fields
- session_id (PK, FK → sessions)
- current_avatar_id (nullable)
- progression (text)
- topics_covered (text[])
- interaction_count (int)
- updated_at

### Implementation Status (EPIC 4.1)
- Table: gm_states
- Repository: PostgresGmStateRepository
- Status: Fully implemented.
```

**Entity 11 — EventLog:** Update the Implementation Status section to note:

- Table: `event_log`
- Repository: `PostgresEventLogRepository`
- Status: Fully implemented. Currently used for GM diagnostic events (`gm_triggered`, `gm_skipped`).

### `docs/API_CONTRACT.md`

The `POST /v1/conversations/:sessionId/messages` endpoint now injects GM guidance notes into the avatar system prompt. Add a note under that endpoint:

> **Game Master integration:** If the Game Master has stored guidance notes for this session (set asynchronously after a previous turn), they are appended to the Avatar's assembled system prompt before the LLM call. This is transparent to API consumers — the envelope shape is unchanged.

### `docs/ARCHITECTURE.md`

Verify the module map. If the file lists explicit subdirectories, update to include:

```
domain/
  game-master/     → GM types, trigger engine, state reducer, GM prompt assembly

application/
  use-cases/
    run-game-master/   → RunGameMasterUseCase

infrastructure/
  db/
    repositories/   → postgres-gm-state.repository, postgres-event-log.repository
```

If subdirectories are not listed at this level, simply verify the boundary description is still accurate.

### `docs/PROJECT_STATUS.md`

1. **Sprint 4 table:** update EPIC 4.1 row from `Not started` to `Complete`.

2. **Implemented Modules section:** add:
   - `Game Master (async) — trigger engine (turn threshold, topic repeat, progression stalled), RunGameMasterUseCase, GM state persistence (PostgresGmStateRepository), event log (PostgresEventLogRepository), guidance note injection into Avatar prompt`

3. **Known Issues / Blockers:** remove any reference to "no GM implementation" if present.

4. **Update `Last updated` field** to today's date.

### `docs/TEST_STRATEGY.md`

Verify the document accurately describes:

- Deterministic trigger tests (unit, no LLM): confirm this pattern is noted under unit tests
- Async use case test pattern (mock LLM adapter returning hardcoded JSON): add a brief note if not present
- GM integration tests: `postgres-gm-state.repository.integration.test.ts` — mention if not covered

## Constraints

- No code changes
- Do not introduce aspirational descriptions — document only what was implemented
- Preserve existing document structure — insert content at logical positions, do not restructure sections

## Deliverables

- `docs/GAME_MASTER_CONTRACT.md` — trigger rules + flow updated
- `docs/DATA_MODEL.md` — `gm_states` entity added, `event_log` status updated, Session `active_avatar_id` noted
- `docs/API_CONTRACT.md` — send-message GM injection noted
- `docs/ARCHITECTURE.md` — module map verified/updated
- `docs/TEST_STRATEGY.md` — GM test patterns noted
- `docs/PROJECT_STATUS.md` — EPIC 4.1 complete, module list updated

## Mandatory Final Step — Documentation Update

This prompt IS the documentation update. Commit with:

```
docs(epic-4.1): sync GAME_MASTER_CONTRACT, DATA_MODEL, API_CONTRACT, PROJECT_STATUS after GM implementation
```

## Acceptance Criteria

- [ ] `docs/GAME_MASTER_CONTRACT.md` documents the three trigger rules with names, conditions, and default thresholds
- [ ] `docs/GAME_MASTER_CONTRACT.md` section 3 accurately reflects the async turn pipeline as implemented
- [ ] `docs/DATA_MODEL.md` has `gm_states` entity with all fields and implementation status
- [ ] `docs/DATA_MODEL.md` Session entity lists `active_avatar_id`
- [ ] `docs/DATA_MODEL.md` EventLog entity has implementation status (EPIC 4.1)
- [ ] `docs/API_CONTRACT.md` notes the GM injection in the send-message endpoint description
- [ ] `docs/PROJECT_STATUS.md` shows EPIC 4.1 as complete
- [ ] `docs/PROJECT_STATUS.md` Implemented Modules includes the GM components
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` all pass (documentation-only change, should be clean)
