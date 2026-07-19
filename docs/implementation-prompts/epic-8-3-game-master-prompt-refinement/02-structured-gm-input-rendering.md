# Render Game Master Runtime Input As Structured Context

# Context

Today `RunGameMasterUseCase` sends the dynamic GM input as `JSON.stringify(gmInput)` inside the LLM user message. The information is correct, but static experience context and current discussion context are mixed inside one raw object dump.

EPIC 8.3 wants clearer prompt readability without changing the underlying `GameMasterInput` contract.

# Scope

Implement now:

- introduce a deterministic rendering path for the dynamic GM input sent to the LLM;
- separate static experience context from current discussion context in the rendered prompt;
- preserve all existing GM input information unless the EPIC explicitly proves a field is redundant;
- keep the canonical `GameMasterInput` type unchanged.

Out of scope:

- changing the `GameMasterInput` TypeScript contract;
- changing memory-selection rules or retrieval behavior;
- changing GM output parsing or normalization;
- adding a new API or observability surface.

# Relevant Docs

- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`
- `apps/core/src/domain/game-master/game-master.types.ts`
- `apps/core/src/domain/game-master/gm-prompt.service.ts`
- `apps/core/src/application/use-cases/run-game-master/run-game-master.use-case.ts`
- `apps/core/src/application/use-cases/run-game-master/run-game-master.context-engine.ts`
- `apps/core/src/application/use-cases/run-game-master/run-game-master.memory-input.use-case.test.ts`

# Implementation Guidance

- Add one canonical formatter for the dynamic prompt input. It may live in the GM domain layer if it is pure rendering logic.
- The formatter must consume `GameMasterInput`; it must not define a competing prompt-only input contract.
- Render sections in a stable order. One acceptable structure is:
  - `## Current Turn`
  - `## Current Discussion Context`
  - `## Experience Context`
  - `## Output Reminder`
- Under `Current Turn`, present the latest user message explicitly, including the session-start case when `userMessage.text` is empty.
- Under `Current Discussion Context`, render:
  - bounded recent exchanges;
  - current GM state;
  - working memory / episodic memory / long-term facts when present;
  - user persona when present.
- Under `Experience Context`, render:
  - scenario description;
  - scenario goals;
  - available avatars with availability state and short descriptors when present;
  - retrieved world/media/memory context if it is still part of GM input.
- Omit empty optional sections rather than emitting noisy placeholders, unless the section is necessary to preserve meaning for a mandatory edge case.
- Keep the rendering concise and deterministic. Avoid dumping full pretty-printed JSON if labeled sections convey the same information more clearly.
- Be careful about duplication:
  - `userMessage.text` may overlap with the newest entry in `recentMessages`;
  - do not introduce confusing double-rendering without intent;
  - if both are retained, label their roles clearly.
- Preserve bounded-context rules: no full transcript replay, no unbounded memory lists, no new retrieval expansion.
- Add dedicated formatter tests or use-case tests that assert sectioned rendering and omission of empty optional blocks.

# Constraints

Respect:

- current `GameMasterInput` contract ownership;
- deterministic formatting only;
- no new runtime fields;
- bounded context rules from the memory spec;
- no leakage of credentials, raw provider config, or hidden prompt internals.

# Deliverables

- a canonical GM input-rendering helper;
- `RunGameMasterUseCase` updated to send the rendered GM input content through the LLM call path;
- focused tests proving static experience context and current discussion context are visibly separate;
- compatibility handling for empty or partially populated optional sections.

# Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts.
2. Search for duplicated type definitions.
3. Identify the canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

# Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- any outdated impacted docs

Examples:

- `docs/GAME_MASTER_CONTRACT.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/ARCHITECTURE.md`
- `docs/TEST_STRATEGY.md`

If no doc changes are needed, explicitly verify that docs are still accurate. Code, tests, and docs move together.

# Acceptance Criteria

- [ ] Dynamic GM input is rendered through one canonical formatter rather than an inline raw JSON dump.
- [ ] Static experience context and current discussion context are visibly separate in the prompt.
- [ ] `GameMasterInput` field ownership and TypeScript contract remain unchanged.
- [ ] Empty optional inputs are omitted cleanly without misleading placeholder text.
- [ ] Recent exchanges, memory, persona, and avatar availability remain bounded and represented when present.
- [ ] Tests protect deterministic section order and omission behavior.
- [ ] Documentation is reviewed or updated before the slice is considered complete.
