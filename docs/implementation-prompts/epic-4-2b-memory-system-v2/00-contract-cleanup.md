# Contract Cleanup Before Memory V2

## Context

EPIC 4.2b touches existing contracts that already drift:

- `Session.memorySummary` in the session domain model
- `RuntimeContext.memorySummary` / `RuntimeContext.userFacts`
- `SessionMemorySummary` in `@gami/shared`
- `GameMasterInput.context.memory` in documentation but not in code
- admin memory responses derived from only one of those shapes

If feature work starts before contract ownership is cleaned up, Memory v2 will hardcode the same
layer concepts in multiple places and future field additions will fan out across many files.

## Scope

**In scope:**

- identify the canonical owner for memory-layer contracts
- centralize the shapes needed for short-term, working, and long-term memory
- remove obvious duplicated or drifting type definitions before implementing behavior
- align `RuntimeContext`, `GameMasterInput`, and admin-facing DTO mapping to the canonical owner

**Out of scope:**

- storage schema changes
- compaction behavior changes
- new endpoints

## Relevant Docs

- `docs/PRINCIPLES.md` — context is the product; structured control beats prompt sprawl
- `docs/ARCHITECTURE.md` — API → Application → Domain → Infrastructure separation
- `docs/DATA_MODEL.md` §8–10 — SessionMemory, AvatarSessionMemory, UserMemoryFact
- `docs/API_CONTRACT.md` — `SessionMemorySummary` and runtime-context semantics
- `docs/GAME_MASTER_CONTRACT.md` §4 — documented GM memory input shape
- `docs/TEST_COVERAGE_PLAN.md` — memory and context modules already expect layered memory

## Mandatory Pre-Implementation Check

1. Identify every touched entity/contract:
   - `Session`
   - `RuntimeContext`
   - `GameMasterInput`
   - `SessionMemorySummary`
   - `UserFact`
2. Search for duplicated type definitions and repeated inline shapes.
3. Decide the canonical owner for each contract:
   - core domain memory shapes should live in `apps/core/src/domain/memory/`
   - shared HTTP-facing DTOs should live in `packages/shared/src/` only when actually exposed
4. Reuse existing shared types where they already own an API contract.
5. If there is no canonical owner for layered memory contracts, create one before feature work.

## Implementation Guidance

1. Read these files fully before changing anything:
   - `apps/core/src/domain/memory/memory.types.ts`
   - `apps/core/src/domain/context/context.types.ts`
   - `apps/core/src/domain/game-master/game-master.types.ts`
   - `packages/shared/src/lifecycle-types.ts`
   - `apps/core/src/application/use-cases/get-session-memory/get-session-memory.use-case.ts`

2. Introduce canonical layered-memory types in the domain memory module. Keep them small and
   deterministic. Expected concepts:
   - short-term window (`last 2 exchanges`)
   - working memory summary for session scope
   - working memory summary for avatar scope
   - long-term memory facts reused from `UserFact`
   - a read model / snapshot type that can compose those layers

3. Do **not** make `@gami/shared` own internal orchestration-only shapes unless they are part of an
   HTTP or package boundary. Internal memory-layer types should stay in core domain code.

4. Update the GM domain types so the code model matches the already-documented contract direction.
   The goal is not to finalize every v2 field now, but to remove the current mismatch where the
   docs promise `context.memory` and the code omits it.

5. Keep `SessionMemorySummary` backward compatible. If a richer admin DTO is needed later, add a
   new shared type rather than overloading the existing summary contract.

6. Replace repeated inline memory shapes with imports from the canonical owner. If a file only
   needs a subset, use `Pick<>`/`Omit<>` or a thin explicit mapper rather than inventing a new
   structurally identical type.

7. Do not change route behavior in this prompt. This slice is about ownership and compile-time
   drift removal, not feature delivery.

## Constraints

- keep changes backward compatible where possible
- no schema or endpoint changes in this prompt
- do not push admin DTO concerns down into domain code
- avoid introducing one giant polymorphic memory type with optional everything
- prefer a few explicit small types over a catch-all object

## Deliverables

- updated canonical memory types in `apps/core/src/domain/memory/`
- aligned `RuntimeContext` memory fields that point to canonical ownership
- aligned `GameMasterInput` memory fields that no longer drift from docs
- shared DTO ownership left clear and minimal
- updated tests or type-level usages broken by the cleanup

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/API_CONTRACT.md` (only if a shared DTO owner changed)
- `docs/DATA_MODEL.md` (only if the canonical model description drifted)

If no doc changes are needed, explicitly verify that docs still match the post-cleanup contract.

## Acceptance Criteria

- [ ] there is one clear canonical owner for layered memory contracts
- [ ] `GameMasterInput` no longer drifts from the documented memory direction
- [ ] `RuntimeContext` no longer relies on ad hoc flat memory typing alone
- [ ] no new duplicated memory DTOs were introduced
- [ ] `pnpm typecheck` passes
