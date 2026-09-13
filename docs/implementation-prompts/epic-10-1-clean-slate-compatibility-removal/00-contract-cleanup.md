# Prompt 0 — Establish Canonical Contracts And Remove Duplication

# Context

EPIC 10.1 removes compatibility behavior across entities that already have high fan-out: Avatar,
Scenario, Session, Conversation, Message, Game Master state/events, shared DTOs, and admin/console
projections. The audit also found local response shapes, aliases, and optional fields that can cause
contract drift during the cleanup.

This prompt is the mandatory contract-baseline slice. It creates one current contract map and removes
structural duplication before later prompts delete compatibility branches. Do not let the cleanup
produce another local copy of a type in a different layer.

# Scope

Implement now:

- inventory every touched entity and contract across `packages/shared`, `apps/core`, `apps/admin`,
  `apps/console`, `apps/web`, repositories, API routes, and tests;
- identify duplicated type definitions, inline response shapes, inconsistent optionality/nullability,
  and field-name drift for the EPIC’s affected models;
- designate or create the canonical owner for each current contract, then update consumers to import
  that contract instead of maintaining local copies;
- freeze the current-only vocabulary needed by later prompts: canonical knowledge types, explicit
  visibility policy, Scenario language, Avatar `availabilityKey`/prepared traits, current session
  memory projections, current GM orchestration/output, and current event projections;
- remove duplicate-only types and obsolete aliases where doing so does not require a later runtime
  migration slice;
- add focused contract/type tests for the canonical shapes and compile-time consumers where the
  existing test conventions support them.

Out of scope:

- deleting the database alignment mechanism;
- deleting the knowledge migration/quarantine implementation;
- deleting `memory_summary` persistence;
- removing GM migration/parser branches or content fallbacks;
- adding new HTTP endpoints or changing product behavior beyond contract consolidation.

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
- `docs/EPICS.md` — EPIC 10.1
- `docs/PROJECT_STATUS.md`
- `docs/LEGACY_COMPATIBILITY_AUDIT.md`

# Implementation Guidance

1. Start with repository-wide searches for entity names and audit identifiers, not with edits. Build
   a compact map of each contract’s domain, application, API, persistence, shared, and UI consumers.
2. For every touched entity, locate duplicate interfaces/types, repeated inline JSON response shapes,
   nullable variants, and string unions copied between packages. Record the canonical owner in the
   implementation notes or an existing ownership document rather than inventing a new registry.
3. Keep domain entities independent from API serialization and infrastructure row types. Use explicit
   mappers at boundaries, following the four-layer architecture.
4. Reuse existing shared DTOs where they are truly public contracts. If a current internal shape is
   missing an owner, create the smallest canonical type in the layer that owns it and migrate all
   consumers to that type.
5. Preserve current fields that are still product behavior. Do not remove a field merely because it
   has a similarly named legacy field; later prompts own the actual compatibility deletion.
6. Normalize optionality and nullability deliberately. A field that is required in the clean contract
   must be required at the boundary and in all downstream projections, not made optional to preserve
   an old consumer.
7. Do not introduce a compatibility adapter, deprecated alias, dual response shape, or temporary
   duplicate to make this refactor easier. The clean redeploy is the migration boundary.

# Constraints

- Follow API → Application → Domain → Infrastructure boundaries.
- Apply KISS, YAGNI, and DRY; make the smallest contract refactor that supports the EPIC.
- Backward compatibility is intentionally not a product constraint for this EPIC. Do not preserve
  legacy aliases or optional fields for old callers.
- Keep normal malformed-current-input validation and data-integrity errors.
- Do not add dependencies, provider calls, or HTTP endpoints.
- Do not modify unrelated entities or reformat unrelated files.

# Deliverables

- A canonical contract/ownership map for every touched entity and projection.
- Consolidated shared/domain/application/API/UI types with no newly duplicated shapes.
- Updated mappers and imports across all affected consumers.
- Focused tests proving current field names and required/nullable semantics.
- A handoff note in the implementation result listing unresolved compatibility paths for prompts `01`–`04`.

# Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts: Avatar, Scenario, Session, Conversation, Message, GM state,
   GM events, retrieval DTOs, memory DTOs, and admin/console projections.
2. Search for duplicated type definitions, inline response objects, copied unions, and local client shapes.
3. Identify the canonical owner of each contract and its boundary mapper.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one in the correct architectural layer and migrate consumers to it.

# Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md` (always required);
- `docs/ARCHITECTURE.md` or an ownership document if boundaries changed;
- `docs/API_CONTRACT.md`, `docs/DATA_MODEL.md`, `docs/GAME_MASTER_CONTRACT.md`, or
  `docs/MEMORY_SYSTEM_SPEC.md` for changed current contracts;
- `docs/TEST_STRATEGY.md` if test ownership or tiers changed;
- `docs/EPICS.md` if the EPIC status/scope wording is now stale.

If no additional documentation changes are needed, explicitly verify that each source-of-truth
document remains accurate. Code, tests, and docs move together.

# Acceptance Criteria

- [ ] Every touched entity has a documented canonical contract owner.
- [ ] Repository search shows no new local copies or inline shapes for the affected contracts.
- [ ] Field names and required/nullable semantics are consistent across shared, domain, API, persistence, and UI boundaries.
- [ ] Current consumers compile against canonical types without compatibility aliases.
- [ ] Focused contract tests pass.
- [ ] No database, migration, or runtime compatibility deletion was smuggled into this foundation slice.
- [ ] `docs/PROJECT_STATUS.md` and impacted contract/architecture docs are reviewed and updated.
