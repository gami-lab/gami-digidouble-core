# Refactor The Static Game Master System Prompt Into Explicit Sections

# Context

The current `buildGameMasterSystemPrompt` implementation is a flat sequence of instructions plus a large JSON schema example. It contains the right information, but role definition, policy guidance, schema explanation, and formatting constraints compete for attention in one block.

EPIC 8.3 should make the Game Master easier to steer without changing its responsibilities or output contract.

# Scope

Implement now:

- refactor the static GM system prompt into clearly labeled sections;
- make the GM role and boundaries explicit;
- state the orchestration objectives in priority order;
- reduce repetitive output-contract explanation while preserving the current validation rules;
- add focused prompt-builder tests for section order and invariant rules.

Out of scope:

- reformatting the dynamic `GameMasterInput` payload;
- changing the output parser or normalization logic;
- changing state fields, unlock logic, or routing logic;
- introducing a second competing GM system prompt builder.

# Relevant Docs

- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`
- `apps/core/src/domain/game-master/gm-prompt.service.ts`
- `apps/core/src/domain/game-master/game-master.types.ts`

# Implementation Guidance

- Keep one canonical `buildGameMasterSystemPrompt` path.
- Organize the prompt into explicit sections such as:
  - `## Role`
  - `## Objectives`
  - `## Decision Policies`
  - `## Output Contract`
- In `Role`, state clearly that GM:
  - interprets the latest exchange;
  - evaluates discussion progress and state;
  - decides progression, unlocks, suggestions, or avatar switches when warranted;
  - provides compact guidance for the Avatar;
  - never speaks directly to the user.
- In `Objectives`, keep the emphasis on stable orchestration rather than creativity. Bias toward preserving the current avatar and conversation unless evidence supports change.
- In `Decision Policies`, keep the current hard rules but group them semantically instead of as one unstructured rule list.
- In `Output Contract`, keep the JSON-only requirement and the existing schema constraints, but reduce duplicate wording where possible. A concise schema example plus short field rules is acceptable if all current invariants remain explicit.
- Preserve existing validation-sensitive requirements, including:
  - `avatarId` must match an available avatar;
  - `unlockAvatarIds` can include only locked avatars from `availableAvatars`;
  - `unlockDecisions` must accompany actual unlocks;
  - `nextAvatarId` is only valid when `conversationMode` is `"new"`;
  - `stateUpdate.interactionIncrement` must always be `1`;
  - `context.notes` stays one sentence maximum;
  - session start with empty `userMessage.text` still produces opening guidance rather than a reply.
- Add deterministic unit tests around the static prompt builder itself. Assert section presence and ordering, not just that a string contains one legacy sentence.

# Constraints

Respect:

- current domain ownership of GM prompt assembly;
- no change to the `GameMasterOutput` shape;
- no provider-specific prompt variants;
- no prompt sprawl through duplicate helper functions;
- no hidden behavior change beyond clearer organization and wording.

# Deliverables

- refactored `buildGameMasterSystemPrompt` implementation;
- clear sectioned GM system prompt with stable ordering;
- preserved hard output constraints in concise form;
- new or updated unit tests that protect section order and contract-critical instructions;
- any narrowly required helper extraction for readability.

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

If no doc changes are needed, explicitly verify that docs are still accurate. Code, tests, and docs move together.

# Acceptance Criteria

- [ ] The GM system prompt is visibly organized into explicit sections.
- [ ] GM responsibilities and the “never respond directly to the user” boundary are explicit.
- [ ] Static objectives and decision-policy guidance are clearer than the pre-EPIC flat prompt.
- [ ] Output-contract instructions are shorter or cleaner without losing current validation-critical rules.
- [ ] One canonical GM system prompt builder remains in use.
- [ ] Focused unit tests protect section order and the key contract invariants.
- [ ] Documentation is reviewed or updated before the slice is considered complete.
