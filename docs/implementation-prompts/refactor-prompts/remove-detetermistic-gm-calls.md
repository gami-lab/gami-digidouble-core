You are an expert staff engineer + tech lead for a strict TypeScript modular monolith.

Context:
We need to simplify multi-avatar orchestration. The previous implementation kept legacy transition helpers and deterministic trigger rules for topic/progression/manual transitions. This is no longer desired.

Product decision:
The Game Master must run asynchronously after every user/avatar interaction.
It must not wait for pacing thresholds to decide whether an avatar should be unlocked, suggested, or switched.
Pacing may remain a soft signal inside the GM context, but it must not be a gate that prevents GM reasoning.

Core direction:

- Configuration must stay simple.
- Scenario config describes the world, goals, and avatar availability.
- Avatar config describes the avatar.
- Complex transition rules do not belong in avatar config.
- We do not want `avatarTransitionRules`, `topicSignals`, `unlockRules`, keyword lists, regex triggers, or introduction messages.
- Avatar routing is a Game Master responsibility.
- `available-avatars` remains the source of truth for what the user can switch to.

Architectural constraints:

- Keep the async Director–Actor model: Avatar responds first; GM observes after the turn.
- GM must be fire-and-forget from the user response path.
- GM errors must never break message sending.
- Keep KISS/YAGNI: no graph engine, no complex rule engine.
- Keep strict TypeScript and existing lint limits.

Implementation tasks:

1. Remove legacy transition helpers

- Delete or deprecate completely:
  - `avatarTransitionRules`
  - topic/progression/manual transition rule evaluation
  - topic keyword signal matching
  - deterministic unlock rules
  - introduction messages
  - eligible transition filtering based on configured transition rules
- Remove references from:
  - domain types
  - scenario config schemas
  - seed data
  - tests
  - docs
- Do not keep compatibility helpers unless strictly required by a current test. If tests depend on them, update the tests to the new model.

2. Simplify ScenarioConfig
   Target shape should be closer to:

```ts
type ScenarioConfig = {
  worldContext?: string
  objectives?: string[]
  goals?: string[]
  avatarAvailability?: {
    initialAvatarKeys: string[]
    unlockableAvatarKeys?: string[]
  }
  runtimeDefaults?: Record<string, unknown>
  uiHints?: Record<string, unknown>
}
```

No keyword triggers.
No scripted unlock text.
No transition rule lists.

3. Make GM run after every interaction
   Update `RunGameMasterUseCase` so each completed avatar turn triggers GM evaluation asynchronously.

New flow:

1. Load GM state.
2. Build `GameMasterInput`.
3. Include recent messages and avatar availability context.
4. Call GM LLM every turn.
5. Parse `GameMasterOutput`.
6. Validate unlock/suggestion/switch decisions.
7. Persist state update.
8. Persist valid unlocks into `session.unlockedAvatarIds`.
9. Store concise GM notes if provided.
10. Optionally switch avatar only if GM explicitly returns a valid `nextAvatarId` with `conversationMode: 'new'`.
11. Emit `gm_triggered` for every successful GM run.
12. Emit `gm_error` or safe failure event if GM fails.

There should be no `gm_skipped` caused by pacing thresholds anymore.

4. Keep pacing only as context, not as a trigger gate

- `interactionCount` remains useful.
- `topicsCovered` remains useful if the GM returns them.
- Progression remains useful.
- But none of them should prevent the GM from running.
- Remove `evaluateTriggers` as the gatekeeper.
- If kept temporarily, it must not decide whether the GM runs.

5. Update GM contract
   Update `GAME_MASTER_CONTRACT.md`:

- GM runs after every interaction.
- Remove trigger threshold priority.
- Remove `turn_threshold`, `topic_repeat`, `progression_stalled` as gating concepts.
- Replace `triggerReason` with something like:
  - `post_turn_observation`
  - `session_start`
  - `manual`

- Keep the rule that GM is async and non-blocking.
- Keep the rule that GM does not answer the user directly.

6. Update diagnostics

- Replace `gm_skipped` threshold behavior with:
  - `gm_triggered` for successful post-turn GM decisions
  - `gm_error` for safe failures, if this event type exists or can be added

- Event payload must remain safe:
  - no raw prompt
  - no raw full conversation
  - no credentials
  - no model internals beyond existing safe metrics

- Include:
  - turn index
  - active avatar
  - unlocked avatar IDs
  - suggested avatar ID/reason
  - whether notes were injected
  - whether conversation switch happened

7. Update AI Guided Discovery seed

- Remove all old transition/topic/unlock rule fields.
- Keep only:
  - world context
  - objectives/goals
  - `avatarAvailability.initialAvatarKeys: ['guide']`
  - `avatarAvailability.unlockableAvatarKeys: ['theo', 'eva']`

- Ensure Mira knows Theo and Eva exist through avatar awareness context, not scripted config.
- Ensure Theo and Eva remain locked until GM unlocks them.

8. Update API and available avatars

- `GET /v1/sessions/{sessionId}/available-avatars` must continue to return only currently switchable avatars.
- Locked avatars may appear only in GM/avatar internal context, not as switchable API results.
- Manual switch to locked avatar must still return `403`.
- After GM unlock, manual switch must succeed.

9. Update tests
   Remove tests for:

- topic keyword triggers
- transition rules
- eligible transition rule filtering
- threshold-gated GM LLM calls
- `gm_skipped` due to no deterministic trigger

Add/update tests for:

- GM is called after every avatar turn.
- GM unlocks a specialist on the first relevant technical turn.
- GM unlocks a specialist on the first relevant ethics turn.
- no keyword list is required for unlock.
- invalid GM unlock IDs are ignored.
- already unlocked IDs are not duplicated.
- manual switch before unlock returns 403.
- manual switch after unlock succeeds.
- available avatars reflect session unlock state.
- GM failure does not break send-message.
- reset restores initial avatar availability.

10. Update docs
    Update:

- DATA_MODEL.md: remove `avatarTransitionRules`, `topicSignals`, unlock rules, and transition settings from typical config.
- GAME_MASTER_CONTRACT.md: GM runs after every turn; no threshold gate.
- API_CONTRACT.md: keep `GameMasterOutput` aligned.
- PROJECT_STATUS.md: document simplification and removal of legacy transition helpers.
- TEST_COVERAGE_PLAN.md: remove transition rule tests; add every-turn GM and unlock validation tests.
- EPICS.md if it still describes rule-based transition evaluation as the current model.

Acceptance criteria:

- No legacy transition helper remains in active runtime code.
- No keyword/regex/topic-signal unlock mechanism remains.
- No deterministic pacing threshold prevents GM evaluation.
- GM runs asynchronously after every avatar turn.
- Scenario setup is simple and does not require transition rules.
- AI Guided Discovery works with only initial/unlockable avatar availability.
- `available-avatars` remains the client source of truth.
- All quality gates pass:
  - pnpm format:check
  - pnpm lint
  - pnpm typecheck
  - pnpm test
