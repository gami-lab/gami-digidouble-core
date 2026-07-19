# Title

Baseline Avatar Trait Contracts And Source Ownership

# Context

EPIC 8.1 adds a new derived field to an existing high-fanout model: `AvatarSummary`.

That model already flows through `apps/core`, `apps/admin`, `apps/console`, `apps/web`, route tests, and seed helpers. Adding `computedTraits` without a cleanup pass will create or worsen contract drift.

This EPIC also introduces "supporting documents" for trait preparation, but the project already has canonical storage for those inputs: avatar author text, `scenario.worldContext`, and `knowledge_sources`. Do not invent a second document-storage path.

# Scope

Implement now:

- audit every touched avatar read contract before feature work starts
- remove or consolidate duplicate avatar response/type definitions that would force repeated `computedTraits` edits
- confirm canonical ownership for the future trait field and related read DTOs
- confirm canonical ownership for trait source inputs so later prompts reuse existing storage instead of adding parallel entities

Out of scope:

- adding the trait schema itself
- persistence changes
- LLM preparation behavior
- new endpoint behavior
- admin UI changes

# Relevant Docs

- `docs/VISION.md`
- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/DATA_MODEL.md`
- `docs/API_CONTRACT.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/TEST_STRATEGY.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`

# Implementation Guidance

- Start with a concrete inventory for:
  - `AvatarSummary`
  - avatar create/update responses
  - scenario avatar list responses
  - any local helper/test copies of avatar read shapes
- Prefer these owners unless the audit reveals a stronger existing pattern:
  - domain/internal trait owner: `apps/core/src/domain/avatar/`
  - shared HTTP/avatar read owner: `packages/shared/src/entity-types.ts`
  - shared HTTP wrapper responses: `packages/shared/src/web-contract-types.ts`
- Search specifically for local avatar API copies in:
  - stack-e2e route tests
  - seed API helpers
  - any app-local client DTO aliases that duplicate `AvatarSummary`
- Keep test-only helpers honest. If a helper mirrors the shared avatar read shape, import or derive from the canonical type instead of freezing another local copy.
- Confirm source ownership for preparation inputs:
  - avatar author input remains the avatar fields already in the `avatars` model
  - scenario-wide world context remains `scenarios.world_context`
  - supporting documents remain existing `knowledge_sources` rows, especially `knowledgeType: 'memory' | 'world'`
- Do not introduce a new "avatar trait source" table, upload path, or config blob for this EPIC.
- If knowledge source text is already preserved in existing metadata fields, that existing storage is the source of truth for regeneration.

# Constraints

Respect:

- current architecture
- KISS
- YAGNI
- DRY
- backward compatibility for existing avatar consumers
- explicit contract ownership

# Deliverables

- documented contract/source ownership decisions in code through canonical imports and consolidated types
- duplicate touched avatar read shapes removed or reduced
- a clear baseline so `computedTraits` can be added in one canonical place in the next slice

# Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts.
2. Search for duplicated type definitions.
3. Identify canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

# Mandatory Final Step — Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- any outdated impacted docs

Examples:

- `docs/API_CONTRACT.md`
- `docs/ARCHITECTURE.md`

If no doc changes are needed, explicitly verify that docs are still accurate.

# Acceptance Criteria

- [ ] Every touched avatar read contract has one canonical owner.
- [ ] No new local `AvatarSummary`-like copies are introduced by this EPIC.
- [ ] Supporting document ownership for trait preparation is explicit and reuses existing storage.
- [ ] The next slice can add `computedTraits` without updating repeated local response shapes.
- [ ] `docs/PROJECT_STATUS.md` and impacted docs are reviewed or updated.
