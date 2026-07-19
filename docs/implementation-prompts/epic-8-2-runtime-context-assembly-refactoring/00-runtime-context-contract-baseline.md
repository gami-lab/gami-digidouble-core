# Establish Runtime Context Contract Ownership

# Context

EPIC 8.2 changes an existing high-fanout path: Avatar prompt assembly consumes the output of `ContextEngine` and is observed through session context, event payloads, admin APIs, and console adapters.

The repository already has canonical internal context contracts in `apps/core/src/domain/context/`, shared runtime-inspector DTOs in `packages/shared/src/runtime-inspector-types.ts`, and a shared Avatar API shape in `packages/shared/src/entity-types.ts`. The first implementation slice must prevent a new set of local context or trait shapes from appearing across those layers.

# Scope

Implement now:

- audit the contracts touched by runtime prompt assembly and computed Avatar traits;
- identify and consolidate duplicate context, Avatar, trace, and local response shapes that the refactor would otherwise multiply;
- document the canonical owner for each new or changed field;
- establish the compatibility boundary between the EPIC 8.1 `computedTraits` contract and the existing `personaPrompt` input.

Out of scope:

- changing prompt section order;
- changing the EPIC 8.1 trait schema;
- regenerating or persisting traits;
- changing retrieval behavior;
- adding an HTTP endpoint or UI feature.

# Relevant Docs

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
- `docs/implementation-prompts/epic-8-1-avatar-trait-structuring/README.md`

# Implementation Guidance

- Start with an inventory of the runtime path:
  - `apps/core/src/domain/context/context-engine.types.ts`
  - `apps/core/src/domain/context/context-engine.policy.ts`
  - `apps/core/src/domain/context/context-engine.service.ts`
  - `apps/core/src/domain/context/session-context.types.ts`
  - `apps/core/src/domain/avatar/avatar.types.ts`
  - `apps/core/src/domain/avatar/persona-prompt.service.ts`
  - `apps/core/src/application/use-cases/send-message/`
  - `apps/core/src/application/services/runtime-inspector-event-context.ts`
  - `packages/shared/src/runtime-inspector-types.ts`
- Search for duplicated definitions of `AvatarSummary`, Avatar runtime config, context snapshots, context segment IDs, prompt inputs, and context trace metadata in `apps/core`, `apps/admin`, `apps/console`, `apps/web`, tests, and seed helpers.
- Reuse the EPIC 8.1 canonical `AvatarComputedTraits` type. Do not redefine the seven fields locally in the prompt service, context engine, route tests, or UI clients.
- Keep the ownership split explicit:
  - domain/runtime types belong under `apps/core/src/domain/`;
  - shared HTTP and inspector DTOs belong under `packages/shared/src/`;
  - API handlers map between them;
  - admin and console consume shared contracts and do not recreate them.
- Treat `computedTraits: null` or an absent field as a compatibility state. Do not make older avatars fail to answer solely because preparation has not run.
- If a contract must change, update all actual consumers in the same slice. Do not leave a type alias or test fixture with a stale field set.

# Constraints

Respect:

- current four-layer architecture;
- KISS, YAGNI, and DRY;
- backward compatibility for avatars created before EPIC 8.1;
- the existing `undefined` versus explicit `null` contract policy;
- no new persistence or source-data model;
- no new HTTP endpoint for this EPIC.

# Deliverables

- a verified inventory of touched contracts;
- consolidated canonical types or imports for any duplicate shapes discovered;
- an explicit compatibility decision for `computedTraits` versus `personaPrompt`;
- updated tests or fixtures required by the contract cleanup;
- documentation of any ownership decisions needed by later prompts.

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

- `docs/API_CONTRACT.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
- `docs/TEST_STRATEGY.md`

If no doc changes are needed, explicitly verify that docs are still accurate. Code, tests, and docs move together.

# Acceptance Criteria

- [ ] Every changed Avatar, context, and trace contract has one canonical owner.
- [ ] No new local copy of the EPIC 8.1 trait shape exists.
- [ ] The compatibility behavior for avatars without `computedTraits` is explicit and tested where practical.
- [ ] Admin, console, web, seed, and test consumers do not retain stale duplicate shapes.
- [ ] Later prompts can change section ordering without reopening contract ownership questions.
- [ ] Documentation is reviewed or updated before the slice is considered complete.
