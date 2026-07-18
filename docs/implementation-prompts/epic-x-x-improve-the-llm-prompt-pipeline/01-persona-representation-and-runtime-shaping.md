# Title

Refine Persona Representation Without Losing Author Intent

# Context

Today avatar persona authoring is centered on `personaPrompt` free text. That gives flexibility, but it also means important runtime distinctions such as identity, speaking style, rules, background, and relationship context can be blended together in one block.

EPIC X.X does not require a specific storage redesign, but it does require a clearer runtime representation. This slice should produce a minimal, architecture-safe way to preserve administrator intent while giving the Avatar prompt assembly a more structured signal.

# Scope

Implement now:

- review the current persona authoring/storage/runtime flow across:
  - avatar CRUD contracts
  - persistence model
  - console editing forms
  - `assemblePersonaPrompt`
- introduce a canonical runtime persona representation that separates at least:
  - identity/core role
  - behavioral rules
  - speaking style/tone
  - descriptive/background context
  - relationship or scenario-specific guidance when present
- choose the minimal implementation path that fits the current product:
  - additive structured fields
  - a transformation/preprocessing service
  - a hybrid of persisted and derived structure
- keep current authored information usable even if older avatars still only contain free-form persona text

Out of scope:

- speculative persona-authoring systems
- rich CMS-like editing workflows
- adding new narrative capabilities
- unrelated scenario/avatar refactors

# Relevant Docs

- `docs/VISION.md`
- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/DATA_MODEL.md`
- `docs/API_CONTRACT.md`
- `docs/TEST_STRATEGY.md`
- `docs/TEST_COVERAGE_PLAN.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`

# Implementation Guidance

- Inspect current persona ownership first:
  - domain: `apps/core/src/domain/avatar/avatar.types.ts`
  - prompt assembly: `apps/core/src/domain/avatar/persona-prompt.service.ts`
  - API routes: `apps/core/src/api/routes/avatars.ts`
  - console editors: `apps/console/src/pages/AvatarPage.tsx`, `apps/console/src/pages/avatar-row.tsx`, `apps/console/src/pages/ScenarioPage.tsx`
  - shared DTOs: `packages/shared/src/entity-types.ts` and related exports
- Prefer additive compatibility over a breaking rewrite. If free-form `personaPrompt` remains the source of truth, make the runtime shaping step explicit and testable instead of scattering parsing logic across prompt builders.
- Do not invent content. Any structured runtime persona section must be grounded in administrator-provided fields or deterministic transforms.
- If storage or HTTP contracts change, update all canonical DTO owners first, then route schemas, then console consumers.
- Keep the design inspectable. Operators should be able to understand what runtime persona structure the LLM actually receives.

# Constraints

- Respect current architecture and module boundaries.
- KISS, YAGNI, DRY.
- Backward compatibility matters: existing avatars must continue to work.
- Avoid hidden heuristics that silently rewrite persona meaning.
- No provider-specific logic in persona shaping.

# Deliverables

- canonical runtime persona representation for Avatar prompt assembly
- updated authoring/storage/transform path needed to support it
- deterministic unit tests covering structured persona output and backward compatibility
- updated console/admin/API wiring only if required by the chosen design

# Mandatory Stack E2E Rule

If this slice adds a new HTTP endpoint or changes an existing avatar/scenario admin contract in a way that requires new route coverage, add a corresponding `*.stack-e2e.test.ts` file that validates:

- auth behavior
- request validation behavior
- not-found behavior where applicable
- response envelope and contract shape

# Mandatory Pre-Implementation Check

Before coding:

1. Identify touched entities/contracts.
2. Search for duplicated type definitions.
3. Identify canonical owner of each contract.
4. Reuse existing shared types where possible.
5. If no canonical owner exists, create one.

# Mandatory Final Step - Documentation Update

After implementation, review and update:

- `docs/PROJECT_STATUS.md`
- any outdated impacted docs

Examples:

- `docs/API_CONTRACT.md`
- `docs/DATA_MODEL.md`
- `docs/ARCHITECTURE.md`
- `docs/TEST_STRATEGY.md`

If no doc changes are needed, explicitly verify that docs are still accurate.

# Acceptance Criteria

- [ ] Runtime persona representation separates behavioral instructions from descriptive content more clearly than the current single-block path.
- [ ] Existing free-form persona content still works without data loss.
- [ ] No hallucinated or speculative persona fields are introduced.
- [ ] Deterministic tests cover the chosen compatibility and transformation behavior.
- [ ] Any changed API/admin contract has matching contract and stack-e2e coverage.
- [ ] `docs/PROJECT_STATUS.md` is updated.
