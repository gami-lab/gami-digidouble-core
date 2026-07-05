# Contract Cleanup for Scenario Builder v1

## Context

EPIC 6.1 touches high-risk shared contracts across Scenario, Avatar, Session, Conversation, Message, GM state/events, and admin DTOs. The admin app will fail long-term if it introduces local copies of payload shapes already used by `apps/core`, `apps/console`, and `apps/web`.

This cleanup prompt exists to prevent contract drift before feature work starts.

## Scope

In scope:

- identify touched entities and transport contracts for scenario-builder workflows
- audit duplicated shape definitions across core API routes, application DTOs, console/web clients, and shared packages
- define canonical ownership for every contract needed by EPIC 6.1
- consolidate duplicate types into canonical shared modules where needed
- normalize optionality/nullability and enum naming for all touched contracts

Out of scope:

- UI implementation
- new endpoint behavior
- data migration beyond what is required to normalize contracts

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
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`

## Implementation Guidance

- Start with an explicit contract inventory for:
  - scenario create/update
  - avatar create/update and visibility
  - knowledge source create/update/upload
  - knowledge visibility policy (avatar subset, all avatars, GM-only world)
  - runtime model assignment (avatar/GM/scenario)
- Search for repeated inline response shapes in API routes and client adapters.
- Prefer canonical contract ownership in shared packages. Avoid introducing app-local DTO definitions for shared HTTP payloads.
- If ownership is ambiguous, create one canonical module and migrate imports incrementally.
- Keep changes surgical: no broad refactor unrelated to EPIC 6.1.

## Constraints

Respect:

- current architecture boundaries (API -> Application -> Domain -> Infrastructure)
- KISS, YAGNI, DRY
- backward compatibility for existing consumers
- explicit contracts with stable naming

## Deliverables

- documented list of touched contracts + owners
- removed or consolidated duplicate DTO/type definitions
- canonical shared contract module(s) for EPIC 6.1 surfaces
- passing typecheck and test suites for touched workspaces

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
- `docs/API_CONTRACT.md` (if transport contracts changed)
- `docs/DATA_MODEL.md` (if persistence model changed)
- `docs/ARCHITECTURE.md` (if module boundaries/ownership changed)

If no doc changes are needed, explicitly confirm docs remain accurate.

## Acceptance Criteria

- [ ] every EPIC 6.1 contract has one canonical owner
- [ ] duplicated local types for touched contracts are removed or merged
- [ ] optionality/nullability are consistent across layers
- [ ] no new contract drift is introduced by this cleanup
- [ ] required documentation review/update completed
