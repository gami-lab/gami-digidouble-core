# Establish Working Memory Contract Ownership

## Context

EPIC 8.4 looks small on paper, but `coveredTopics` touches a high-fanout model that already appears in domain memory types, persistence adapters, GM context assembly, admin/runtime inspection DTOs, console diagnostics, and multiple tests with local inline shapes.

The first slice must prevent the prompt refinement from creating duplicate working-memory contracts or partial one-off fields that only exist in one layer.

## Scope

Implement now:

- audit the current working-memory path end to end;
- identify duplicated or competing working-memory shapes before adding `coveredTopics`;
- define canonical ownership for internal/domain memory contracts, shared HTTP/admin DTOs, event payload fragments, and test fixtures;
- remove or consolidate any local type copies that would otherwise drift once `coveredTopics` is added.

Out of scope:

- changing the working-memory refresh cadence;
- changing memory architecture or introducing a new memory layer;
- redesigning Game Master state;
- changing any public route set;
- tuning prompt wording beyond what is required to unblock later slices.

## Relevant Docs

- `docs/VISION.md`
- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/DATA_MODEL.md`
- `docs/API_CONTRACT.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`
- `apps/core/src/domain/memory/memory.types.ts`
- `apps/core/src/application/services/memory-maintenance.service.ts`
- `apps/core/src/application/use-cases/run-game-master/run-game-master.use-case.ts`
- `apps/core/src/application/use-cases/run-game-master/run-game-master.context-engine.ts`
- `apps/core/src/application/services/runtime-inspector-event-context.ts`
- `packages/shared/src/memory-contract-types.ts`
- `packages/shared/src/runtime-inspector-types.ts`

## Implementation Guidance

- Start with an inventory of where working memory is defined or mirrored today:
  - `ConversationWorkingMemory`
  - `ConversationWorkingMemoryRefreshOutput`
  - `GameMasterMemoryContext`
  - `SelectedMemoryPayload`
  - shared DTO fragments in `packages/shared`
  - runtime event payload fragments for memory refresh and inspector traces
- Search for duplicated local shapes in tests and adapter code. Current likely hotspots include:
  - `apps/core/src/application/use-cases/run-game-master/run-game-master.memory-input.use-case.test.ts`
  - `apps/core/src/api/routes/admin-memory.test.ts`
  - `apps/core/src/api/routes/admin-session-context.test.ts`
  - console component tests that inline working-memory fragments
- Keep ownership explicit:
  - internal/domain working-memory contracts live in `apps/core/src/domain/memory/memory.types.ts`
  - persistence row mapping stays in infrastructure repositories
  - shared admin/HTTP DTOs stay in `packages/shared/src/*memory*` and composed runtime-inspector types
  - prompt-building helpers consume canonical contracts and do not redefine them
- If you must keep a compatibility field such as `workingSummary`, document whether it is a mirror of the richer working-memory object and prevent new data from living only in the mirror.
- Preserve the repo’s nullability policy:
  - internal/domain optional fields use `undefined`
  - explicit `null` is reserved for shared HTTP contracts that intentionally require it

## Constraints

Respect:

- the four-layer architecture;
- KISS, YAGNI, and DRY;
- no new working-memory architecture;
- no provider-specific behavior in domain types;
- no endpoint additions;
- no silent divergence between GM memory input, admin DTOs, and persisted working-memory shape.

## Deliverables

- a verified inventory of touched working-memory contracts and files;
- one canonical owner for every working-memory field touched by EPIC 8.4;
- removal or prevention of duplicate local working-memory shapes that would drift after `coveredTopics` is added;
- narrowly scoped fixture/type cleanup that unblocks later slices.

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

- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/API_CONTRACT.md`
- `docs/TEST_STRATEGY.md`

If no doc changes are needed, explicitly verify that docs are still accurate. Code, tests, and docs move together.

## Acceptance Criteria

- [ ] Every changed working-memory contract has one canonical owner.
- [ ] No new local copy of working-memory DTOs is introduced in tests, use cases, or console adapters.
- [ ] It is explicit which fields belong to internal working memory versus compatibility mirrors.
- [ ] Later prompts can add `coveredTopics` without reopening ownership questions.
- [ ] Documentation is reviewed or updated before the slice is considered complete.
