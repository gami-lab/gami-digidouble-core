# 00 — Contract Cleanup And Canonical Memory Ownership

## Context

EPIC 4.2c touches Session, Conversation, Memory, GM input, admin DTOs, and console debug models. This is the highest-risk area for contract drift. The first slice must remove duplication and define one canonical owner for each memory shape before behavior changes begin.

## Scope

Implement now:

- audit current memory-related types across core, shared package, API responses, and console API layer
- remove duplicate inline shapes and conflicting optional/null variants
- define canonical ownership map for memory contracts (domain + shared HTTP DTOs)
- refactor call sites to consume canonical types only

Out of scope:

- new memory algorithms
- schema migrations
- endpoint behavior changes

## Relevant Docs

- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/ARCHITECTURE.md`
- `docs/API_CONTRACT.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/DATA_MODEL.md`
- `docs/TEST_STRATEGY.md`
- `docs/PROJECT_STATUS.md`

## Implementation Guidance

- Use `apps/core/src/domain/memory/memory.types.ts` as canonical domain owner for internal memory-layer contracts.
- Keep HTTP contract ownership in `packages/shared/src/**` where API envelopes are already centralized.
- Ensure `RuntimeContext`, GM input types, admin memory responses, and console query models point to canonical contracts instead of local aliases.
- Resolve nullability drift intentionally:
  - use `undefined` for optional internal fields
  - use explicit `null` only when required by API contract
- Add a short ownership table in code comments or docs where helpful (domain owner vs shared owner).

## Constraints

- Respect API -> Application -> Domain -> Infrastructure layering.
- No `any`; TypeScript strict mode remains clean.
- No new abstractions unless they directly remove duplication.
- Preserve backward-compatible response envelopes unless explicitly versioned.

## Deliverables

- contract-drift audit and cleanup commit
- canonical type reuse across touched modules
- updated tests for changed typing/shape behavior
- documentation updates confirming ownership map and no drift

## Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts.
2. Search for duplicated type definitions.
3. Identify canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- impacted contract docs (`docs/API_CONTRACT.md`, `docs/GAME_MASTER_CONTRACT.md`, `docs/DATA_MODEL.md`)

If no doc changes are needed, explicitly verify docs are still accurate.

## Acceptance Criteria

- [ ] No duplicated memory DTO shape remains across core/shared/console for touched contracts.
- [ ] Canonical ownership is explicit and consistently used.
- [ ] Typecheck passes with strict nullability alignment.
- [ ] Existing API envelopes remain stable or are intentionally updated with doc sync.
- [ ] `docs/PROJECT_STATUS.md` updated.
