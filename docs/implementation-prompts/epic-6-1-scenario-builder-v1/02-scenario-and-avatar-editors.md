# Scenario and Avatar Editors (Objectives, World Context, Persona, Visibility)

## Context

The core product value of EPIC 6.1 is letting operators author scenario content without touching seed scripts. This slice delivers the main authoring workflow for scenarios and avatars.

## Scope

In scope:

- scenario create/update form flows including objectives and world context
- avatar create/update flows tied to scenario ownership
- avatar `personaPrompt` editing
- initial avatar visibility configuration (visible/hidden at start)
- persistence through canonical core endpoints/use cases

Out of scope:

- knowledge-source upload and visibility matrices
- runtime model assignment UI
- advanced collaborative editing

## Relevant Docs

- `docs/VISION.md`
- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
- `docs/API_CONTRACT.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/TEST_STRATEGY.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`

## Implementation Guidance

- Reuse existing scenario/avatar APIs where complete; add only missing fields/flows required by EPIC 6.1.
- Ensure objectives and world context have explicit validation and serialization rules at API boundaries.
- Ensure avatar visibility semantics align with GM/runtime behavior (initially visible vs hidden until unlocked).
- Keep editor state and transport DTO mapping explicit and strongly typed.
- If seed scripts currently hold canonical content not expressible by API, close that gap through API use cases rather than app-specific shortcuts.

For each new endpoint introduced, add:

- unit tests for application/domain logic
- integration tests for route + repository behavior
- stack-e2e file: `apps/core/src/api/routes/<route-name>.stack-e2e.test.ts`

Each stack-e2e file must cover auth (`401`), validation (`400`), and not-found (`404` + envelope code).

## Constraints

Respect:

- architecture and module ownership
- KISS, YAGNI, DRY
- no endpoint behavior hidden in frontend-only logic
- backward compatibility where relevant

## Deliverables

- admin scenario editor with objectives + world context
- admin avatar editor with persona prompt + initial visibility
- API/use-case support for any missing fields needed by editor flows
- tests for new or changed backend/frontend behavior

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
- `docs/API_CONTRACT.md`
- `docs/DATA_MODEL.md` (if fields/storage changed)
- `docs/GAME_MASTER_CONTRACT.md` (if visibility semantics changed)

If no doc changes are needed, explicitly confirm docs remain accurate.

## Acceptance Criteria

- [ ] admin can create/update scenario with objectives and world context
- [ ] admin can create/update avatars with persona prompt
- [ ] admin can define avatar initial visibility in scenario
- [ ] backend contract and persistence support all edited fields
- [ ] every new endpoint includes required stack-e2e coverage
- [ ] required documentation review/update completed
