# 02 — Trigger Engine

## Context

The Game Master decides whether to intervene based on deterministic rules derived from the current `GameMasterState`. This decision must be made with zero LLM calls — it is pure policy evaluation.

Keeping triggers deterministic is essential: it makes them unit-testable, fast, and debuggable. The LLM is only invoked after a trigger fires (that happens in prompt 03).

## Scope

**In scope:**

- `TriggerReason` union type: `'turn_threshold' | 'topic_repeat' | 'progression_stalled' | 'session_start' | 'manual'`
- `evaluateTriggers(state: GameMasterState, policy?: TriggerPolicy): TriggerReason | null` — pure function
- Default policy constants (`DEFAULT_TURN_THRESHOLD`, `DEFAULT_MAX_TOPIC_REPEATS`, etc.)
- Unit tests for all trigger paths

**Out of scope:**

- LLM calls (prompt 03)
- State mutation (prompt 03)
- Event emission (prompt 04)
- The `manual` and `session_start` trigger types are reserved — no evaluation logic needed yet, they are triggered explicitly from calling code

## Relevant Docs

- `docs/GAME_MASTER_CONTRACT.md` — section 3 (turn pipeline), section 8 (core decisions), section 9 (state update rules), section 12 (implementation guidance, steps 2–3)
- `apps/core/src/domain/game-master/game-master.types.ts` — `GameMasterState`

## Implementation Guidance

### Location

`apps/core/src/domain/game-master/trigger-engine.ts`

This is pure domain logic — no infrastructure imports.

### `TriggerPolicy` type

```ts
export type TriggerPolicy = {
  turnThreshold?: number // default 5: trigger every N interactions
  maxTopicRepeatCount?: number // default 3: trigger if same topic mentioned ≥ N times
  maxTurnsWithoutProgression?: number // default 8: trigger if progression stalled for N turns
}
```

This type belongs alongside the trigger engine (not in `game-master.types.ts` unless it fits naturally). Keep it co-located.

### Default constants

```ts
export const DEFAULT_TURN_THRESHOLD = 5
export const DEFAULT_MAX_TOPIC_REPEATS = 3
export const DEFAULT_MAX_TURNS_WITHOUT_PROGRESSION = 8
```

### `evaluateTriggers` function

Evaluation order matters — check in priority order:

1. **`turn_threshold`**: `state.interactionCount > 0 && state.interactionCount % policy.turnThreshold === 0`
2. **`topic_repeat`**: any single topic appears ≥ `maxTopicRepeatCount` times in `state.topicsCovered`
3. **`progression_stalled`**: `state.interactionCount >= maxTurnsWithoutProgression` and `state.progression` is still the initial value (empty string or `'none'`)

Return the first matching trigger reason, or `null` if none match.

#### Topic repeat logic

`topicsCovered` is an append-only array — the same topic string can appear more than once if the GM keeps noting it. Count occurrences:

```ts
const counts = new Map<string, number>()
for (const t of state.topicsCovered) {
  counts.set(t, (counts.get(t) ?? 0) + 1)
}
return [...counts.values()].some((count) => count >= maxTopicRepeats)
```

#### Progression stalled logic

"Stalled" means: `interactionCount` has reached the threshold AND `progression` indicates no advancement. For MVP, treat `progression === ''` or `progression === 'none'` as "not yet advanced".

### No side effects

`evaluateTriggers` is a pure function. It reads `state` and `policy` and returns a value. It does not mutate anything.

## Constraints

- No imports from `infrastructure/` or `application/`
- Must be fully unit-testable with no test doubles needed
- YAGNI: implement exactly the three trigger types above — do not add others speculatively
- `'session_start'` and `'manual'` are not evaluated here — they are used as explicit values when the caller decides to force-trigger

## Deliverables

- `apps/core/src/domain/game-master/trigger-engine.ts`
- `apps/core/src/domain/game-master/trigger-engine.test.ts` (co-located unit tests — see prompt 05 for full test suite)

## Mandatory Final Step — Documentation Update

After implementation:

- `docs/GAME_MASTER_CONTRACT.md` — update section 3 or add a new section documenting the trigger rules with their names, condition, and default threshold values
- `docs/PROJECT_STATUS.md` — note that the trigger engine is implemented

## Acceptance Criteria

- [ ] `evaluateTriggers` is a pure function taking `(state, policy?)` and returning `TriggerReason | null`
- [ ] `turn_threshold` fires at every multiple of `turnThreshold` (default 5)
- [ ] `topic_repeat` fires when any topic appears ≥ `maxTopicRepeatCount` times (default 3)
- [ ] `progression_stalled` fires when `interactionCount >= maxTurnsWithoutProgression` and progression has not advanced
- [ ] Returns `null` when no trigger condition is met
- [ ] Default constants are exported and documented
- [ ] Basic unit tests pass (full test suite in prompt 05)
- [ ] `pnpm typecheck` passes
