# Title

Implement Avatar-Scoped Retrieval Filtering In Context Assembly

# Context

EPIC 5.1b requires runtime filtering so avatars only access allowed knowledge while preserving deterministic typed retrieval (`memory`, `world`, `media`).

Visibility filtering belongs in retrieval and context assembly, not in API handlers or prompt instructions.

# Scope

Implement now:

- apply avatar visibility filtering in typed retrieval flow using active avatar identity
- propagate visibility-aware retrieval outputs into Context Engine inputs and trace metadata
- ensure avatar context assembly excludes non-visible knowledge
- ensure avatar switching updates retrieval scope deterministically

Out of scope:

- Game Master omniscience logic
- console editing UI
- new retrieval ranking strategies

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

- apply filtering before final context assembly
- excluded knowledge must never reach:
  - avatar prompt composition
  - context traces
  - observability payloads
  - runtime inspector payloads

- keep selection deterministic
- preserve existing typed retrieval precedence and token budget behavior
- keep retrieval filtering independent from ranking logic
- include bounded explainability metadata without leaking sensitive content

# Constraints

- no direct provider calls from business logic
- keep async GM behavior unchanged
- no speculative policy framework
- strict typing only
- avoid unrelated retrieval/ranking changes

# Deliverables

- visibility-aware retrieval filtering
- Context Engine visibility integration
- bounded visibility explainability metadata
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
- impacted documentation

Examples:

- `docs/API_CONTRACT.md`
- `docs/ARCHITECTURE.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/TEST_STRATEGY.md`

If no doc changes are needed, explicitly verify docs remain accurate.

# Acceptance Criteria

- [ ] Avatar retrieval excludes non-visible knowledge deterministically.
- [ ] Avatar switching updates visibility scope without leakage.
- [ ] Non-visible knowledge never reaches avatar-facing context assembly.
- [ ] Context trace exposes bounded explainability metadata.
- [ ] Existing retrieval behavior remains intact except visibility filtering.
- [ ] `docs/PROJECT_STATUS.md` reflects this slice.
