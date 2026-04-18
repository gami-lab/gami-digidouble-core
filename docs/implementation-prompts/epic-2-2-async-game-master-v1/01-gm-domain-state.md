# 01 — GM Domain Types, State Reducer, and Trigger Conditions

## Context

The domain types for the Game Master (`game-master.types.ts`) were scaffolded in EPIC 2.1 to match
`GAME_MASTER_CONTRACT.md`. They are correct but incomplete: the state reducer, trigger condition
predicates, and the `GameMasterEvent` observability type are missing.

This prompt completes the GM domain layer in pure TypeScript — no LLM calls, no I/O. Everything
here is deterministic and must be unit-tested.

---

## Scope

**In scope:**

- Enrich `game-master.types.ts` with the `GameMasterEvent` type (from `GAME_MASTER_CONTRACT.md §14`)
- Implement `applyGmStateUpdate(state, output)` → `GameMasterState` as a pure state reducer function
- Implement trigger predicate functions:
  - `shouldTriggerGm(state, turnIndex)` → `boolean`
  - Each predicate maps to one `triggerReason` from the contract: `turn_threshold`, `topic_repeat`, `progression_stalled`
- Add `evaluateTriggerReason(state, turnIndex)` → `TriggerReason | null` (returns the first applicable reason, or `null` if no trigger)
- Add deterministic fixtures: `makeGmState(overrides?)` in `game-master.fixtures.ts`
- Add unit tests in `game-master.service.test.ts` (or `game-master.reducer.test.ts`) for every reducer rule and every trigger condition — positive and negative cases

**Out of scope:**

- LLM calls (Prompt 02)
- Repository/persistence (Prompt 03)
- Use case orchestration (Prompt 04)
- Any API or route changes

---

## Relevant Docs

- `docs/GAME_MASTER_CONTRACT.md` — §3 Turn Pipeline, §5 Output, §6 State Model, §7 State Meaning, §9 State Update Rules, §10 What GM Does NOT Do, §12 Implementation Guidance, §14 Diagnostic Trace
- `docs/ARCHITECTURE.md` — Domain Layer rules; Game Master module ownership
- `docs/TEST_STRATEGY.md` — Deterministic first; consumer-contract orientation
- `docs/TEST_COVERAGE_PLAN.md` — Game Master Module: trigger conditions, state reducer, duplicate topic handling, progression update rules

---

## Implementation Guidance

### Types to add/enrich (`domain/game-master/game-master.types.ts`)

The existing `GameMasterState`, `GameMasterInput`, and `GameMasterOutput` interfaces are already
present. Add:

**`TriggerReason`** — string union matching the contract:

```ts
export type TriggerReason =
  | 'session_start'
  | 'turn_threshold'
  | 'topic_repeat'
  | 'progression_stalled'
  | 'manual'
```

**`GameMasterEvent`** — observability event emitted for every GM run. Fields must match
`GAME_MASTER_CONTRACT.md §14` exactly. The `type` and `payload` shape are defined there.

### State reducer (`domain/game-master/gm-state.reducer.ts`)

Implement `applyGmStateUpdate(state: GameMasterState, output: GameMasterOutput): GameMasterState`.

Rules (from `GAME_MASTER_CONTRACT.md §9`):

- `interactionCount` always increments by 1
- If `output.stateUpdate.progression === 'increase'`, advance progression (a simple string
  description — e.g. append a marker — is acceptable for MVP; keep it simple)
- If `output.stateUpdate.topicCovered` is set and not already in `topicsCovered`, push it
- `currentAvatarId` is updated from `output.avatarId`
- Returns a new object — do not mutate the input

### Trigger predicates (`domain/game-master/gm-trigger.ts`)

Implement `evaluateTriggerReason(state: GameMasterState, turnIndex: number): TriggerReason | null`.

**Turn threshold trigger** (`turn_threshold`): fire every N turns. Start with `N = 5`.
Expose a named constant `GM_TURN_THRESHOLD = 5` so tests can reference it.

**Topic repeat trigger** (`topic_repeat`): fire if the same topic has appeared more than once
in `state.topicsCovered` (i.e. duplicates exist in the array). Note that `applyGmStateUpdate`
guards against adding duplicates — but data loaded from persistence may have been produced by
earlier code versions. The predicate checks the state as given.

**Progression stalled trigger** (`progression_stalled`): fire if `state.interactionCount` has
grown but `state.progression` has not changed in the last N turns. For MVP, approximate this as:
`interactionCount > 0` and `progression === ''` (or a sentinel indicating no movement). Keep it
simple — do not build complex history tracking.

Priority when multiple conditions are true: `turn_threshold` > `topic_repeat` > `progression_stalled`.

Return `null` when no condition fires.

### Fixtures (`domain/game-master/game-master.fixtures.ts`)

`makeGmState(overrides?: Partial<GameMasterState>): GameMasterState` — sensible defaults matching
the contract's initial state.

---

## Constraints

- No imports from `infrastructure/` or `api/` — this is pure domain code
- No async, no I/O — every function in this prompt is synchronous
- Do not add configuration loading; use exported named constants for tunable values
- Reducer must be a pure function (returns new object, never mutates input)
- Trigger predicates must be pure functions
- TypeScript strict mode — no `any`

---

## Deliverables

- `apps/core/src/domain/game-master/game-master.types.ts` — enriched with `TriggerReason` and `GameMasterEvent`
- `apps/core/src/domain/game-master/gm-state.reducer.ts` — `applyGmStateUpdate`
- `apps/core/src/domain/game-master/gm-trigger.ts` — `evaluateTriggerReason`, `GM_TURN_THRESHOLD`
- `apps/core/src/domain/game-master/game-master.fixtures.ts` — `makeGmState`
- `apps/core/src/domain/game-master/gm-state.reducer.test.ts` — unit tests for all reducer rules
- `apps/core/src/domain/game-master/gm-trigger.test.ts` — unit tests for all trigger predicates

---

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md` — mark Prompt 01 of EPIC 2.2 as done; record which files were created
- Verify that `docs/GAME_MASTER_CONTRACT.md` still matches what was implemented. If any rule was
  deliberately simplified (e.g. progression stalled heuristic), add a note in the contract under
  § 12 Implementation Guidance.
- No other docs should need changes at this stage.

---

## Acceptance Criteria

- [ ] `GameMasterEvent` type exists with all fields from `GAME_MASTER_CONTRACT.md §14`
- [ ] `applyGmStateUpdate` is a pure function; returns a new state object
- [ ] `interactionCount` increments by exactly 1 on every call
- [ ] `topicsCovered` does not contain duplicates after `applyGmStateUpdate`
- [ ] `evaluateTriggerReason` returns `'turn_threshold'` when `turnIndex % GM_TURN_THRESHOLD === 0`
- [ ] `evaluateTriggerReason` returns `null` outside threshold turns with clean state
- [ ] `evaluateTriggerReason` returns `'topic_repeat'` when duplicates exist in `topicsCovered`
- [ ] `evaluateTriggerReason` returns `'progression_stalled'` per the MVP heuristic
- [ ] Priority ordering is respected when multiple conditions are true
- [ ] All tests are deterministic (no LLM, no I/O, no timers)
- [ ] `pnpm lint` and `pnpm typecheck` pass
