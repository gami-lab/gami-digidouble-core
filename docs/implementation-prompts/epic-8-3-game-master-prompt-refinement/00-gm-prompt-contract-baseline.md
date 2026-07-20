# Establish Game Master Prompt Contract Ownership

# Context

EPIC 8.3 does not add a new Game Master capability. It refines an existing high-fanout prompt path that already crosses domain prompt assembly, the `RunGameMasterUseCase`, output parsing and normalization, event logging, and multiple unit tests.

Today the static GM rules live in `apps/core/src/domain/game-master/gm-prompt.service.ts`, while the dynamic runtime input is serialized inline inside `apps/core/src/application/use-cases/run-game-master/run-game-master.use-case.ts`. Several tests also inspect that request shape directly. The first slice must prevent prompt-refinement work from creating duplicate local input/output contracts or hidden prompt-only shapes.

# Scope

Implement now:

- audit the current Game Master prompt path end to end;
- identify duplicated or competing prompt/input/output shapes that EPIC 8.3 would otherwise multiply;
- define canonical ownership for static prompt sections, dynamic GM input rendering, and runtime contract types;
- establish the compatibility boundary so prompt refinement does not silently change `GameMasterInput`, `GameMasterOutput`, GM state, or event payload contracts.

Out of scope:

- changing the Game Master JSON output schema;
- changing `GameMasterInput` field names or nullability;
- adding new GM state fields;
- changing GM unlock, transition, or memory-selection algorithms;
- adding an API endpoint, admin UI, or console feature.

# Relevant Docs

- `docs/VISION.md`
- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/API_CONTRACT.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`
- `apps/core/src/domain/game-master/gm-prompt.service.ts`
- `apps/core/src/domain/game-master/gm-input-renderer.ts`
- `apps/core/src/domain/game-master/game-master.types.ts`
- `apps/core/src/domain/game-master/gm-output-parser.ts`
- `apps/core/src/domain/game-master/gm-output-normalization.ts`
- `apps/core/src/application/use-cases/run-game-master/run-game-master.use-case.ts`
- `apps/core/src/application/use-cases/run-game-master/run-game-master.context-engine.ts`
- `packages/shared/src/runtime-inspector-types.ts`

# Implementation Guidance

- Start with an inventory of the current prompt path:
  - static instructions from `buildGameMasterSystemPrompt`;
  - dynamic input rendering inside `renderGameMasterInputForLlm` / `RunGameMasterUseCase.callLlm`;
  - GM domain types in `game-master.types.ts`;
  - parse/normalize guards in `gm-output-parser.ts` and `gm-output-normalization.ts`;
  - event and inspector shapes that expose GM summaries without prompt leakage.
- Search for duplicated GM request/response shapes in:
  - `apps/core/src/application/use-cases/run-game-master/*.test.ts`
  - route tests that inspect GM events
  - any helper-local `type` aliases that re-express `GameMasterInput`, `GameMasterOutput`, or GM context fragments.
- Keep ownership explicit:
  - domain/runtime contracts belong in `apps/core/src/domain/game-master/`;
  - prompt-building helpers stay in the domain layer unless they depend on application-only data loading;
  - shared HTTP/runtime-inspector DTOs stay in `packages/shared/src/`;
  - tests should consume canonical types where practical instead of recreating local prompt contracts.
- If you introduce a dedicated GM input formatter for the LLM message content, treat it as an internal rendering concern, not a new runtime contract. It should consume `GameMasterInput`; it must not replace or fork it.
- Keep the current internal optionality policy:
  - domain/internal optional fields use `undefined`;
  - explicit `null` remains reserved for shared HTTP contracts that intentionally require it.
- Record any contract decisions needed by later prompts in code comments or adjacent docs only when necessary. Do not add speculative abstraction layers.

# Constraints

Respect:

- the existing four-layer architecture;
- KISS, YAGNI, and DRY;
- no Game Master API contract changes in this EPIC;
- no provider-specific logic in domain prompt code;
- no new persistence or event fields;
- no prompt-only behavior that bypasses existing validation and normalization guards.

# Deliverables

- a verified inventory of touched GM prompt contracts and files;
- consolidated canonical ownership for static prompt text, dynamic prompt rendering, and runtime types;
- removal or prevention of duplicate GM prompt/test-only shapes discovered during the audit;
- any narrowly required fixture updates so later prompts can change prompt rendering safely;
- documented constraints for later EPIC 8.3 slices.

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
- `docs/API_CONTRACT.md`
- `docs/TEST_STRATEGY.md`

If no doc changes are needed, explicitly verify that docs are still accurate. Code, tests, and docs move together.

# Acceptance Criteria

- [ ] Every changed GM prompt/input/output contract has one canonical owner.
- [ ] No new local copy of `GameMasterInput`, `GameMasterOutput`, or GM event decision fields is introduced.
- [ ] It is explicit whether dynamic GM input rendering is an internal formatter or a contract change.
- [ ] Existing parser, normalization, unlock validation, and event payload contracts remain protected.
- [ ] Later prompts can refactor prompt wording and layout without reopening contract ownership questions.
- [ ] Documentation is reviewed or updated before the slice is considered complete.
