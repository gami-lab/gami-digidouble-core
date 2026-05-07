# Contract Cleanup And Console Path Pruning

## Context

The current console has accumulated overlapping debug paths and UI leftovers. The redesign must not add more surface area on top of existing drift. This slice removes structural entropy first.

## Scope

Implement now:

- Identify and remove duplicate runtime-inspector contract shapes in console code.
- Ensure all runtime-inspector/debugging data contracts come from canonical shared owners.
- Inventory console debug entry points and mark one official debugging path.
- Remove or deprecate obsolete UI branches that duplicate the same debugging intent.

Out of scope:

- Final memory/GM/latency UX redesign details (handled in later prompts).
- New backend feature endpoints unless a hard capability gap is proven.

## Relevant Docs

- docs/VISION.md
- docs/PRINCIPLES.md
- docs/ARCHITECTURE.md
- docs/TECH_STACK.md
- docs/API_CONTRACT.md
- docs/DATA_MODEL.md
- docs/TEST_STRATEGY.md
- docs/EPICS.md
- docs/PROJECT_STATUS.md

## Implementation Guidance

- Audit runtime-inspector related contracts in:
  - apps/console/src/api
  - apps/console/src/components
  - packages/shared/src/runtime-inspector-types.ts
- Enforce shared-type imports and remove local duplicate type aliases/inline response copies.
- Create a short console-path inventory document inside this EPIC folder that lists:
  - kept path
  - removed path
  - redirected path
  - rationale per removal
- Keep changes minimal and mechanical where possible.

## Constraints

- Respect existing layering: console consumes API contracts; it does not redefine backend DTOs.
- KISS, DRY, YAGNI.
- Keep backward compatibility only where necessary for active development flow.
- Do not add speculative abstractions.

## Deliverables

- Contract deduplication changes in console runtime inspector surfaces.
- Cleanup of obsolete console debugging entry points and components.
- Tests adjusted to validate canonical contract usage (not local shape copies).

## Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts.
2. Search for duplicated type definitions.
3. Identify canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

## Mandatory Final Step — Documentation Update

After implementation, review and update:

- docs/PROJECT_STATUS.md
- docs/API_CONTRACT.md (if visible API shape changed)
- docs/ARCHITECTURE.md (if console module boundaries changed)

If no doc changes are needed, explicitly verify docs are still accurate.

## Acceptance Criteria

- [ ] Console runtime-inspector contracts are canonical and non-duplicated.
- [ ] Exactly one primary debugging path is defined.
- [ ] Obsolete debug UI branches are removed or clearly redirected.
- [ ] Related tests pass and do not assert duplicated local contract shapes.
- [ ] Documentation is synchronized.
