# Title

Add Avatar Visibility Metadata To Knowledge Model And Contracts

# Context

EPIC 5.1b requires avatar-scoped knowledge visibility while preserving existing ingestion/retrieval behavior and backward compatibility.

The system already separates knowledge into:

- `memory`
- `world`
- `media`

This slice introduces lightweight visibility metadata so knowledge can be restricted to specific avatars without introducing complex ACL or narrative entity systems.

# Scope

Implement now:

- define lightweight avatar visibility metadata for knowledge sources/chunks
- add persistence changes and migrations required to store visibility metadata
- extend domain contracts and repositories to read/write visibility metadata
- extend shared/API contracts for create/update/read flows where visibility is exposed

Out of scope:

- retrieval filtering logic
- Context Engine behavior changes
- console UI implementation
- chunk-level visibility override strategies beyond simple inheritance

# Relevant Docs

- `docs/VISION.md`
- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/DATA_MODEL.md`
- `docs/API_CONTRACT.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`

# Implementation Guidance

- keep visibility model lightweight and deterministic
- canonical MVP model:
  - `visibleToAvatarIds?: string[]`

- interpretation:
  - undefined or empty → visible to all avatars
  - populated array → visible only to listed avatars

- Game Master visibility rules are handled in later slices
- avoid generic ACL systems, ownership hierarchies, or graph relationships
- visibility should be defined canonically at source level
- chunk-level overrides should remain optional and discouraged in MVP
- ensure existing rows and payloads remain valid through deterministic default visibility behavior
- update repository query contracts end-to-end
- if endpoint schemas change, update shared DTOs first

# Constraints

- preserve backward compatibility
- no cross-layer shortcuts
- KISS, YAGNI, DRY
- TypeScript strict mode only
- deterministic defaults only

# Deliverables

- migration(s) adding avatar visibility metadata
- updated domain/repository contracts
- shared/API contract updates
- tests covering default and explicit visibility behavior

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
- impacted documentation

Examples:

- `docs/API_CONTRACT.md`
- `docs/DATA_MODEL.md`
- `docs/ARCHITECTURE.md`
- `docs/TEST_STRATEGY.md`

If no doc changes are needed, explicitly verify docs remain accurate.

# Acceptance Criteria

- [ ] Knowledge visibility metadata persists with deterministic defaults.
- [ ] Existing knowledge records remain valid without backfill.
- [ ] API/shared contracts remain aligned and drift-free.
- [ ] Repository and contract tests cover default and explicit visibility behavior.
- [ ] `docs/PROJECT_STATUS.md` and impacted docs are updated.
