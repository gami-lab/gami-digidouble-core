# Add Covered Topics To Canonical Working Memory Contracts

## Context

EPIC 8.4 adds one new concept, `coveredTopics`, but that concept must exist consistently anywhere conversation working memory is persisted, loaded, selected, inspected, or serialized. This slice creates the canonical field before prompt logic begins producing it.

## Scope

Implement now:

- extend the internal conversation working-memory contract with `coveredTopics`;
- propagate the field through refresh output types, GM memory context, selected-memory payloads, repository interfaces, repository implementations, and shared DTOs;
- update persistence storage and row mapping so the field survives refresh cycles and inspector queries;
- keep backward-compatible behavior for old rows or in-memory fixtures that do not yet contain `coveredTopics`.

Out of scope:

- changing prompt wording or LLM output guidance;
- changing refresh cadence or trigger policy;
- changing episodic-memory generation rules beyond carrying through the richer working-memory structure where already needed;
- changing GM decision algorithms.

## Relevant Docs

- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/PROJECT_STATUS.md`
- `apps/core/src/domain/memory/memory.types.ts`
- `apps/core/src/application/ports/IConversationWorkingMemoryRepository.ts`
- `apps/core/src/infrastructure/db/repositories/postgres-conversation-working-memory.repository.ts`
- `apps/core/src/infrastructure/db/in-memory-conversation-working-memory.repository.ts`
- `packages/shared/src/memory-contract-types.ts`
- `packages/shared/src/runtime-inspector-types.ts`

## Implementation Guidance

- Treat `coveredTopics` as first-class working-memory state, not a derived UI-only embellishment.
- Canonical domain additions likely belong in:
  - `ConversationWorkingMemory`
  - `ConversationWorkingMemoryRefreshOutput`
  - `GameMasterMemoryContext.workingMemory`
  - `SelectedMemoryPayload.workingMemory`
- Shared DTO additions likely belong in:
  - `SharedWorkingMemoryCurrent`
  - any admin/context response fragments that expose current working memory
  - any memory refresh event payload DTO that carries working-memory details
- Persistence should remain minimal:
  - add a straightforward `covered_topics` storage field to `conversation_working_memories`
  - keep old rows safe by defaulting missing values to `[]`
  - do not introduce a new table or JSON blob if the current schema remains simple
- Update any repository tests and in-memory repository seeds to use the canonical shape rather than ad hoc partials.
- Keep `coveredTopics` normalized and bounded at the contract level only as far as necessary for safety. Do not embed Game Master interpretation rules here.

## Constraints

Respect:

- current memory architecture;
- no speculative new memory entities;
- no cross-layer shortcuts;
- no `any` or lossy generic JSON contracts;
- backward-safe persistence changes only.

## Deliverables

- canonical internal and shared working-memory contracts that include `coveredTopics`;
- repository and persistence support for storing and retrieving `coveredTopics`;
- updated fixtures/tests that compile against the canonical shape;
- compatibility defaults for older persisted or test data.

## Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts.
2. Search for duplicated type definitions.
3. Identify the canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- any outdated impacted docs

Examples:

- `docs/DATA_MODEL.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/GAME_MASTER_CONTRACT.md`

If no doc changes are needed, explicitly verify that docs are still accurate.

## Acceptance Criteria

- [ ] `coveredTopics` exists in the canonical domain working-memory model.
- [ ] `coveredTopics` is persisted and reloaded through both in-memory and Postgres repository paths.
- [ ] Shared DTOs and inspector-facing contracts stay aligned with the canonical model.
- [ ] Older rows or fixtures without `coveredTopics` remain safe via explicit fallback behavior.
- [ ] No new duplicate working-memory contract is introduced.
