# Title

Implement Scenario Avatar Trait Preparation Service

# Context

Once the schema and persistence exist, the platform needs a deterministic preparation flow that derives traits from existing authored inputs.

This is not runtime prompt assembly. It is an explicit preparation step that computes stable derived data and can be rerun after authors change avatar descriptions or supporting documents.

# Scope

Implement now:

- add the application/domain service or use case that computes traits for every avatar in one scenario
- gather source material from the canonical existing storage locations
- call the LLM through the existing abstraction layer
- parse, normalize, and persist the computed traits
- support recomputation without mutating the original authored inputs

Out of scope:

- new HTTP routes
- admin UI
- EPIC 8.2 runtime prompt usage
- advanced quality scoring or human review workflows

# Relevant Docs

- `docs/PRINCIPLES.md`
- `docs/ARCHITECTURE.md`
- `docs/TECH_STACK.md`
- `docs/DATA_MODEL.md`
- `docs/API_CONTRACT.md`
- `docs/MEMORY_SYSTEM_SPEC.md`
- `docs/EPICS.md`
- `docs/PROJECT_STATUS.md`

# Implementation Guidance

- Prefer a scenario-scoped use case such as `PrepareScenarioAvatarTraitsUseCase`.
- Reuse existing repositories instead of creating a new preparation data model:
  - avatar source: avatar fields already stored on `avatars`
  - scenario context source: `scenarios.worldContext`
  - supporting documents: `knowledge_sources` with `knowledgeType` in `memory` or `world`
- Preparation should operate on original source text, not retrieval chunks.
  - Prefer source text preserved in `knowledge_sources.metadata.inlineText`
  - If a source has no preserved inline/original text in Phase A, skip it rather than inventing a new loader path for this EPIC
- Keep the preparation prompt strict and JSON-only.
- Reuse existing patterns from:
  - `LlmUserFactExtractor`
  - `MemoryMaintenanceService`
  - `RunGameMasterUseCase` parsing/normalization helpers
- Do not add direct provider SDK calls in this slice.
- Do not add a new model role unless there is a strong, documented reason.
  - Prefer reusing an existing role-config path through the current LLM abstraction
- Add normalization rules after parsing:
  - only the seven allowed fields
  - each field is an array of concise strings
  - trim whitespace
  - deduplicate obvious repeats
  - cap each field to the EPIC’s 5-7 item guidance
  - preserve ambiguity instead of forcing invented specificity
  - never inject generic world facts as avatar traits
- Keep recomputation idempotent at the contract level:
  - rerunning the preparation overwrites derived traits with a fresh derived result
  - rerunning does not alter original avatar text or knowledge sources
- Decide and document what the use case returns.
  - A practical default is scenario id plus updated avatar summaries or a compact per-avatar result list

# Constraints

Respect:

- current architecture
- KISS
- YAGNI
- DRY
- no direct provider calls outside the LLM abstraction
- no mutation of original authored inputs

# Deliverables

- scenario-scoped avatar trait preparation use case/service
- parsing and normalization helpers for trait output
- repository writes for computed traits
- deterministic unit tests covering source selection, normalization, and recomputation behavior

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

- `docs/ARCHITECTURE.md`
- `docs/DATA_MODEL.md`
- `docs/TEST_STRATEGY.md`

If no doc changes are needed, explicitly verify that docs are still accurate.

# Acceptance Criteria

- [ ] One scenario-scoped preparation flow computes traits for all scenario avatars.
- [ ] The flow reuses existing avatar, scenario, and knowledge-source storage.
- [ ] The flow uses the current LLM abstraction layer only.
- [ ] Parsed traits are normalized to the fixed schema and kept concise.
- [ ] Re-running preparation updates derived traits without mutating original inputs.
- [ ] Unit tests cover parsing, normalization, skipped unsupported sources, and recomputation behavior.
- [ ] `docs/PROJECT_STATUS.md` and impacted docs are reviewed or updated.
