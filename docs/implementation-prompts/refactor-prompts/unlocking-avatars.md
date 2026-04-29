You are an expert staff engineer + tech lead assistant for a TypeScript strict modular monolith.

Context:
We need to rework the avatar unlocking mechanism in the AI Guided Discovery scenario and in the generic Core.

Current problem:

- Avatar unlocking is based on deterministic topic keyword matching / regex-like signals.
- Scenario config contains hardcoded unlock messages (`introductionMessage`).
- `SendMessageUseCase` currently applies deterministic topic-signal unlock rules.
- This makes the system fragile, hardcoded, and not aligned with the Director–Actor model.

Target behavior:

- Avatar unlocking must be decided by the Game Master after observing the conversation.
- The Game Master should evaluate the full discussion context and decide whether another avatar should become available.
- Unlocking must not depend on regex, keyword lists, or hardcoded introduction messages.
- Avatars should be aware of other avatars through prompt/context assembly, so they can naturally recommend talking to another avatar when appropriate.
- The Game Master owns the actual unlock decision and updates `session.unlockedAvatarIds`.
- `GET /v1/sessions/{sessionId}/available-avatars` must return the newly available avatars after the GM unlocks them.
- The API should remain headless and stable.

Architectural constraints:

- Preserve the async Director–Actor model: Avatar answers first, GM observes asynchronously.
- Do not put GM decisions in `SendMessageUseCase`.
- Keep the Core generic: no AI Guided Discovery-specific logic in the Core.
- Keep deterministic policy only where it is truly policy; semantic discussion analysis belongs to the GM reasoning layer.
- Keep KISS/YAGNI: no complex graph engine, no new large framework.
- Respect strict TypeScript, existing lint limits, and existing test strategy.

Implementation tasks:

1. Remove brittle unlock config

- Remove `topicSignals` and `avatarAvailability.unlockRules[].introductionMessage` from the AI Guided Discovery seed.
- Replace with a cleaner scenario config such as:
  - `avatarAvailability.initialAvatarKeys`
  - optional `avatarAvailability.unlockableAvatarKeys`
  - optional `avatarRoutingPolicy` / `specialistRoles`
- Do not store user-facing unlock phrasing in scenario config.

2. Add avatar awareness to prompt/context assembly

- When assembling an avatar system prompt, inject a concise list of other active avatars in the scenario:
  - name
  - description
  - competence/scope if available
  - whether currently available/unlocked
- The avatar may suggest another avatar naturally, but cannot unlock it directly.
- Avoid leaking raw internal policy fields.
- Keep the wording generic and reusable across scenarios.

3. Move unlock decision to Game Master

- Extend `GameMasterOutput` with an explicit unlock decision, for example:
  ```ts
  unlockAvatarIds?: string[]
  suggestedAvatarId?: string
  suggestedAvatarReason?: string
  ```

```

or an equivalent minimal structure.

* The GM should decide based on:

  * current conversation messages
  * current avatar
  * scenario goals
  * available locked/unlocked avatars
  * avatar descriptions / competence boundaries
* If GM decides an avatar is now relevant, update `session.unlockedAvatarIds`.
* Do not immediately force a conversation switch unless the GM explicitly returns a valid `nextAvatarId` and `conversationMode: 'new'`.

4. Update `available-avatars`

* Ensure `GET /v1/sessions/{sessionId}/available-avatars` reflects:

  * initial avatars at session start
  * GM-unlocked avatars after relevant turns
* Include only active avatars and respect session unlock state.
* Keep existing legacy behavior for sessions without `unlockedAvatarIds`.

5. Update GM events and debug panel

* Emit a safe GM event when avatars are unlocked:

  * event type can be `gm_avatar_unlocked` or included in `gm_triggered`
  * include avatar IDs and safe reason
  * do not include raw prompt text or full conversation content
* Ensure the GM Debug Panel / inspect endpoint shows updated unlocked avatars and transition/suggestion reasons.

6. Update AI Guided Discovery seed

* Mira should know Theo and Eva exist and may recommend them when useful.
* Theo and Eva remain locked initially.
* Theo and Eva keep their competence boundaries.
* Remove all keyword-based unlock data.
* Remove all hardcoded introduction messages.
* The seed should express roles and boundaries, not trigger mechanics.

7. Tests to add/update

* Unit tests:

  * GM can produce unlock decisions from structured reasoning output.
  * session `unlockedAvatarIds` is updated without duplicates.
  * invalid/non-scenario avatar IDs from GM output are ignored safely.
  * `available-avatars` changes after GM unlock.
  * no unlock happens when GM does not recommend it.
* Acceptance tests:

  * create AI Guided Discovery session.
  * initially only Mira is available.
  * after a technical discussion, GM unlocks Theo.
  * after an ethics/responsibility discussion, GM unlocks Eva.
  * switching to a locked avatar before unlock returns 403.
  * switching after unlock succeeds.
* Regression tests:

  * no keyword list or introductionMessage is required for unlock.
  * SendMessageUseCase no longer owns unlock logic.
  * reset session clears unlocked avatars.

8. Documentation updates
   Update:

* API_CONTRACT.md if response/debug shape changes.
* GAME_MASTER_CONTRACT.md to document GM unlock decisions.
* DATA_MODEL.md if scenario config shape changes.
* PROJECT_STATUS.md after implementation.
* TEST_COVERAGE_PLAN.md if new GM unlock test category is added.

Acceptance criteria:

* No regex/keyword-based unlocking remains in the AI Guided Discovery flow.
* No hardcoded unlock/introduction message remains in scenario config.
* Avatar recommendations come from avatar awareness/context, not config messages.
* GM owns unlock decisions and persists them in session state.
* `available-avatars` is the source of truth for what the user can switch to.
* Existing manual switch locking rules remain valid.
* All tests pass:

  * `pnpm format:check`
  * `pnpm lint`
  * `pnpm typecheck`
  * `pnpm test`

```
