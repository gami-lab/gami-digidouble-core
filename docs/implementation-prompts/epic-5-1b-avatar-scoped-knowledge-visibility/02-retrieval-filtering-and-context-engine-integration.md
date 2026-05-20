# Title

Implement Avatar-Scoped Retrieval Filtering In Context Assembly

# Context

EPIC 5.1b requires runtime filtering so avatars only see allowed knowledge while retaining deterministic typed retrieval (`memory`, `world`, `media`). This behavior belongs in retrieval and context assembly, not in API handlers.

# Scope

Implement now:

- apply visibility filtering in typed retrieval flow using active avatar identity
- propagate visibility-aware retrieval outputs into Context Engine inputs and trace metadata
- ensure avatar projection excludes knowledge not visible to active avatar
- ensure avatar switching changes retrieval scope deterministically

Out of scope:

- Game Master omniscience logic (handled in next slice)
- admin inspector endpoint additions beyond fields needed by this slice
- console editing UI

# Relevant Docs

- `docs/ARCHITECTURE.md`
- `docs/PRINCIPLES.md`
- `docs/API_CONTRACT.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/GAME_MASTER_CONTRACT.md`
- `docs/TEST_STRATEGY.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`

# Implementation Guidance

- apply filtering before final context assembly so excluded knowledge never reaches avatar prompt composition
- keep selection deterministic: same inputs must produce same keep/exclude decisions
- include explainable trace fields such as `visibilityDecision` or equivalent bounded metadata, without leaking sensitive chunk content
- preserve existing type-based retrieval precedence and budget behavior
- add focused unit tests for:
  - private memory exclusion across avatars
  - shared visibility inclusion for allowed avatars
  - public visibility behavior
  - media visibility filtering symmetry with text retrieval

# Constraints

- no direct provider calls from business logic
- keep async GM behavior unchanged
- no speculative policy framework
- strict typing, no `any`
- avoid modifying unrelated retrieval ranking logic

# Deliverables

- visibility-aware retrieval filtering in core application/domain flow
- context trace enrichment for visibility keep/exclude reasoning
- deterministic unit coverage for avatar-scoped retrieval behavior

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
- `docs/ARCHITECTURE.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/TEST_STRATEGY.md`

If no doc changes are needed, explicitly verify that docs are still accurate.

# Acceptance Criteria

- [ ] Avatar retrieval excludes non-visible chunks/sources deterministically.
- [ ] Avatar switching updates visibility scope without cross-avatar leakage.
- [ ] Context trace exposes bounded explainability for visibility decisions.
- [ ] Existing retrieval type behavior remains intact except visibility filtering.
- [ ] `docs/PROJECT_STATUS.md` reflects this slice.
