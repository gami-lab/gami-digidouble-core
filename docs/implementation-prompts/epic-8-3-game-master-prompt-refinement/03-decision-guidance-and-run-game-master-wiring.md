# Strengthen Decision Guidance And Wire The Refined GM Prompt Path

# Context

Once the static GM system prompt and dynamic input rendering are both structured, the remaining EPIC 8.3 risk is behavioral ambiguity: the GM may still over-switch, over-unlock, or over-update progression if the decision priorities are vague.

This slice should make the prompt encourage evidence-based orchestration while keeping all existing runtime guards, parsers, and event safety behavior in place.

# Scope

Implement now:

- strengthen the decision-policy guidance in the GM prompt around evidence-based updates;
- wire the final refined prompt path through `RunGameMasterUseCase`;
- keep the existing `GameMasterOutput` parser and normalization behavior compatible;
- update consumer-facing tests so they validate the actual prompt request content instead of assuming the LLM input remains raw JSON.

Out of scope:

- changing the output JSON schema;
- changing unlock validation or avatar-reference normalization rules;
- adding new GM state fields or event payload fields;
- changing scenario, memory, or retrieval selection algorithms.

# Relevant Docs

- `docs/PRINCIPLES.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`
- `apps/core/src/domain/game-master/gm-prompt.service.ts`
- `apps/core/src/domain/game-master/game-master.types.ts`
- `apps/core/src/application/use-cases/run-game-master/run-game-master.use-case.ts`
- `apps/core/src/application/use-cases/run-game-master/run-game-master.helpers.ts`
- `apps/core/src/application/use-cases/run-game-master/run-game-master.normalization.ts`
- `apps/core/src/application/use-cases/run-game-master/run-game-master.use-case.test.ts`
- `apps/core/src/application/use-cases/run-game-master/run-game-master.avatar-unlocks.use-case.test.ts`

# Implementation Guidance

- In the decision-policy section, guide the GM through explicit priority questions such as:
  - did the latest exchange materially change the discussion state?
  - did trust, clarity, or emotional tone change in a way that matters for orchestration?
  - was meaningful progress made, or should progression remain stable?
  - is another avatar merely relevant, newly unlockable, or actually necessary as the active speaker?
  - what one-sentence guidance would most help the current Avatar on the next turn?
- Bias toward stability:
  - keep `conversationMode: "continue"` unless there is clear evidence for a switch;
  - avoid increasing progression on every turn by default;
  - avoid unlocks based on weak association or generic mention;
  - prefer suggestions over forced switches when a handoff is not necessary.
- Keep the existing output validation pipeline intact:
  - `safeParseGameMasterOutput`
  - `normalizeGameMasterOutput`
  - unlock rejection for invalid or unmentioned avatars
- Wire the final prompt path through the actual `llm.complete` request used by `RunGameMasterUseCase`. Do not create a side path used only in tests.
- Update tests from the consumer boundary:
  - inspect the `systemPrompt` and message content actually sent to `llm.complete`;
  - assert the presence of the new GM sections and decision guidance;
  - stop relying on `JSON.parse(request.messages[0].content)` once the formatter is no longer raw JSON.
- Preserve the session-start behavior for empty `userMessage.text`. The prompt must still steer the opening turn without pretending there was user content.
- Preserve event safety. Prompt refinement must not cause raw prompt text or sensitive hidden content to leak through GM event payloads or runtime-inspector projections.

# Constraints

Respect:

- no contract drift in `GameMasterOutput`;
- existing async GM architecture and non-blocking execution;
- no new provider coupling;
- deterministic tests over prose-quality tests;
- no change in meaning for already-validated edge cases unless explicitly required by EPIC 8.3.

# Deliverables

- final refined GM prompt path wired through `RunGameMasterUseCase`;
- clearer decision-policy guidance that favors stable, evidence-based orchestration;
- updated consumer-oriented GM use-case tests;
- preserved parser, normalization, and event-safety behavior.

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
- `docs/ARCHITECTURE.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`

If no doc changes are needed, explicitly verify that docs are still accurate. Code, tests, and docs move together.

# Acceptance Criteria

- [ ] The refined GM prompt makes decision priorities explicit and evidence-based.
- [ ] The GM prompt clearly biases against unnecessary switches, unlocks, and progression changes.
- [ ] `RunGameMasterUseCase` uses the refined prompt path in production code, not only in tests.
- [ ] Existing output parsing, normalization, and unlock validation still protect the runtime contract.
- [ ] Consumer-facing tests assert the actual request content sent to the LLM.
- [ ] Session-start guidance with empty `userMessage.text` remains supported.
- [ ] Documentation is reviewed or updated before the slice is considered complete.
