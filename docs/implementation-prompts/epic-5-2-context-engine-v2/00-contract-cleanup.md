# Title

Contract Cleanup For Context Engine Ownership

# Context

EPIC 5.2 touches high-churn contracts already used by session inspection, runtime context assembly, memory, and typed retrieval. The repository already has context shapes in multiple places (`domain/context`, runtime inspector shared DTOs, and use-case-local output builders). Implementing behavior first would increase contract drift.

This slice creates canonical ownership and removes obvious duplication before any new Context Engine logic lands.

# Scope

Implement now:

- inventory all contracts touched by EPIC 5.2:
  - runtime context input/output
  - avatar context snapshot
  - GM context snapshot
  - token budget and trimming metadata
  - context observability payloads
- detect duplicated type definitions and inline shapes across `apps/core`, `apps/console`, and `packages/shared`
- define canonical ownership:
  - domain/internal engine contracts in `apps/core/src/domain/context/**`
  - API/shared DTOs in `packages/shared/src/**`
- refactor obvious duplicates before introducing new fields

Out of scope:

- token budget algorithm behavior
- context selection policy behavior
- endpoint behavior changes

# Relevant Docs

- `docs/VISION.md`
- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/DATA_MODEL.md`
- `docs/API_CONTRACT.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/TEST_STRATEGY.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`

# Implementation Guidance

- Start from existing shared runtime inspector context DTOs and map backward to engine-facing domain types.
- Remove route-local or use-case-local duplicated context shapes when they represent API-facing payloads.
- Keep strict separation between internal engine types and public/admin DTOs.
- Add explicit mapping functions at boundaries instead of reusing internal types directly in route handlers.
- Include brief ownership notes near canonical exports to prevent future duplication.

# Constraints

- Respect API -> Application -> Domain -> Infrastructure boundaries.
- KISS, YAGNI, DRY.
- Preserve backward compatibility for existing inspector APIs unless EPIC explicitly changes contract.
- TypeScript strict mode only; no `any`.

# Deliverables

- context contract ownership map
- duplicate type cleanup in touched modules
- canonical type exports with boundary mappers
- adjusted tests/imports after contract consolidation

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
- `docs/DATA_MODEL.md`
- `docs/TEST_STRATEGY.md`

If no doc changes are needed, explicitly verify that docs are still accurate.

# Acceptance Criteria

- [ ] No duplicated API-facing context DTO remains in touched modules.
- [ ] Canonical ownership for Context Engine contracts is explicit and enforced by imports.
- [ ] Existing context-related API contracts remain stable unless intentionally versioned.
- [ ] `pnpm typecheck` passes with strict typing.
- [ ] `docs/PROJECT_STATUS.md` is updated.
