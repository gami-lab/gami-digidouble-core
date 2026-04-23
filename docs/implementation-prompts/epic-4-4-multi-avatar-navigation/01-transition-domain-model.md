# 01 — Avatar Transition Domain Model & Rule Engine

## Context

EPIC 4.4 introduces the concept of **scenario-configured transition rules** — a declarative way for operators to define when and how users should move from one avatar to another. The trigger engine (EPIC 4.1) already decides _when_ the GM fires; the transition engine decides _which avatar comes next_ and _why_.

These are complementary pure domain functions with no shared state.

The transition engine must be implemented first because every subsequent prompt in this EPIC depends on its types and rule-evaluation function.

---

## Scope

### In scope

- Define `AvatarTransitionRule` as a first-class domain type
- Extend `ScenarioConfig` with an optional `avatarTransitionRules` field
- Implement `domain/avatar/transition-engine.ts` — a pure function `evaluateTransitionRules()`
- Unit tests for all rule types and edge cases

### Out of scope

- API endpoints (Prompts 03 and 04)
- GM integration (Prompt 02)
- UI changes

---

## Relevant Docs

- `docs/ARCHITECTURE.md` — 4-layer boundaries; domain layer has zero external dependencies
- `docs/GAME_MASTER_CONTRACT.md` — Section 5 (`GameMasterOutput.nextAvatarId`, `transitionReason`)
- `docs/DATA_MODEL.md` — `ScenarioConfig` structure
- `docs/PRINCIPLES.md` — KISS, YAGNI; model only what is built today
- `docs/TEST_STRATEGY.md` — Unit tests are deterministic; domain logic must be 100% covered

---

## Implementation Guidance

### Types — `domain/avatar/avatar-transition.types.ts`

Define a new file (do not pollute `avatar.types.ts` or `game-master.types.ts`).

```ts
export type TransitionTriggerType = 'progression' | 'topic_repeat' | 'manual'

export interface AvatarTransitionRule {
  /** Avatar that must be currently active for this rule to apply. */
  fromAvatarId: string
  /** Avatar to transition to when the rule fires. */
  toAvatarId: string
  /** What condition makes this rule eligible. */
  trigger: TransitionTriggerType
  /**
   * For 'topic_repeat' trigger: the specific topic string that must appear
   * in GameMasterState.topicsCovered for this rule to be eligible.
   * Ignored for other trigger types.
   */
  topic?: string
}

export interface EligibleTransition {
  toAvatarId: string
  /** Human-readable reason string included in event payloads and conversation.reason. */
  reason: string
  rule: AvatarTransitionRule
}
```

### Extend `ScenarioConfig` — `domain/scenario/scenario.types.ts`

Add one optional field:

```ts
/** Avatar routing rules evaluated by the transition engine. */
avatarTransitionRules?: AvatarTransitionRule[]
```

Import `AvatarTransitionRule` from the new types file.

### Transition Engine — `domain/avatar/transition-engine.ts`

Implement a single exported pure function:

```ts
export function evaluateTransitionRules(
  currentAvatarId: string | undefined,
  state: GameMasterState,
  rules: AvatarTransitionRule[],
  activeTrigger: 'progression' | 'topic_repeat' | null,
): EligibleTransition[]
```

**Semantics:**

- Returns _all_ rules that are currently eligible, ordered by specificity (most specific first: `topic_repeat` > `progression`).
- A rule is eligible when:
  - `rule.fromAvatarId === currentAvatarId` (or `currentAvatarId` is undefined and `fromAvatarId` is `''` / wildcard — optional, skip if not needed for Phase A)
  - **For `'progression'`:** `activeTrigger === 'progression'` (i.e., the trigger engine also fired `progression_stalled` or `turn_threshold`). Use a loose match: any active trigger can satisfy a progression rule; it is the GM call site that maps triggers.
  - **For `'topic_repeat'`:** `activeTrigger === 'topic_repeat'` AND `rule.topic !== undefined` AND `state.topicsCovered.includes(rule.topic)`.
  - **For `'manual'`**: never returned by `evaluateTransitionRules`. Manual transitions are handled by `SwitchAvatarUseCase` and do not go through this engine.
- Returns `[]` when `rules` is empty or no rule matches.

**Do not throw** — return empty array on any unexpected input.

The `reason` string in `EligibleTransition` should be a stable, readable format:

- `progression` → `"progression_rule:${rule.fromAvatarId}→${rule.toAvatarId}"`
- `topic_repeat` → `"topic_rule:${rule.topic ?? 'unknown'}:${rule.fromAvatarId}→${rule.toAvatarId}"`

### Tests — `domain/avatar/transition-engine.test.ts`

Cover the following cases deterministically (no randomness, no async):

1. **Empty rules list** → returns `[]`
2. **No matching fromAvatarId** → returns `[]`
3. **Progression rule matches when activeTrigger is a progression-type trigger**
4. **Progression rule does not match when activeTrigger is `null`**
5. **Topic repeat rule matches when topic is covered and activeTrigger is `'topic_repeat'`**
6. **Topic repeat rule does not match when topic is NOT covered**
7. **Topic repeat rule does not match when activeTrigger is not `'topic_repeat'`**
8. **Multiple eligible rules returns them all**
9. **Wrong `fromAvatarId` in rule → not returned**
10. **`currentAvatarId` is undefined → no rule matches** (no wildcard in Phase A)

---

## Constraints

- **No side effects** in `transition-engine.ts`. Pure input → output. Same export style as `trigger-engine.ts`.
- Do not modify `game-master.types.ts` — the transition type file is separate and imported independently.
- Do not create a new `AvatarTransitionRepository` — rules are stored in `ScenarioConfig`, retrieved from the existing `IScenarioRepository`.
- `ScenarioConfig` is stored as JSONB in `scenarios.config` — no migration needed; the new field is optional and the column already accepts arbitrary JSON.

---

## Deliverables

- `apps/core/src/domain/avatar/avatar-transition.types.ts` — new file
- `apps/core/src/domain/avatar/transition-engine.ts` — new file
- `apps/core/src/domain/avatar/transition-engine.test.ts` — new file
- `apps/core/src/domain/scenario/scenario.types.ts` — `avatarTransitionRules` field added
- All existing tests still pass

---

## Mandatory Final Step — Documentation Update

After implementation, verify:

- `docs/DATA_MODEL.md` — confirm `ScenarioConfig` section mentions `avatarTransitionRules` (update if not already done; full doc sync is owned by Prompt 05)
- Verify no doc is contradicted by the new types

---

## Acceptance Criteria

- [ ] `AvatarTransitionRule` and `EligibleTransition` types exist and are exported from `avatar-transition.types.ts`
- [ ] `ScenarioConfig.avatarTransitionRules` is optional and typed
- [ ] `evaluateTransitionRules()` returns correct results for all 10 test cases
- [ ] `'manual'` trigger type is defined in the type union but never returned by `evaluateTransitionRules`
- [ ] All existing tests (193) still pass
- [ ] `pnpm lint` and `pnpm typecheck` pass with zero errors
